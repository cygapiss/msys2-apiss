import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { mock, test } from "node:test";
import { resetPipelineSigintStateForTest } from "../scripts/pipeline.ts";
import { RunContext } from "../scripts/run-context.ts";
import {
  handleStartSigint,
  resetStartSigintStateForTest,
} from "../scripts/start.ts";

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

async function flushAsyncWork() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("handleStartSigint closes active log stream on first interrupt and forces exit on second", async () => {
  resetPipelineSigintStateForTest();
  resetStartSigintStateForTest();
  const logStream = new EndTrackingStream();
  const context = new RunContext(null, {}, logStream);
  context.logFile("partial log");
  let exitCount = 0;
  const stdoutLines: string[] = [];

  mock.method(process.stdout, "write", ((chunk: string | Uint8Array) => {
    stdoutLines.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);

  try {
    handleStartSigint({
      getActiveRunContext: () => context,
      exit: () => {
        exitCount += 1;
      },
    });
    assert.equal(exitCount, 0);
    assert.equal(logStream.endCalled, true);

    handleStartSigint({
      getActiveRunContext: () => context,
      exit: () => {
        exitCount += 1;
      },
    });
    assert.equal(exitCount, 1);

    await flushAsyncWork();

    assert.equal(context.logStream, null);
    assert.equal(logStream.contents(), "partial log\n");
    assert.match(stdoutLines.join(""), /Caught interrupt signal/);
    assert.match(stdoutLines.join(""), /forcing exit/);
  } finally {
    mock.restoreAll();
  }
});

test("handleStartSigint exits 130 when no pipeline run is active", () => {
  resetPipelineSigintStateForTest();
  resetStartSigintStateForTest();
  let exitCode: number | undefined;

  mock.method(process.stdout, "write", () => true);

  try {
    handleStartSigint({
      getActiveRunContext: () => null,
      exit: (code) => {
        exitCode = code;
      },
    });

    assert.equal(exitCode, 130);
  } finally {
    mock.restoreAll();
  }
});
