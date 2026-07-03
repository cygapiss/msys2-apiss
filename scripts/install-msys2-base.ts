import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  MSYS64_DIR_NAME,
  pacman_excluded_packages,
} from "./build-config.ts";
import {
  ensureMsys2BaseTarballCached,
  linkMsys2Cache,
  unlinkMsys2Cache,
} from "./msys2-cache.ts";
import { removeTreeWithKillRetry } from "./kill-tree-processes.ts";
import type { RunLogger } from "./run-context.ts";
import { writeStageExtractBats } from "./stage-extract.ts";
import {
  assertMsys2Root,
  cygpathUnix,
  fsExistsAsync,
  hostTarPath,
  type Msys2Stage,
} from "./utils.ts";

export function getYYYYMMDD(date: Date) {
  const year = date.getFullYear();
  let month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
  let day = date.getDate().toString();

  // Pad month and day with a leading zero if single digit
  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return year + month + day;
}

// Node spawn has no TTY; pacman still prompts on corrupted cache files and
// treats EOF as No even with --noconfirm. Pipe a bounded yes stream so delete-it
// queries get Y without exhausting Cygwin process slots.
export function wrapPacmanNonInteractiveCommand(install_command: string) {
  return `{ yes 2>/dev/null; } | head -n 64 | { ${install_command}; }`;
}

export async function executePacmanInstall(
  step: RunLogger,
  stage: Msys2Stage,
  install_commands: readonly string[],
  cwd: string,
) {
  const db_lock = path.join(stage.msys2Root, "var", "lib", "pacman", "db.lck");
  for (const install_command of install_commands) {
    await fs.rm(db_lock, { force: true, recursive: true });
    const wrapped_command = wrapPacmanNonInteractiveCommand(install_command);
    step.log(
      `===Execute: "${install_command}" at msys2Root:${stage.msys2Root} cwd: ${cwd}`,
    );
    const { code } = await step.run(
      stage.bash,
      ["--login", "-c", wrapped_command],
      {
        cwd: cwd,
        exitOnFailure: false,
        env: stage.env,
      },
    );
    if (code !== 0) {
      throw new Error(
        `executePacmanInstall failed (${code}): ${install_command}`,
      );
    }
  }
}

export function msys64FullArchiveFilename(
  date = new Date(),
) {
  return `msys2-installed-x86_64-${getYYYYMMDD(date)}.tar`;
}

export async function archiveFull(
  step: RunLogger,
  stage: Msys2Stage,
  target_msys_tar_path: string,
  stage_label?: string,
) {
  const target_msys_tar_path_cygwin = await cygpathUnix(
    step,
    stage,
    target_msys_tar_path,
  );
  step.log(`===Compress msys64 into ${target_msys_tar_path}`);
  try {
    await fs.rm(target_msys_tar_path, { force: true, recursive: true });
  } catch (e) {
    step.log(`remove ${target_msys_tar_path} failed with: ${e}`);
  }

  await unlinkMsys2Cache(step, stage);
  await step.run(
    stage.tar,
    ["cf", target_msys_tar_path_cygwin, MSYS64_DIR_NAME],
    {
      cwd: stage.stageRoot,
      env: stage.env,
    },
  );
  if (stage_label === undefined) {
    return;
  }
  const msys2_archive_filename = path.basename(target_msys_tar_path);
  step.log(`===${stage_label}: Archive finished as: ${msys2_archive_filename}`);
  await linkMsys2Cache(step, stage);
  await writeStageExtractBats(step, stage, msys2_archive_filename);
  step.log(
    `===${stage_label}: Wrote extract.bat and delete-msys64.bat`,
  );
}

export async function clearMsys2(step: RunLogger, stage: Msys2Stage) {
  step.log(`===clearMsys2 at ${stage.msys2Root}`);
  if (!(await fsExistsAsync(stage.msys2Root))) {
    return;
  }
  step.log(`===Backup and unlink MSYS2 cache before removing ${stage.msys2Root}`);
  // Mainly for recover the home and pacman pkg directories.
  // And backup the pacman pkg directory to the shared directory.
  // So the unlinkMsys2Cache won't cause downloaded packages to be lost.
  await linkMsys2Cache(step, stage);

  await unlinkMsys2Cache(step, stage);
  await removeTreeWithKillRetry(
    step,
    stage.msys2Root,
    [stage.stageRoot],
  );
}

async function msysPackageListContent(
  step: RunLogger,
  stage: Msys2Stage,
): Promise<string> {
  const msys_list_capture = await step.run(
    stage.pacman,
    ["-Sl", "msys"],
    { capture: true },
  );
  const packages = [];
  for (let pkg of msys_list_capture.stdout.trim().split("\n")) {
    const pkg_name = pkg.trim().split(/\s+/)[1];
    if (!pkg_name) continue;
    if (pacman_excluded_packages.has(pkg_name)) continue;
    packages.push(pkg_name);
  }
  return packages.join("\n");
}

export async function installMsys2Base(
  step: RunLogger,
  stage: Msys2Stage,
  enable_clear_msys64: boolean,
): Promise<boolean> {
  let has_msys64 = false;
  if (!enable_clear_msys64) {
    try {
      await assertMsys2Root(step, stage, "installMsys2Base");
      has_msys64 = true;
    } catch {
      // missing or broken; clear below
    }
  }
  if (!has_msys64) {
    await clearMsys2(step, stage);
  }

  step.log(`===Init env at ${stage.msys2Root} (has_msys64: ${has_msys64})`);
  if (!has_msys64) {
    await ensureMsys2BaseTarballCached(step, stage);
    if (await fsExistsAsync(stage.baseInstalledTarball)) {
      step.log(
        `===Restoring MSYS2 base packages from cache ${stage.baseInstalledTarball}`,
      );
      const { code } = await step.run(
        hostTarPath(),
        ["-xf", stage.baseInstalledTarball],
        {
          cwd: stage.stageRoot,
          exitOnFailure: false,
        },
      );
      if (code !== 0) {
        throw new Error(
          `Failed to restore MSYS2 base packages from cache (${code}): ${stage.baseInstalledTarball}`,
        );
      }
      step.log("===Restore MSYS2 base packages from cache finished\n");
      return false;
    }
    step.log(`===Extracting base`);
    await step.run("tar", ["xf", stage.baseTarball], {
      cwd: stage.stageRoot,
    });
    step.log("===Extract base finished\n");
  }

  // Upgrading pacman itself mishandles a symlinked pkg cache, so use local
  // home and var/cache/pacman/pkg dirs for sync and the pacman package only.
  await unlinkMsys2Cache(step, stage);
  step.log(`===Repo sync and pacman upgrade at ${stage.msys2Root}`);
  // Self-upgrade in one -S transaction breaks the info post-transaction hook
  // (db.lck / fork). Each command runs in its own bash process.
  await executePacmanInstall(
    step,
    stage,
    [
      "pacman -Sy --noconfirm",
      "pacman -S --noconfirm --needed pacman",
    ],
    stage.msys2Root,
  );
  // Merge downloads into the shared cache and symlink home/pkg so core
  // upgrade and pacman -Syu reuse cached packages.
  await linkMsys2Cache(step, stage);

  step.log(`===Core and full upgrade at ${stage.msys2Root}`);
  // MSYS2 has no pacman "core" group, so install bash/filesystem/mintty/
  // msys2-runtime/pacman-mirrors explicitly first. Other packages will not
  // upgrade on -Syu until those core runtime packages are upgraded.
  await executePacmanInstall(
    step,
    stage,
    [
      "pacman -S --noconfirm --needed bash filesystem mintty msys2-runtime pacman-mirrors",
      "pacman -Syu --noconfirm",
    ],
    stage.msys2Root,
  );
  step.log(`===Core and full upgrade finished at ${stage.msys2Root}`);

  await fs.writeFile(
    stage.baseInstalledMsysTxt,
    await msysPackageListContent(step, stage),
    "utf-8",
  );
  await fs.mkdir(path.dirname(stage.baseInstalledTarball), { recursive: true });
  step.log(`===Caching MSYS2 base packages to ${stage.baseInstalledTarball}`);
  await archiveFull(step, stage, stage.baseInstalledTarball);
  step.log("===Cache MSYS2 base packages finished");
  return true;
}
