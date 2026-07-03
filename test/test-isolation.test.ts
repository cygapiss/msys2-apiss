import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { DEFAULT_CI_TOOLS_ROOT } from "../scripts/build-config.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));

const INIT_MSYS64_STAGE_IMPORT_PATTERN =
  /import\s*\{[^}]*\binitMsys2Stage\b[^}]*\}\s*from\s+["'][^"']*utils\.ts["']/;

function hasDirectInitMsys2StageCall(content: string): boolean {
  for (const line of content.split(/\r?\n/)) {
    if (/get\s+initMsys2Stage\s*\(/.test(line)) {
      continue;
    }
    if (/^\s*(?:const|let|var)\s+\w+.*=.*\/.*initMsys2Stage/.test(line)) {
      continue;
    }
    if (/\binitMsys2Stage\s*\(/.test(line)) {
      return true;
    }
  }
  return false;
}

async function listTestSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTestSourceFiles(full)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

test("CI_TOOLS_ROOT is pinned away from the production default", () => {
  assert.notEqual(process.env.CI_TOOLS_ROOT, DEFAULT_CI_TOOLS_ROOT);
  assert.match(process.env.CI_TOOLS_ROOT ?? "", /msys64-test-ci-root-/);
});

test("test sources do not call initMsys2Stage directly", async () => {
  const files = await listTestSourceFiles(testDir);
  const violations: string[] = [];
  for (const file of files) {
    const content = await readFile(file, "utf-8");
    if (
      INIT_MSYS64_STAGE_IMPORT_PATTERN.test(content) ||
      hasDirectInitMsys2StageCall(content)
    ) {
      violations.push(path.relative(testDir, file));
    }
  }
  assert.deepEqual(
    violations,
    [],
    `use makeMsys2Stage or mock initMsys2Stage instead of calling it directly: ${violations.join(", ")}`,
  );
});
