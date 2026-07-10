import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { createWriteStream } from "node:fs";
import * as fs from "fs/promises";
import * as path from "path";
import util from "node:util";

type RunContextSigintActive = {
  finalize: () => Promise<void>;
};

/** SIGINT state; exported for tests. */
export const runContextSigintState: {
  active: RunContextSigintActive | null;
  count: number;
} = {
  active: null,
  count: 0,
};

/** First SIGINT finalizes the active run then exits; a second forces exit. */
export function handleSigint(exitCode: number) {
  runContextSigintState.count += 1;
  if (runContextSigintState.count >= 2) {
    console.log("Caught interrupt signal again, forcing exit");
    process.exit(exitCode);
    return;
  }
  console.log("Caught interrupt signal");
  if (runContextSigintState.active) {
    void runContextSigintState.active.finalize().finally(() => {
      if (runContextSigintState.count < 2) {
        process.exit(exitCode);
      }
    });
    return;
  }
  process.exit(exitCode);
}

function killSpawnedChild(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    // No cross-platform child_process.killTree yet; see
    // https://github.com/nodejs/node/issues/64406
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    }
    child.kill("SIGTERM");
  } catch {
    // Child may already be gone.
  }
}

function waitForSpawnedChildClose(
  child: ChildProcess,
  timeoutMs = 5000,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export class RunContext {
  logPath: string | null;
  logStream: NodeJS.WritableStream | null;
  logOptions: Required<RunLogOptions>;
  children = new Set<ChildProcess>();

  constructor(
    logPath: string | null = null,
    logOptions: RunLogOptions = {},
    logStream: NodeJS.WritableStream | null = null,
  ) {
    this.logPath = logPath;
    this.logStream = logStream;
    this.logOptions = {
      teeConsole: logOptions.teeConsole ?? false,
      capture: logOptions.capture ?? false,
      exitOnFailure: logOptions.exitOnFailure ?? true,
      pty: logOptions.pty ?? true,
    };
  }

  log(...args: unknown[]) {
    const line = `${util.format(...args)}\n`;
    this.logStream?.write(line);
    process.stdout.write(line);
  }

  logFile(...args: unknown[]) {
    const line = `${util.format(...args)}\n`;
    this.logStream?.write(line);
  }

  error(...args: unknown[]) {
    const line = `${util.format(...args)}\n`;
    this.logStream?.write(line);
    process.stderr.write(line);
  }

  async closeLogStream() {
    const logStream = this.logStream;
    this.logStream = null;
    if (logStream) {
      await new Promise<void>((resolve) => logStream.end(() => resolve()));
    }
  }

  async killChildren() {
    const children = [...this.children];
    for (const child of children) {
      killSpawnedChild(child);
    }
    await Promise.all(children.map((child) => waitForSpawnedChildClose(child)));
  }

  /** Kill spawned children, then close the log stream. */
  async finalize() {
    await this.killChildren();
    await this.closeLogStream();
  }

  async step(fn: (step: RunContext) => Promise<void>) {
    if (runContextSigintState.active !== null) {
      throw new Error("RunContext.step re-entry is not allowed");
    }
    runContextSigintState.active = this;
    try {
      if (!this.logStream) {
        if (this.logPath) {
          if (this.logPath === '') {
            throw new Error("logPath should be a valid path, not empty string, use null to disable logging");
          }
          await fs.mkdir(path.dirname(this.logPath), { recursive: true });
          this.logStream = createWriteStream(this.logPath, {
            flags: "w",
          });
        }
      }
      let exitCode: number | null = null;
      try {
        await fn(this);
      } catch (error) {
        this.log("");
        if (error instanceof Error) {
          this.log(`ERROR: ${error.message} at ${error.stack} failed`);
        } else {
          this.log(`ERROR: unknown error failed in RunContext.step`);
        }
        this.log(`Log file: ${this.logPath}`);
        this.error(error);
        exitCode = 1;
      } finally {
        const logStream = this.logStream;
        this.logStream = null;
        if (logStream) {
          await new Promise<void>((resolve) => logStream.end(() => resolve()));
        }
      }
      if (exitCode !== null) {
        process.exit(exitCode);
      }
    } finally {
      runContextSigintState.active = null;
    }
  }

  run(
    command: string,
    args: string[] = [],
    options: RunOptions = {},
  ): Promise<RunResult> {
    const { capture, teeConsole, exitOnFailure, pty, ...spawnOptions } = options;
    const logOptions: Required<RunLogOptions> = {
      capture: capture ?? this.logOptions.capture,
      teeConsole: teeConsole ?? this.logOptions.teeConsole,
      exitOnFailure: exitOnFailure ?? this.logOptions.exitOnFailure,
      pty: pty ?? this.logOptions.pty,
    };
    return runProcess(command, args, spawnOptions, logOptions, this);
  }
}

export type RunLogger = Pick<RunContext, "run" | "log" | "logFile" | "error">;

export type RunResult = {
  stdout: string;
  stderr: string;
  code: number;
};

export type RunSpawnOptions = SpawnOptions & {
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
};

export type RunLogOptions = {
  teeConsole?: boolean;
  capture?: boolean;
  exitOnFailure?: boolean;
  pty?: boolean;
};

export type RunOptions = RunSpawnOptions & RunLogOptions;

async function runProcess(
  command: string,
  args: string[],
  options: RunSpawnOptions,
  logOptions: Required<RunLogOptions>,
  context: RunContext,
): Promise<RunResult> {
  const { stdout, stderr, ...spawnOptions } = options;
  const { capture, exitOnFailure, teeConsole, pty } = logOptions;
  const cwd = spawnOptions.cwd ?? process.cwd();
  const env = spawnOptions.env ?? process.env;
  const logStream = context.logStream;

  let stdoutOutput = "";
  let stderrOutput = "";

  return new Promise((resolve) => {
    let settled = false;
    let child: ChildProcess | undefined;

    const finish = (result: RunResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (child) {
        context.children.delete(child);
      }
      if (exitOnFailure && result.code !== 0) {
        if (logStream) {
          logStream.end(() => process.exit(result.code));
        } else {
          process.exit(result.code);
        }
        return;
      }
      resolve(result);
    };

    try {
      // TODO: add pty support, currently nodejs do not support pty option,
      // but once nodejs supports pty option, we can enable it here.
      // Tracking issue: https://github.com/nodejs/node/issues/64019
      child = spawn(command, args, {
        ...spawnOptions,
        cwd,
        env,
        windowsHide: false,
      });
    } catch (error) {
      finish({
        stdout: stdoutOutput,
        stderr: String(error),
        code: 1,
      });
      return;
    }

    context.children.add(child);

    const handleChunk = (
      chunk: Buffer | string,
      stream: "stdout" | "stderr",
    ) => {
      const text = chunk.toString();
      if (capture && stream === "stdout") {
        stdoutOutput += text;
      }
      if (capture && stream === "stderr") {
        stderrOutput += text;
      }
      if (logStream) {
        logStream.write(chunk);
      }
      const outputStream = stream === "stdout" ? stdout : stderr;
      if (outputStream) {
        outputStream.write(chunk);
      }
      if (teeConsole) {
        (stream === "stdout" ? process.stdout : process.stderr).write(chunk);
      }
    };

    child.stdout?.on("data", (chunk) => handleChunk(chunk, "stdout"));
    child.stderr?.on("data", (chunk) => handleChunk(chunk, "stderr"));

    child.on("error", (error) => {
      const text = `${String(error)}\n`;
      stderrOutput += text;
      if (logStream) {
        logStream.write(text);
      }
      if (stderr) {
        stderr.write(text);
      }
      if (teeConsole) {
        process.stderr.write(text);
      }
      finish({
        stdout: stdoutOutput,
        stderr: stderrOutput,
        code: 1,
      });
    });

    child.on("close", (code) => {
      finish({
        stdout: stdoutOutput,
        stderr: stderrOutput,
        code: code ?? 0,
      });
    });
  });
}
