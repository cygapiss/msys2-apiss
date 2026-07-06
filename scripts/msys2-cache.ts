import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  MSYS2_BASE_TARBALL,
  MSYS2_BASE_TARBALL_URL,
} from "./build-config.ts";
import type { RunLogger } from "./run-context.ts";
import {
  assertMsys2Root,
  fsExistsAsync,
  hostCurlPath,
  symlinkDirectory,
  unlinkDirectory,
  type Msys2Stage,
} from "./utils.ts";

async function backupPacmanPkgToShared(
  stage: Msys2Stage,
  shared_pkg: string,
  local_pkg: string,
) {
  const db_lock = path.join(stage.msys2Root, "var", "lib", "pacman", "db.lck");
  await fs.rm(db_lock, { force: true, recursive: true });
  await fs.mkdir(shared_pkg, { recursive: true });
  try {
    const stats = await fs.lstat(local_pkg);
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      try {
        await fs.cp(local_pkg, shared_pkg, { recursive: true, force: true });
      } catch {
        // cp -af ... || true
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function linkCacheDirectory(shared: string, local: string) {
  await fs.mkdir(shared, { recursive: true });
  await unlinkDirectory(local);
  await fs.mkdir(path.dirname(local), { recursive: true });
  await symlinkDirectory(shared, local);
}

export async function linkMsys2Cache(
  step: RunLogger,
  stage: Msys2Stage,
) {
  step.log(`===linkMsys2Cache at ${stage.msys2Root}`);
  const shared_home = path.resolve(stage.sharedHome);
  const local_home = path.resolve(stage.home);
  const shared_pkg = path.resolve(stage.sharedPacmanPkg);
  const local_pkg = path.resolve(stage.pacmanPkg);
  await backupPacmanPkgToShared(stage, shared_pkg, local_pkg);
  await linkCacheDirectory(shared_home, local_home);
  await linkCacheDirectory(shared_pkg, local_pkg);
}

export async function unlinkMsys2Cache(
  step: RunLogger,
  stage: Msys2Stage,
) {
  step.log(`===unlinkMsys2Cache at ${stage.msys2Root}`);
  const local_home = path.resolve(stage.home);
  const local_pkg = path.resolve(stage.pacmanPkg);
  await unlinkDirectory(local_home);
  await unlinkDirectory(local_pkg);
  await fs.mkdir(local_home, { recursive: true });
  await assertMsys2Root(step, stage, "installMsys2Base");
  await fs.mkdir(local_pkg, { recursive: true });
  await fs.writeFile(path.join(local_pkg, ".gitignore"), "");
}

export async function ensureMsys2BaseTarballCached(
  step: RunLogger,
  stage: Msys2Stage,
): Promise<void> {
  const cached = stage.baseTarball;
  if (await fsExistsAsync(cached)) {
    step.logFile(`===Using cached MSYS2 base tarball ${cached}`);
    return;
  }
  await fs.mkdir(path.dirname(cached), { recursive: true });
  const stage_local_tarball = path.join(stage.stageRoot, MSYS2_BASE_TARBALL);
  if (await fsExistsAsync(stage_local_tarball)) {
    step.logFile(
      `===Seeding MSYS2 base tarball cache from ${stage_local_tarball}`,
    );
    await fs.copyFile(stage_local_tarball, cached);
    return;
  }
  step.log(`===Downloading MSYS2 base tarball to ${cached}`);
  const { code } = await step.run(
    hostCurlPath(),
    [
      "-fL",
      "--remote-time",
      "--retry",
      "3",
      "--retry-delay",
      "2",
      "-o",
      cached,
      MSYS2_BASE_TARBALL_URL,
    ],
    { exitOnFailure: false },
  );
  if (code !== 0) {
    throw new Error(
      `Failed to download MSYS2 base tarball (${code}): ${MSYS2_BASE_TARBALL_URL}`,
    );
  }
  step.log("===Download MSYS2 base tarball finished");
}
