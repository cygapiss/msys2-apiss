import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { mock, test } from "node:test";
import { RunContext } from "../scripts/run-context.ts";

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
