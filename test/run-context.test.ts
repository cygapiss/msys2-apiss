import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { mock, test } from "node:test";
import {
  handleSigint,
  runContextSigintState,
  RunContext,
} from "../scripts/run-context.ts";

function resetSigintState(
  active: { finalize: () => Promise<void> } | null = null,
) {
  runContextSigintState.active = active;
  runContextSigintState.count = 0;
}

async function flushAsyncWork() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("handleSigint finalizes active run on first interrupt and forces exit on second", async () => {
  const finalize = mock.fn(async () => {});
  resetSigintState({ finalize });
  const exit = mock.method(process, "exit", (() => undefined) as typeof process.exit);
  const log = mock.method(console, "log", () => {});

  try {
    handleSigint(130);
    assert.equal(exit.mock.callCount(), 0);
    assert.equal(finalize.mock.callCount(), 1);
    assert.deepEqual(log.mock.calls[0]?.arguments, [
      "Caught interrupt signal",
    ]);

    handleSigint(130);
    assert.equal(exit.mock.callCount(), 1);
    assert.deepEqual(exit.mock.calls[0]?.arguments, [130]);
    assert.deepEqual(log.mock.calls[1]?.arguments, [
      "Caught interrupt signal again, forcing exit",
    ]);

    await flushAsyncWork();

    assert.equal(exit.mock.callCount(), 1);
  } finally {
    mock.restoreAll();
    resetSigintState();
  }
});

test("handleSigint exits 130 when no run context is active", () => {
  resetSigintState();
  const exit = mock.method(process, "exit", (() => undefined) as typeof process.exit);
  const log = mock.method(console, "log", () => {});

  try {
    handleSigint(130);

    assert.equal(exit.mock.callCount(), 1);
    assert.deepEqual(exit.mock.calls[0]?.arguments, [130]);
    assert.deepEqual(log.mock.calls[0]?.arguments, [
      "Caught interrupt signal",
    ]);
  } finally {
    mock.restoreAll();
    resetSigintState();
  }
});

test("handleSigint uses active RunContext registered by step", async () => {
  resetSigintState();
  const context = new RunContext(null);
  const finalize = mock.method(context, "finalize", async () => {});
  const exit = mock.method(process, "exit", (() => undefined) as typeof process.exit);
  const log = mock.method(console, "log", () => {});

  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = context.step(async () => {
    await hold;
  });

  try {
    await flushAsyncWork();
    assert.equal(runContextSigintState.active, context);

    handleSigint(130);
    assert.equal(finalize.mock.callCount(), 1);
    assert.equal(exit.mock.callCount(), 0);

    await flushAsyncWork();
    assert.equal(exit.mock.callCount(), 1);
    assert.deepEqual(exit.mock.calls[0]?.arguments, [130]);
  } finally {
    release();
    await running;
    mock.restoreAll();
    resetSigintState();
  }
});

test("RunContext.step rejects re-entry while another step is active", async () => {
  resetSigintState();
  const outer = new RunContext(null);
  const inner = new RunContext(null);

  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = outer.step(async () => {
    await hold;
  });

  try {
    await flushAsyncWork();
    await assert.rejects(
      () => inner.step(async () => {}),
      /RunContext\.step re-entry is not allowed/,
    );
    await assert.rejects(
      () => outer.step(async () => {}),
      /RunContext\.step re-entry is not allowed/,
    );
  } finally {
    release();
    await running;
    resetSigintState();
  }
});

test("handleSigint kills active child before exit", async () => {
  resetSigintState();
  const context = new RunContext(null, { exitOnFailure: false });
  const exit = mock.method(process, "exit", (() => undefined) as typeof process.exit);
  mock.method(console, "log", () => {});

  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let runPromise: Promise<{ code: number }> | undefined;
  const running = context.step(async (step) => {
    runPromise = step.run(process.execPath, [
      "-e",
      "setInterval(() => {}, 1000)",
    ]);
    await hold;
  });

  try {
    const timeout = Date.now() + 2000;
    while (context.children.size === 0) {
      if (Date.now() > timeout) {
        assert.fail("Timed out waiting for child process");
      }
      await flushAsyncWork();
    }
    assert.equal(context.children.size, 1);
    const child = [...context.children][0]!;

    handleSigint(130);
    await waitForExit(() => exit.mock.callCount() > 0);

    assert.equal(exit.mock.callCount(), 1);
    assert.deepEqual(exit.mock.calls[0]?.arguments, [130]);
    assert.equal(context.children.size, 0);
    assert.ok(child.exitCode !== null || child.signalCode !== null);
    assert.ok(runPromise);
    await runPromise;
  } finally {
    release();
    await running;
    mock.restoreAll();
    resetSigintState();
  }
});

class EndTrackingStream extends Writable {
  chunks: string[] = [];
  endCalled = false;

  _write(
    _chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.chunks.push(_chunk.toString());
    callback();
  }

  contents() {
    return this.chunks.join("");
  }

  override end(callback?: () => void): this;
  override end(chunk: unknown, callback?: () => void): this;
  override end(
    chunk: unknown,
    encoding?: BufferEncoding,
    callback?: () => void,
  ): this;
  override end(
    chunk?: unknown,
    encoding?: BufferEncoding | (() => void),
    callback?: () => void,
  ): this {
    this.endCalled = true;
    return super.end(chunk, encoding as BufferEncoding, callback);
  }
}

test("RunContext.step closes injected log stream after success", async () => {
  const logStream = new EndTrackingStream();
  const context = new RunContext(null, {}, logStream);

  await context.step(async (step) => {
    step.logFile("hello %s", "world");
  });

  assert.equal(logStream.contents(), "hello world\n");
  assert.equal(logStream.endCalled, true);
  assert.equal(context.logStream, null);
});

test("RunContext.step closes injected log stream before exiting on error", async () => {
  const logStream = new EndTrackingStream();
  const context = new RunContext(null, {}, logStream);
  let exitCode: string | number | null | undefined;
  let endCalledAtExit = false;

  mock.method(process.stdout, "write", () => true);
  mock.method(process.stderr, "write", () => true);
  mock.method(process, "exit", ((code?: string | number | null) => {
    exitCode = code;
    endCalledAtExit = logStream.endCalled;
    return undefined as never;
  }) as typeof process.exit);

  try {
    await context.step(async () => {
      throw new Error("step failed");
    });

    assert.equal(exitCode, 1);
    assert.equal(endCalledAtExit, true);
    assert.equal(context.logStream, null);
    assert.match(logStream.contents(), /ERROR: step failed/);
  } finally {
    mock.restoreAll();
  }
});

test("RunContext.run captures stdout and stderr when capture is enabled", async () => {
  const result = await new RunContext(null, {
    capture: true,
    exitOnFailure: false,
  }).run(process.execPath, [
    "-e",
    "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)",
  ]);

  assert.deepEqual(result, {
    stdout: "out",
    stderr: "err",
    code: 3,
  });
});

test("RunContext.run writes child output to log and requested streams", async () => {
  const logStream = new EndTrackingStream();
  const stdout = new EndTrackingStream();
  const stderr = new EndTrackingStream();

  const result = await new RunContext(null, { capture: true }, logStream).run(
    process.execPath,
    ["-e", "process.stdout.write('out'); process.stderr.write('err')"],
    { stdout, stderr },
  );

  assert.deepEqual(result, {
    stdout: "out",
    stderr: "err",
    code: 0,
  });
  assert.equal(logStream.contents(), "outerr");
  assert.equal(stdout.contents(), "out");
  assert.equal(stderr.contents(), "err");
});

async function waitForExit(exitCalled: () => boolean) {
  const timeout = Date.now() + 1000;
  while (!exitCalled()) {
    if (Date.now() > timeout) {
      assert.fail("Timed out waiting for process.exit");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("RunContext.run closes log stream before exitOnFailure exits", async () => {
  const logStream = new EndTrackingStream();
  let exitCalled = false;
  let exitCode: string | number | null | undefined;
  let endCalledAtExit = false;

  mock.method(process, "exit", ((code?: string | number | null) => {
    exitCalled = true;
    exitCode = code;
    endCalledAtExit = logStream.endCalled;
    return undefined as never;
  }) as typeof process.exit);

  try {
    void new RunContext(null, { exitOnFailure: true }, logStream).run(
      process.execPath,
      ["-e", "process.exit(7)"],
    );

    await waitForExit(() => exitCalled);

    assert.equal(exitCode, 7);
    assert.equal(endCalledAtExit, true);
  } finally {
    mock.restoreAll();
  }
});

test("RunContext.closeLogStream closes injected log stream", async () => {
  const logStream = new EndTrackingStream();
  const context = new RunContext(null, {}, logStream);
  context.logFile("partial log");

  await context.closeLogStream();

  assert.equal(logStream.endCalled, true);
  assert.equal(context.logStream, null);
  assert.equal(logStream.contents(), "partial log\n");
});
