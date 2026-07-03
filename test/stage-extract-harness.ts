import assert from "node:assert/strict";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { mock } from "node:test";
import { makeMsys2Stage } from "./make-msys2-stage.ts";
import { makeRunLogger } from "./make-run-logger.ts";

const caseName = process.argv[2];
const ciRoot = process.argv[3];
if (!caseName || !ciRoot) {
  console.error("usage: stage-extract-harness.ts <case> <ciRoot>");
  process.exit(2);
}

process.env.CI_TOOLS_ROOT = ciRoot;

const sourceStageDir = path.join(ciRoot, "msys64-stage3");
const targetStageDir = path.join(ciRoot, "msys64-stage3-mingw64");
const archiveName = "msys2-base-test-full.tar";
const archivePath = path.join(sourceStageDir, archiveName);
const msys2Root = path.join(targetStageDir, "msys64");
const hostTar = path.join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "tar.exe",
);
const logLabel = "stage3-mingw64";

function makeStepRun(
  tarHandler: (
    command: string,
    args: string[],
  ) => Promise<{ stdout: string; stderr: string; code: number }>,
) {
  return mock.fn(async (command: string, args: string[]) => {
    if (command.toLowerCase().includes("powershell")) {
      return { stdout: "", stderr: "", code: 0 };
    }
    return tarHandler(command, args);
  });
}

function extractBatWithArchive(archiveName: string) {
  return [
    'set "MSYS2_STAGE_EXTRACT_ARCHIVE=%~1"',
    "if not defined MSYS2_STAGE_EXTRACT_ARCHIVE (",
    `  set "MSYS2_STAGE_EXTRACT_ARCHIVE=${archiveName}"`,
    ")",
    "",
  ].join("\r\n");
}

async function setupExtractBat(content: string, includeArchive = true) {
  await mkdir(sourceStageDir, { recursive: true });
  await writeFile(path.join(sourceStageDir, "extract.bat"), content, "utf-8");
  if (includeArchive) {
    await writeFile(archivePath, "placeholder", "utf-8");
  }
}

const { extractMsys2FromStageArchive } =
  await import("../scripts/stage-extract.ts");

const sourceStage = { ...makeMsys2Stage("stage3"), stageRoot: sourceStageDir };
const targetStage = {
  ...makeMsys2Stage("stage3-mingw64"),
  stageRoot: targetStageDir,
};

function runStageExtract(step: ReturnType<typeof makeRunLogger>) {
  return extractMsys2FromStageArchive(
    step,
    sourceStage,
    targetStage,
    logLabel,
  );
}

try {
  if (caseName === "success") {
    await setupExtractBat(extractBatWithArchive(archiveName));
    const step = makeRunLogger({
      run: makeStepRun(async (command, args) => {
        assert.equal(command, hostTar);
        assert.deepEqual(args, ["-xf", archivePath]);
        await mkdir(path.join(msys2Root, "usr", "bin"), { recursive: true });
        return { stdout: "", stderr: "", code: 0 };
      }),
    });
    await runStageExtract(step);
    await access(path.join(msys2Root, "usr", "bin"));
  } else if (caseName === "no-tar-line") {
    await setupExtractBat("echo no tar\r\n", false);
    await assert.rejects(
      () =>
        runStageExtract(
          makeRunLogger({
            run: makeStepRun(async () => ({
              stdout: "",
              stderr: "",
              code: 0,
            })),
          }),
        ),
      /No MSYS2_STAGE_EXTRACT_ARCHIVE in/,
    );
  } else if (caseName === "missing-archive") {
    await setupExtractBat(extractBatWithArchive(archiveName), false);
    await assert.rejects(
      () =>
        runStageExtract(
          makeRunLogger({
            run: makeStepRun(async () => ({
              stdout: "",
              stderr: "",
              code: 0,
            })),
          }),
        ),
      /Archive not found/,
    );
  } else if (caseName === "tar-missing-msys64") {
    await setupExtractBat(extractBatWithArchive(archiveName));
    await assert.rejects(
      () =>
        runStageExtract(
          makeRunLogger({
            run: makeStepRun(async () => ({
              stdout: "",
              stderr: "",
              code: 0,
            })),
          }),
        ),
      /tar -xf did not create/,
    );
  } else {
    throw new Error(`unknown stage-extract harness case: ${caseName}`);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await rm(ciRoot, { recursive: true, force: true });
}
