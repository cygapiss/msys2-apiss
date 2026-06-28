import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  findNewestDirectFileMtime,
  parseArgv,
  updateFolderTimeFromNewestFile,
} from "../scripts/update-folder-times.ts";

async function setMtime(filePath: string, mtimeMs: number) {
  const date = new Date(mtimeMs);
  await utimes(filePath, date, date);
}

describe("update-folder-times", () => {
  describe("parseArgv", () => {
    it("requires a folder argument", () => {
      const missing = parseArgv([]);
      assert.equal(missing.kind, "error");
      if (missing.kind === "error") {
        assert.match(missing.message, /Missing required argument/);
      }
    });

    it("parses a folder path and help", () => {
      assert.deepEqual(parseArgv(["C:\\logs"]), {
        kind: "ok",
        folderPath: "C:\\logs",
      });
      assert.deepEqual(parseArgv(["-h"]), { kind: "help" });
    });

    it("returns errors for unknown or extra arguments", () => {
      const unknown = parseArgv(["--unknown", "logs"]);
      assert.equal(unknown.kind, "error");
      if (unknown.kind === "error") {
        assert.match(unknown.message, /Unknown argument/);
      }

      const extra = parseArgv(["logs", "extra"]);
      assert.equal(extra.kind, "error");
      if (extra.kind === "error") {
        assert.match(extra.message, /Unexpected extra argument/);
      }
    });
  });

  describe("findNewestDirectFileMtime", () => {
    it("returns undefined when a directory has no direct files", async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), "update-folder-times-"));
      try {
        assert.equal(await findNewestDirectFileMtime(tempDir), undefined);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("returns the newest direct file mtime", async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), "update-folder-times-"));
      try {
        const older = path.join(tempDir, "older.txt");
        const newer = path.join(tempDir, "newer.txt");
        await writeFile(older, "old\n");
        await writeFile(newer, "new\n");
        await setMtime(older, Date.parse("2020-01-01T00:00:00.000Z"));
        await setMtime(newer, Date.parse("2024-06-01T00:00:00.000Z"));

        assert.equal(
          await findNewestDirectFileMtime(tempDir),
          Date.parse("2024-06-01T00:00:00.000Z"),
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("updateFolderTimeFromNewestFile", () => {
    it("updates a folder from its newest direct file only", async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), "update-folder-times-"));
      try {
        const subDir = path.join(tempDir, "sub");
        await mkdir(subDir);
        const parentFile = path.join(tempDir, "parent.txt");
        const subFile = path.join(subDir, "sub.txt");
        await writeFile(parentFile, "parent\n");
        await writeFile(subFile, "sub\n");

        const parentMtime = Date.parse("2022-01-01T00:00:00.000Z");
        const subMtime = Date.parse("2025-01-01T00:00:00.000Z");
        await setMtime(parentFile, parentMtime);
        await setMtime(subFile, subMtime);
        await setMtime(tempDir, Date.parse("2019-01-01T00:00:00.000Z"));
        await setMtime(subDir, Date.parse("2019-01-01T00:00:00.000Z"));

        await updateFolderTimeFromNewestFile(tempDir);

        const parentStat = await stat(tempDir);
        const subStat = await stat(subDir);
        assert.equal(parentStat.mtimeMs, parentMtime);
        assert.equal(subStat.mtimeMs, subMtime);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("leaves file-less directories unchanged", async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), "update-folder-times-"));
      try {
        const emptyDir = path.join(tempDir, "empty");
        await mkdir(emptyDir);
        const unchangedMtime = Date.parse("2018-05-05T00:00:00.000Z");
        await setMtime(emptyDir, unchangedMtime);

        await updateFolderTimeFromNewestFile(tempDir);

        const emptyStat = await stat(emptyDir);
        assert.equal(emptyStat.mtimeMs, unchangedMtime);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
