import { appendFileSync, mkdirSync, mkdtempSync } from "node:fs";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  MSYS2_BASE_INSTALLED_TARBALL,
  MSYS2_BASE_TARBALL,
  MSYS64_CACHES_DIR_NAME,
  MSYS64_DIR_NAME,
  MSYS_BASH_ENV,
  type Msys2StageTreeId,
} from "../scripts/build-config.ts";
import type { Msys2Stage } from "../scripts/utils.ts";
import { repoRoot } from "../scripts/utils.ts";

const MSYS64_TEST_CACHE_ROOTS_MANIFEST = path.join(
  tmpdir(),
  "msys64-test-cache-roots.txt",
);

export async function initMsys2StageCacheTracking() {
  await fs.writeFile(MSYS64_TEST_CACHE_ROOTS_MANIFEST, "");
  const pinnedCiToolsRoot = mkdtempSync(
    path.join(tmpdir(), "msys64-test-ci-root-"),
  );
  process.env.CI_TOOLS_ROOT = pinnedCiToolsRoot;
  registerTestCacheRoot(pinnedCiToolsRoot);
}

function registerTestCacheRoot(cacheRoot: string) {
  appendFileSync(MSYS64_TEST_CACHE_ROOTS_MANIFEST, `${cacheRoot}\n`, "utf-8");
}

export async function teardownMsys2StageCaches() {
  let raw = "";
  try {
    raw = await fs.readFile(MSYS64_TEST_CACHE_ROOTS_MANIFEST, "utf-8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return;
    }
    throw error;
  }
  for (const cacheRoot of raw.split(/\r?\n/).filter(Boolean)) {
    await fs.rm(cacheRoot, { recursive: true, force: true });
  }
  await fs.rm(MSYS64_TEST_CACHE_ROOTS_MANIFEST, { force: true });
}

export function makeMsys2Stage(
  stageId: Msys2StageTreeId = "stage1",
  env: NodeJS.ProcessEnv = {},
): Msys2Stage {
  const ciToolsBase = mkdtempSync(
    path.join(tmpdir(), `msys64-test-${stageId}-`),
  );
  const stageRoot = path.join(ciToolsBase, `msys64-${stageId}`);
  mkdirSync(stageRoot, { recursive: true });
  const msys2Root = path.join(stageRoot, MSYS64_DIR_NAME);
  const cacheRoot = path.join(ciToolsBase, MSYS64_CACHES_DIR_NAME);
  mkdirSync(cacheRoot, { recursive: true });
  registerTestCacheRoot(ciToolsBase);
  const cache_msys64_root = path.join(cacheRoot, MSYS64_DIR_NAME);
  return {
    repoRoot,
    stageRoot,
    ciToolsBase,
    msys2Root,
    home: path.join(msys2Root, "home"),
    pacmanPkg: path.join(msys2Root, "var", "cache", "pacman", "pkg"),
    sharedHome: path.join(cache_msys64_root, "home"),
    sharedPacmanPkg: path.join(
      cache_msys64_root,
      "var",
      "cache",
      "pacman",
      "pkg",
    ),
    cacheRoot,
    baseTarball: path.join(cacheRoot, MSYS2_BASE_TARBALL),
    baseInstalledTarball: path.join(cacheRoot, MSYS2_BASE_INSTALLED_TARBALL),
    baseInstalledMsysTxt: path.join(msys2Root, "msys.txt"),
    bash: path.join(msys2Root, "usr", "bin", "bash.exe"),
    dash: path.join(msys2Root, "usr", "bin", "dash.exe"),
    cygpath: path.join(msys2Root, "usr", "bin", "cygpath.exe"),
    pactree: path.join(msys2Root, "usr", "bin", "pactree.exe"),
    pacman: path.join(msys2Root, "usr", "bin", "pacman.exe"),
    ldd: path.join(msys2Root, "usr", "bin", "ldd.exe"),
    tar: path.join(msys2Root, "usr", "bin", "tar.exe"),
    env: { ...MSYS_BASH_ENV, ...env },
  };
}
