import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PATCHES_DIR,
  gitAmArgs,
  gitApplyCheckArgs,
  parseArgv,
  porcelainPath,
  readFormatPatchCommitMessage,
  readFormatPatchPaths,
  resolvePatchEntriesFrom,
} from "../scripts/apply-ports-patch.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..");
const fixtureRoot = path.join(testDir, "fixtures", "apply-ports-patch");

describe("apply-ports-patch", () => {
  describe("parseArgv", () => {
    it("defaults patch to undefined and portsDir to ports", () => {
      assert.deepEqual(parseArgv([]), {
        kind: "ok",
        dryRun: false,
        patch: undefined,
        portsDir: "ports",
      });
    });

    it("parses dry-run, patch, and ports-dir options", () => {
      assert.deepEqual(parseArgv(["--dry-run", "--patch", "patches/foo.patch"]), {
        kind: "ok",
        dryRun: true,
        patch: "patches/foo.patch",
        portsDir: "ports",
      });
      assert.deepEqual(parseArgv(["--ports-dir", "ports-mingw", "patches"]), {
        kind: "ok",
        dryRun: false,
        patch: "patches",
        portsDir: "ports-mingw",
      });
    });

    it("returns help for -h and --help", () => {
      assert.deepEqual(parseArgv(["-h"]), { kind: "help" });
      assert.deepEqual(parseArgv(["--help"]), { kind: "help" });
    });

    it("returns errors for invalid input", () => {
      const missingPatch = parseArgv(["--patch"]);
      assert.equal(missingPatch.kind, "error");
      if (missingPatch.kind === "error") {
        assert.match(missingPatch.message, /Missing value for --patch/);
      }

      const invalidPortsDir = parseArgv(["--ports-dir", "invalid"]);
      assert.equal(invalidPortsDir.kind, "error");
      if (invalidPortsDir.kind === "error") {
        assert.match(invalidPortsDir.message, /Invalid --ports-dir value/);
      }

      const unknownArg = parseArgv(["--unknown"]);
      assert.equal(unknownArg.kind, "error");
      if (unknownArg.kind === "error") {
        assert.match(unknownArg.message, /Unknown argument/);
      }

      const extraArg = parseArgv(["a.patch", "b.patch"]);
      assert.equal(extraArg.kind, "error");
      if (extraArg.kind === "error") {
        assert.match(extraArg.message, /Unexpected extra argument/);
      }

      const duplicatePatch = parseArgv(["--patch", "a.patch", "b.patch"]);
      assert.equal(duplicatePatch.kind, "error");
      if (duplicatePatch.kind === "error") {
        assert.match(duplicatePatch.message, /Specify the patch once/);
      }
    });
  });

  describe("porcelainPath", () => {
    it("normalizes rename and quoted paths", () => {
      assert.equal(
        porcelainPath("R  old/name -> new/name"),
        "new/name",
      );
      assert.equal(
        porcelainPath('?? "path/with space"'),
        "path/with space",
      );
      assert.equal(
        porcelainPath(" M ports\\foo\\PKGBUILD"),
        "ports/foo/PKGBUILD",
      );
    });
  });

  describe("readFormatPatchCommitMessage", () => {
    it("reads subject and body from a format-patch file", async () => {
      const patchPath = path.join(fixtureRoot, "sample.patch");
      const message = await readFormatPatchCommitMessage(patchPath);
      assert.equal(message, "[PATCH] sample ports change\nFirst body line.\nSecond body line.");
    });

    it("throws when mbox separator is missing", async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), "apply-ports-patch-"));
      const patchPath = path.join(tempDir, "bad.patch");
      try {
        await writeFile(patchPath, "Subject: [PATCH] no separator\n\nbody\n");
        await assert.rejects(
          () => readFormatPatchCommitMessage(patchPath),
          /patch has no mbox separator/,
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("readFormatPatchPaths", () => {
    it("collects touched paths under the ports directory", async () => {
      const patchPath = path.join(fixtureRoot, "sample.patch");
      const paths = await readFormatPatchPaths(patchPath, "ports-mingw");
      assert.deepEqual([...paths].sort(), [
        "ports-mingw/mingw-w64-foo/PKGBUILD",
      ]);
    });
  });

  describe("resolvePatchEntriesFrom", () => {
    it("resolves a single patch file", async () => {
      const relPath = path
        .join("test", "fixtures", "apply-ports-patch", "sample.patch")
        .replace(/\\/g, "/");
      const entries = await resolvePatchEntriesFrom(repoRoot, relPath);
      assert.equal(entries.length, 1);
      assert.equal(entries[0]?.relPath, relPath);
      assert.equal(
        entries[0]?.absPath,
        path.join(fixtureRoot, "sample.patch"),
      );
    });

    it("resolves and sorts patch files in a directory", async () => {
      const relPath = path
        .join("test", "fixtures", "apply-ports-patch", "patch-dir")
        .replace(/\\/g, "/");
      const entries = await resolvePatchEntriesFrom(repoRoot, relPath);
      assert.deepEqual(
        entries.map((entry) => path.basename(entry.absPath)),
        ["0001-first.patch", "0002-second.patch"],
      );
      assert.equal(entries[0]?.relPath, `${relPath}/0001-first.patch`);
      assert.equal(entries[1]?.relPath, `${relPath}/0002-second.patch`);
    });

    it("throws when patch path is missing", async () => {
      await assert.rejects(
        () => resolvePatchEntriesFrom(repoRoot, "missing/patch.patch"),
        /patch not found:/,
      );
    });

    it("throws when directory has no patch files", async () => {
      const relPath = path
        .join("test", "fixtures", "apply-ports-patch", "empty-dir")
        .replace(/\\/g, "/");
      await assert.rejects(
        () => resolvePatchEntriesFrom(repoRoot, relPath),
        /no \.patch files found in:/,
      );
    });
  });

  it("exports patches as the default directory name", () => {
    assert.equal(DEFAULT_PATCHES_DIR, "patches");
  });

  describe("git command args", () => {
    it("passes --whitespace=nowarn to git apply --check and git am", () => {
      assert.deepEqual(gitApplyCheckArgs("ports", "C:\\patches\\0001.patch"), [
        "apply",
        "--check",
        "--whitespace=nowarn",
        "--directory=ports",
        "--verbose",
        "C:\\patches\\0001.patch",
      ]);
      assert.deepEqual(gitAmArgs("ports-mingw", "C:\\patches\\0001.patch"), [
        "am",
        "--whitespace=nowarn",
        "--directory=ports-mingw",
        "C:\\patches\\0001.patch",
      ]);
    });
  });
});
