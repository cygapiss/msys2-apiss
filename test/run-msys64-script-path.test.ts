import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mock, test } from "node:test";
import { assertMsys2Root, runMsys2ScriptPath } from "../scripts/utils.ts";
import type { RunOptions } from "../scripts/run-context.ts";
import { makeMsys2Stage } from "./make-msys2-stage.ts";
import { makeRunLogger } from "./make-run-logger.ts";

const stage = makeMsys2Stage("stage2");
const bash = stage.bash;

type RecordedRun = {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

function makeStep(runs: RecordedRun[]) {
  return makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options?: RunOptions) => {
      runs.push({
        command,
        args,
        cwd: typeof options?.cwd === "string" ? options.cwd : undefined,
        env: options?.env,
      });
      return { stdout: "", stderr: "", code: 0 };
    }),
  });
}

test("runMsys2ScriptPath accepts simple identifier/path args verbatim", async () => {
  const runs: RecordedRun[] = [];
  await runMsys2ScriptPath(makeStep(runs), stage, {
    script: "scripts/sh/single.sh",
    scriptArgs: ["msys2-runtime"],
  });
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].command, bash);
  assert.deepEqual(runs[0].args, [
    "--login",
    "-c",
    'sh scripts/sh/single.sh "msys2-runtime"',
  ]);
  assert.equal(runs[0].env, stage.env);
});

test("runMsys2ScriptPath accepts repo-relative path args like ./dist/stage1-rt-hook", async () => {
  const runs: RecordedRun[] = [];
  await runMsys2ScriptPath(makeStep(runs), stage, {
    script: "scripts/sh/install-runtime-hook.sh",
    scriptArgs: ["./dist/stage1-rt-hook"],
  });
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].args, [
    "--login",
    "-c",
    'sh scripts/sh/install-runtime-hook.sh "./dist/stage1-rt-hook"',
  ]);
});

test("runMsys2ScriptPath joins multiple simple args with spaces", async () => {
  const runs: RecordedRun[] = [];
  await runMsys2ScriptPath(makeStep(runs), stage, {
    script: "scripts/sh/single.sh",
    scriptArgs: ["gcc", "base-devel"],
  });
  assert.deepEqual(runs[0].args, [
    "--login",
    "-c",
    'sh scripts/sh/single.sh "gcc" "base-devel"',
  ]);
});

test("runMsys2ScriptPath omits the args segment when scriptArgs is empty", async () => {
  const runs: RecordedRun[] = [];
  await runMsys2ScriptPath(makeStep(runs), stage, {
    script: "scripts/sh/cross-clang-setup.sh",
  });
  assert.deepEqual(runs[0].args, [
    "--login",
    "-c",
    "sh scripts/sh/cross-clang-setup.sh",
  ]);
});

test("runMsys2ScriptPath prepends prelude in the same bash -c command", async () => {
  const runs: RecordedRun[] = [];
  await runMsys2ScriptPath(makeStep(runs), stage, {
    script: "scripts/sh/single.sh",
    scriptArgs: ["rust"],
    prelude: "export FOO=bar",
  });
  assert.deepEqual(runs[0].args, [
    "--login",
    "-c",
    'export FOO=bar\nsh scripts/sh/single.sh "rust"',
  ]);
});

test("runMsys2ScriptPath shell-quotes args with shell metacharacters", async () => {
  const runs: RecordedRun[] = [];
  await runMsys2ScriptPath(makeStep(runs), stage, {
    script: "scripts/sh/single.sh",
    scriptArgs: ["pkg; rm -rf /", "a|b", "a&&b"],
  });
  assert.deepEqual(runs[0].args, [
    "--login",
    "-c",
    'sh scripts/sh/single.sh "pkg; rm -rf /" "a|b" "a&&b"',
  ]);
});

const badArgs = ["a$b", "a$(x)", "$FOO"];

for (const bad of badArgs) {
  test(`runMsys2ScriptPath rejects arg containing $: ${JSON.stringify(bad)}`, async () => {
    const runs: RecordedRun[] = [];
    const step = makeStep(runs);
    await assert.rejects(
      runMsys2ScriptPath(step, stage, {
        script: "scripts/sh/single.sh",
        scriptArgs: [bad],
      }),
      /must not contain '\$'/,
    );
    assert.equal(runs.length, 0, "step.run must not be called for rejected args");
  });
}

async function makeAssertMsys2StageRoot() {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "assert-msys64-"));
  const msys2Root = path.join(tmp, "msys64");
  const bash = path.join(msys2Root, "usr", "bin", "bash.exe");
  await mkdir(path.dirname(bash), { recursive: true });
  await writeFile(bash, "");
  return { msys2Root, bash };
}

test("assertMsys2Root runs cygpath -w / via bash login", async () => {
  const { msys2Root, bash } = await makeAssertMsys2StageRoot();
  const stage = { ...makeMsys2Stage("stage1"), msys2Root, bash };
  const runs: RecordedRun[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options?: RunOptions) => {
      runs.push({
        command,
        args,
        cwd: typeof options?.cwd === "string" ? options.cwd : undefined,
        env: options?.env,
      });
      return { stdout: `${stage.msys2Root}\n`, stderr: "", code: 0 };
    }),
  });
  await assertMsys2Root(step, stage, "prep-step");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].command, stage.bash);
  assert.deepEqual(runs[0].args, ["--login", "-c", "cygpath -w /"]);
  assert.equal(runs[0].cwd, stage.repoRoot);
  assert.equal(runs[0].env, stage.env);
});

test("assertMsys2Root rejects cygpath failure", async () => {
  const { msys2Root, bash } = await makeAssertMsys2StageRoot();
  const stage = { ...makeMsys2Stage("stage1"), msys2Root, bash };
  const step = makeRunLogger({
    run: mock.fn(async () => ({ stdout: "", stderr: "", code: 1 })),
  });
  await assert.rejects(
    () => assertMsys2Root(step, stage, "prep-step"),
    /cygpath check failed/,
  );
});

test("assertMsys2Root rejects cygpath root mismatch", async () => {
  const { msys2Root, bash } = await makeAssertMsys2StageRoot();
  const stage = { ...makeMsys2Stage("stage1"), msys2Root, bash };
  const step = makeRunLogger({
    run: mock.fn(async () => ({
      stdout: "D:\\wrong\\msys64\n",
      stderr: "",
      code: 0,
    })),
  });
  await assert.rejects(
    () => assertMsys2Root(step, stage, "prep-step"),
    /cygpath -w \/ returned/,
  );
});
