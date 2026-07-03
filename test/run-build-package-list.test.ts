import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, mock, test, type TestContext } from "node:test";
import {
  type Msys2StageId,
} from "../scripts/build-config.ts";
import * as realUtils from "../scripts/utils.ts";
import { makeMsys2Stage } from "./make-msys2-stage.ts";
import { makeRunLogger } from "./make-run-logger.ts";

const runMsys2ScriptPathMock = mock.fn(async () => ({
  stdout: "",
  stderr: "",
  code: 0,
}));
const assertMsys2RootMock = mock.fn(async () => {});
const rebaseallMsys2Mock = mock.fn(async () => {});
let repoPathRoot = "";
let fakeStage = makeMsys2Stage("stage2");

const initMsys2StageMock = mock.fn(
  (_step: unknown, _stageId: string, optionsEnv: NodeJS.ProcessEnv = {}) => ({
    ...fakeStage,
    repoRoot: repoPathRoot || fakeStage.repoRoot,
    env: { ...fakeStage.env, ...optionsEnv },
  }),
);

let pipelineModule:
  | typeof import("../scripts/package-build-pipeline.ts")
  | undefined;

function resetPipelineMocks() {
  runMsys2ScriptPathMock.mock.resetCalls();
  assertMsys2RootMock.mock.resetCalls();
  rebaseallMsys2Mock.mock.resetCalls();
  initMsys2StageMock.mock.resetCalls();
}

before(async () => {
  if (pipelineModule) {
    return;
  }
  mock.module("../scripts/utils.ts", {
    namedExports: {
      ...realUtils,
      get initMsys2Stage() {
        return initMsys2StageMock;
      },
      get assertMsys2Root() {
        return assertMsys2RootMock;
      },
      get runMsys2ScriptPath() {
        return runMsys2ScriptPathMock;
      },
    },
  });
  mock.module("../scripts/msys2-rebaseall.ts", {
    namedExports: {
      get rebaseallMsys2() {
        return rebaseallMsys2Mock;
      },
    },
  });
  pipelineModule = await import("../scripts/package-build-pipeline.ts");
});

async function loadPackageBuildPipeline(_t: TestContext) {
  return pipelineModule!;
}

async function writeStageListFiles(
  stageId: Msys2StageId,
  packages: string[],
  installContent = "old.pkg.tar.zst\n",
) {
  const listPath = path.join(
    repoPathRoot,
    realUtils.generatedTxtPath(stageId, "list"),
  );
  const installPath = path.join(
    repoPathRoot,
    realUtils.generatedTxtPath(stageId, "install"),
  );
  await mkdir(path.dirname(listPath), { recursive: true });
  await writeFile(listPath, `${packages.join("\n")}\n`, "utf-8");
  await writeFile(installPath, installContent, "utf-8");
  return { listPath, installPath };
}

function runMsys2ScriptOptions(
  call: { arguments: unknown[] },
): { script?: string; scriptArgs?: string[] } | undefined {
  return call.arguments[2] as { script?: string; scriptArgs?: string[] } | undefined;
}

function singleScriptCalls() {
  return runMsys2ScriptPathMock.mock.calls
    .map(runMsys2ScriptOptions)
    .filter(
      (options): options is { script: string; scriptArgs?: string[] } =>
        options?.script === "scripts/sh/single.sh",
    );
}

function scriptCalls(script: string) {
  return runMsys2ScriptPathMock.mock.calls
    .map(runMsys2ScriptOptions)
    .filter(
      (options): options is { script: string } => options?.script === script,
    );
}

test("runBuildPackageList clears install list and runs single.sh for each package", async (t) => {
  resetPipelineMocks();
  repoPathRoot = await mkdtemp(path.join(tmpdir(), "cygwin-run-build-list-"));
  const { installPath } = await writeStageListFiles("stage2", ["gcc", "bash"]);
  const { runBuildPackageList } = await loadPackageBuildPipeline(t);

  await runBuildPackageList(makeRunLogger(), "stage2", "stage2-install-prep");

  assert.equal(await readFile(installPath, "utf-8"), "");
  assert.equal(assertMsys2RootMock.mock.callCount(), 1);
  assert.deepEqual(
    initMsys2StageMock.mock.calls[0]?.arguments.slice(1, 3),
    ["stage2", {}],
  );
  assert.deepEqual(
    singleScriptCalls().map((call) => call.scriptArgs),
    [["gcc"], ["bash"]],
  );
});

test("runBuildPackageList onlyOne stops after the first package", async (t) => {
  resetPipelineMocks();
  repoPathRoot = await mkdtemp(path.join(tmpdir(), "cygwin-run-build-one-"));
  await writeStageListFiles("stage2", ["gcc", "bash"]);
  const { runBuildPackageList } = await loadPackageBuildPipeline(t);

  await runBuildPackageList(makeRunLogger(), "stage2", "stage2-install-prep", {
    onlyOne: true,
  });

  assert.deepEqual(
    singleScriptCalls().map((call) => call.scriptArgs),
    [["gcc"]],
  );
});

test("runBuildPackageList fromPackage skips earlier packages and keeps install list", async (t) => {
  resetPipelineMocks();
  repoPathRoot = await mkdtemp(path.join(tmpdir(), "cygwin-run-build-from-"));
  const { installPath } = await writeStageListFiles("stage2", ["gcc", "bash"]);
  const { runBuildPackageList } = await loadPackageBuildPipeline(t);

  await runBuildPackageList(makeRunLogger(), "stage2", "stage2-install-prep", {
    fromPackage: "bash",
  });

  assert.equal(await readFile(installPath, "utf-8"), "old.pkg.tar.zst\n");
  assert.deepEqual(
    singleScriptCalls().map((call) => call.scriptArgs),
    [["bash"]],
  );
});

test("runBuildPackageList throws when fromPackage is missing from the list", async (t) => {
  resetPipelineMocks();
  repoPathRoot = await mkdtemp(path.join(tmpdir(), "cygwin-run-build-missing-"));
  await writeStageListFiles("stage2", ["gcc"]);
  const { runBuildPackageList } = await loadPackageBuildPipeline(t);

  await assert.rejects(
    () =>
      runBuildPackageList(makeRunLogger(), "stage2", "stage2-install-prep", {
        fromPackage: "bash",
      }),
    /Package 'bash' not found/,
  );
});

test("runBuildPackageList runs rebaseall after rust", async (t) => {
  resetPipelineMocks();
  repoPathRoot = await mkdtemp(path.join(tmpdir(), "cygwin-run-build-rust-"));
  await writeStageListFiles("stage2-cross-rust", ["rust"]);
  const { runBuildPackageList } = await loadPackageBuildPipeline(t);

  await runBuildPackageList(
    makeRunLogger(),
    "stage2-cross-rust",
    "stage2-install-prep",
  );

  assert.equal(rebaseallMsys2Mock.mock.callCount(), 1);
  assert.deepEqual(
    singleScriptCalls().map((call) => call.scriptArgs),
    [["rust"]],
  );
});

test("runBuildPackageList runs cross-clang setup and finalize scripts", async (t) => {
  resetPipelineMocks();
  repoPathRoot = await mkdtemp(path.join(tmpdir(), "cygwin-run-build-clang-"));
  await writeStageListFiles("stage2-cross-clang", ["gcc"]);
  const { runBuildPackageList } = await loadPackageBuildPipeline(t);

  await runBuildPackageList(
    makeRunLogger(),
    "stage2-cross-clang",
    "stage2-extract",
  );

  assert.equal(scriptCalls("scripts/sh/cross-clang-setup.sh").length, 1);
  assert.equal(scriptCalls("scripts/sh/cross-clang-finalize.sh").length, 1);
  assert.deepEqual(
    singleScriptCalls().map((call) => call.scriptArgs),
    [["gcc"]],
  );
});

test("runBuildPackageList passes noExtract env to initMsys2Stage", async (t) => {
  resetPipelineMocks();
  repoPathRoot = await mkdtemp(path.join(tmpdir(), "cygwin-run-build-noextract-"));
  await writeStageListFiles("stage2", ["gcc"]);
  const { runBuildPackageList } = await loadPackageBuildPipeline(t);

  await runBuildPackageList(makeRunLogger(), "stage2", "stage2-install-prep", {
    noExtract: true,
  });

  assert.equal(
    initMsys2StageMock.mock.calls[0]?.arguments[2]?.MSYS_BUILD_NO_EXTRACT,
    "enabled",
  );
});
