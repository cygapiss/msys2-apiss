import { spawn, type SpawnOptions } from "child_process";
import { createWriteStream } from "node:fs";
import * as fs from "fs/promises";
import * as path from "path";
import util from "node:util";

export class RunContext {
  logPath: string | null;
  logStream: NodeJS.WritableStream | null;
  logOptions: Required<RunLogOptions>;

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

  async step(fn: (step: RunContext) => Promise<void>) {
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
    return runProcess(command, args, spawnOptions, logOptions, this.logStream);
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
  logStream: NodeJS.WritableStream | null,
): Promise<RunResult> {
  const { stdout, stderr, ...spawnOptions } = options;
  const { capture, exitOnFailure, teeConsole, pty } = logOptions;
  const cwd = spawnOptions.cwd ?? process.cwd();
  const env = spawnOptions.env ?? process.env;

  let stdoutOutput = "";
  let stderrOutput = "";

  return new Promise((resolve) => {
    let settled = false;
    let child: ReturnType<typeof spawn>;

    const finish = (result: RunResult) => {
      if (settled) {
        return;
      }
      settled = true;
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
