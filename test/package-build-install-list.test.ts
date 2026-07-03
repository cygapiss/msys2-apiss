import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  clearInstallPackageList,
  readPackageList,
} from "../scripts/package-build-pipeline.ts";
import { pacman_excluded_packages } from "../scripts/build-config.ts";

test("pacman_excluded_packages skips packages_conflict ports", () => {
  assert.equal(pacman_excluded_packages.has("uutils-coreutils"), true);
  assert.equal(pacman_excluded_packages.has("gcc"), false);
});

test("readPackageList skips blanks and comments", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cygwin-pkg-list-"));
  const listPath = join(dir, "list.txt");
  await writeFile(
    listPath,
    "# comment\n\ngcc\n\nbash\n",
    "utf-8",
  );
  assert.deepEqual(await readPackageList(listPath), ["gcc", "bash"]);
});

test("clearInstallPackageList writes an empty file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cygwin-pkg-clear-"));
  const listPath = join(dir, "stage2-install.txt");
  await writeFile(listPath, "gcc-1-1-x86_64.pkg.tar.zst\n", "utf-8");
  await clearInstallPackageList(listPath);
  assert.deepEqual(await readPackageList(listPath), []);
});
