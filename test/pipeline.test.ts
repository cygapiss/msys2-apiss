import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findPipelineStepIndex,
  parseFromArg,
  pipelines,
  resolveFromStep,
  resolvePipelineNextIndex,
} from "../scripts/pipeline.ts";
import {
  isUsrBinPath,
  isValidDllName,
  isWhitelistedDllName,
} from "../scripts/stage-deps-check.ts";

function pipelineStepId(index: number) {
  return pipelines[index].id;
}

function validatePipelineNextSteps() {
  for (const item of pipelines) {
    if (item.nextStep && findPipelineStepIndex(item.nextStep) < 0) {
      throw new Error(`Unknown nextStep ${item.nextStep} for ${item.id}`);
    }
  }
}

test("validatePipelineNextSteps accepts all configured nextStep ids", () => {
  assert.doesNotThrow(() => validatePipelineNextSteps());
});

test("stage1-install-prep skips extract and advances to generate-deps-json", () => {
  const installPrep = findPipelineStepIndex("stage1-install-prep");
  const extract = findPipelineStepIndex("stage1-extract");
  const generateDeps = findPipelineStepIndex("stage1-generate-deps-json");

  assert.ok(installPrep >= 0);
  assert.ok(extract >= 0);
  assert.equal(resolvePipelineNextIndex(installPrep), generateDeps);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(installPrep)),
    "stage1-generate-deps-json",
  );
  assert.notEqual(resolvePipelineNextIndex(installPrep), extract);
  assert.equal(resolvePipelineNextIndex(extract), generateDeps);
});

test("stage2-install-prep skips extract and runs deps check first", () => {
  const installPrep = findPipelineStepIndex("stage2-install-prep");
  const extract = findPipelineStepIndex("stage2-extract");
  const depsCheck = findPipelineStepIndex("stage2-deps-check");

  assert.ok(installPrep >= 0);
  assert.ok(extract >= 0);
  assert.ok(depsCheck >= 0);
  assert.equal(resolvePipelineNextIndex(installPrep), depsCheck);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(installPrep)),
    "stage2-deps-check",
  );
  assert.notEqual(resolvePipelineNextIndex(installPrep), extract);
  assert.equal(resolvePipelineNextIndex(extract), depsCheck);
});

test("stage3-install-prep advances to deps check (extract is optional)", () => {
  const installPrep = findPipelineStepIndex("stage3-install-prep");
  const extract = findPipelineStepIndex("stage3-extract");
  const depsCheck = findPipelineStepIndex("stage3-deps-check");

  assert.equal(resolvePipelineNextIndex(installPrep), depsCheck);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(installPrep)),
    "stage3-deps-check",
  );
  assert.notEqual(resolvePipelineNextIndex(installPrep), extract);
});

test("stage3-extract advances to cygwin deps check before mingw prep", () => {
  const extract = findPipelineStepIndex("stage3-extract");
  const depsCheck = findPipelineStepIndex("stage3-deps-check");
  const mingwPrep = findPipelineStepIndex("stage3-mingw64-prep");

  assert.equal(resolvePipelineNextIndex(extract), depsCheck);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(extract)),
    "stage3-deps-check",
  );
  assert.notEqual(resolvePipelineNextIndex(extract), mingwPrep);
});

test("stage3-deps-check runs before mingw prep", () => {
  const depsCheck = findPipelineStepIndex("stage3-deps-check");
  const mingwPrep = findPipelineStepIndex("stage3-mingw64-prep");

  assert.equal(resolvePipelineNextIndex(depsCheck), mingwPrep);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(depsCheck)),
    "stage3-mingw64-prep",
  );
});

test("stage3-mingw64 prep through archive chain advances in order", () => {
  const mingwPrep = findPipelineStepIndex("stage3-mingw64-prep");
  const mingwInstall = findPipelineStepIndex("stage3-mingw64-install");
  const mingwListBuild = findPipelineStepIndex("stage3-mingw64-list-build");
  const mingwBuiltInstall = findPipelineStepIndex("stage3-mingw64-list-install");
  const mingwArchive = findPipelineStepIndex("stage3-mingw64-archive");
  const finished = findPipelineStepIndex("stage-all-finished");

  assert.ok(mingwPrep >= 0);
  assert.ok(mingwInstall >= 0);
  assert.ok(mingwListBuild >= 0);
  assert.ok(mingwBuiltInstall >= 0);
  assert.ok(mingwArchive >= 0);
  assert.ok(mingwInstall > mingwPrep);
  assert.ok(mingwListBuild > mingwInstall);
  assert.ok(mingwBuiltInstall > mingwListBuild);
  assert.ok(mingwArchive > mingwBuiltInstall);
  assert.equal(resolvePipelineNextIndex(mingwPrep), mingwInstall);
  assert.equal(resolvePipelineNextIndex(mingwInstall), mingwListBuild);
  assert.equal(resolvePipelineNextIndex(mingwListBuild), mingwBuiltInstall);
  assert.equal(resolvePipelineNextIndex(mingwBuiltInstall), mingwArchive);
  assert.equal(resolvePipelineNextIndex(mingwArchive), finished);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(mingwPrep)),
    "stage3-mingw64-install",
  );
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(mingwInstall)),
    "stage3-mingw64-list-build",
  );
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(mingwListBuild)),
    "stage3-mingw64-list-install",
  );
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(mingwBuiltInstall)),
    "stage3-mingw64-archive",
  );
});

test("stage3-mingw64-archive skips optional extract and runs stage-all-finished", () => {
  const mingwArchive = findPipelineStepIndex("stage3-mingw64-archive");
  const mingwExtract = findPipelineStepIndex("stage3-mingw64-extract");
  const allFinished = findPipelineStepIndex("stage-all-finished");

  assert.ok(mingwArchive >= 0);
  assert.ok(mingwExtract >= 0);
  assert.ok(allFinished >= 0);
  assert.ok(mingwExtract > mingwArchive);
  assert.equal(resolvePipelineNextIndex(mingwArchive), allFinished);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(mingwArchive)),
    "stage-all-finished",
  );
  assert.notEqual(resolvePipelineNextIndex(mingwArchive), mingwExtract);
});

test("stage3-mingw64-extract advances to stage-all-finished", () => {
  const mingwExtract = findPipelineStepIndex("stage3-mingw64-extract");
  const allFinished = findPipelineStepIndex("stage-all-finished");

  assert.equal(resolvePipelineNextIndex(mingwExtract), allFinished);
  assert.equal(
    pipelineStepId(resolvePipelineNextIndex(mingwExtract)),
    "stage-all-finished",
  );
});

test("pipeline has stage3 mingw install, build, built install, archive, and optional extract", () => {
  assert.ok(findPipelineStepIndex("stage3-mingw64-install") >= 0);
  assert.ok(findPipelineStepIndex("stage3-mingw64-prep") >= 0);
  assert.ok(findPipelineStepIndex("stage3-mingw64-list-build") >= 0);
  assert.ok(findPipelineStepIndex("stage3-mingw64-list-install") >= 0);
  assert.ok(findPipelineStepIndex("stage3-mingw64-archive") >= 0);
  assert.ok(findPipelineStepIndex("stage3-mingw64-extract") >= 0);
  assert.equal(findPipelineStepIndex("stage3-mingw64-pacman-archive"), -1);
  assert.equal(findPipelineStepIndex("stage3-mingw64-build"), -1);
});

test("resolveFromStep accepts group numbers", () => {
  assert.equal(resolveFromStep("9"), "stage2-list-build");
  assert.equal(resolveFromStep("10"), "stage3-install-prep");
  assert.equal(resolveFromStep("11"), "stage3-extract");
  assert.equal(resolveFromStep("12"), "stage-all-finished");
});

test("parseFromArg splits step and package", () => {
  assert.deepEqual(parseFromArg("stage1-list-build,gcc"), {
    stepId: "stage1-list-build",
    fromPackage: "gcc",
  });
});

test("parseFromArg rejects unknown step ids", () => {
  assert.throws(
    () => parseFromArg("stage1-list,gcc"),
    /Unknown pipeline step: stage1-list/,
  );
});

test("isValidDllName accepts cyg DLLs and whitelisted /usr/bin names", () => {
  assert.equal(isValidDllName("/usr/bin/cygwin1.dll", "cygwin1.dll"), true);
  assert.equal(isValidDllName("/usr/bin/libexpect.dll", "libexpect.dll"), true);
  assert.equal(isValidDllName("/usr/lib/foo.dll", "foo.dll"), false);
});

test("isWhitelistedDllName only applies to /usr/bin via isValidDllName", () => {
  assert.equal(isWhitelistedDllName("libfdt.dll"), true);
  assert.equal(isWhitelistedDllName("not-a-dll"), false);
  assert.equal(isUsrBinPath("/usr/bin/bash.exe"), true);
  assert.equal(isUsrBinPath("/usr/lib/cygfoo.dll"), false);
});
