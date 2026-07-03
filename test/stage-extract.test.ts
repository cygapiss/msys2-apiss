import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { makeRunLogger } from "./make-run-logger.ts";
import { makeMsys2Stage } from "./make-msys2-stage.ts";

const harnessPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "stage-extract-harness.ts",
);

function runStageExtractHarness(caseName: string, ciRoot: string) {
  return spawnSync(process.execPath, [harnessPath, caseName, ciRoot], {
    encoding: "utf-8",
    env: process.env,
  });
}

test("parseExtractBatArchiveName reads MSYS2_STAGE_EXTRACT_ARCHIVE from extract.bat", async () => {
  const { parseExtractBatArchiveName } =
    await import("../scripts/stage-extract.ts");

  assert.equal(
    parseExtractBatArchiveName(
      '  set "MSYS2_STAGE_EXTRACT_ARCHIVE=msys2-base-x86_64-20260629-full.tar"',
    ),
    "msys2-base-x86_64-20260629-full.tar",
  );
  assert.equal(
    parseExtractBatArchiveName(
      'set "MSYS2_STAGE_EXTRACT_ARCHIVE=%~1"\r\nif not defined MSYS2_STAGE_EXTRACT_ARCHIVE (\r\n  set "MSYS2_STAGE_EXTRACT_ARCHIVE=stage3-full.tar"\r\n)\r\n',
    ),
    "stage3-full.tar",
  );
  assert.equal(parseExtractBatArchiveName("echo no archive here"), null);
});

test("writeExtractBat content is readable by parseExtractBatArchiveName", async () => {
  const { parseExtractBatArchiveName, writeExtractBat } =
    await import("../scripts/stage-extract.ts");
  const dir = await mkdtemp(path.join(tmpdir(), "extract-bat-roundtrip-"));
  const filename = "msys2-base-x86_64-20251213-full.tar";
  const stage = { ...makeMsys2Stage("stage1"), stageRoot: dir };
  await writeExtractBat(makeRunLogger(), stage, filename);
  const extract_bat = await readFile(path.join(stage.stageRoot, "extract.bat"), "utf-8");
  assert.equal(parseExtractBatArchiveName(extract_bat), filename);
});

test("extractMsys2FromStageArchive runs tar -xf into target stage", async () => {
  const ciRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-stage-extract-"));
  const result = runStageExtractHarness("success", ciRoot);
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});

test("extractMsys2FromStageArchive throws when extract.bat has no MSYS2_STAGE_EXTRACT_ARCHIVE", async () => {
  const ciRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-stage-extract-"));
  const result = runStageExtractHarness("no-tar-line", ciRoot);
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});

test("extractMsys2FromStageArchive throws when source archive is missing", async () => {
  const ciRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-stage-extract-"));
  const result = runStageExtractHarness("missing-archive", ciRoot);
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});

test("extractMsys2FromStageArchive throws when tar does not create msys64", async () => {
  const ciRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-stage-extract-"));
  const result = runStageExtractHarness("tar-missing-msys64", ciRoot);
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
});
