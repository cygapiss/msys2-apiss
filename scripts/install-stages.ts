import process from "node:process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  DELETE_MSYS64_BAT_FILENAME,
  EXTRACT_BAT_FILENAME,
  GENERATED_MSYS_MINGW64_TXT,
  type Msys2StageId,
  type Msys2StageTreeId,
} from "./build-config.ts";
import {
  MINGW_PACKAGE_PREFIX_DEFAULT,
  mingwInstallPackages,
} from "./mingw-install-list.ts";
import { extractMsys2FromStageArchive } from "./stage-extract.ts";
import {
  executePacmanInstall,
  archiveFull,
  installMsys2Base,
  msys64FullArchiveFilename,
} from "./install-msys2-base.ts";
import { killProcessesWithExecutableUnder } from "./kill-tree-processes.ts";
import { type RunContext, type RunOptions } from "./run-context.ts";
import {
  cygpathUnix,
  generatedTxtPath,
  initMsys2Stage,
  stageRepoPath,
  type Msys2Stage,
} from "./utils.ts";

const cmdExe = process.env.COMSPEC || "C:\\Windows\\System32\\cmd.exe";

// Install all built packages listed in scripts/generated/{stage}-install.txt
// from dist/{stage}/ via a single pacman -U run in that dist directory.
async function installPackages(
  step: RunContext,
  stage: Msys2Stage,
  stageListId: Msys2StageId,
) {
  const installListRel = generatedTxtPath(stageListId, "install");
  const installListPath = stageRepoPath(stage, installListRel);
  try {
    const installListContent = await fs.readFile(installListPath, "utf-8");
    if (installListContent.trim() === "") {
      step.logFile(
        `===installPackages at ${stage.msys2Root}: empty ${installListRel}, nothing to install`,
      );
      return;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing install list: ${installListPath}`);
    }
    throw err;
  }
  const distDir = stageRepoPath(stage, "dist", stageListId);
  const installList_cygwin = await cygpathUnix(
    step,
    stage,
    installListPath,
  );
  step.logFile(
    `===installPackages at ${stage.msys2Root}: all entries from ${installListRel} in ${distDir}`,
  );
  // cwd must be distDir: install.txt lists .tar.* basenames resolved from here.
  await executePacmanInstall(
    step,
    stage,
    [
      `pacman -U --noconfirm --overwrite \\* $(cat ${installList_cygwin})`,
    ],
    distDir,
  );
}

export async function installMsys2AllPackages(
  step: RunContext,
  stage: Msys2Stage,
) {
  const msys_txt_cygwin = await cygpathUnix(
    step,
    stage,
    stage.baseInstalledMsysTxt,
  );

  step.log(`===Installing all packages`);

  await executePacmanInstall(
    step,
    stage,
    [
      `sed -i 's/^SigLevel.*$/SigLevel=Never/g' /etc/pacman.conf`,
      `cat /etc/pacman.conf | grep ^SigLevel`,
      `pacman -S --noconfirm --needed $(cat ${msys_txt_cygwin})`,
    ],
    stage.msys2Root,
  );

  step.log(
    `===Installing all packages finished at ${stage.stageRoot}`,
  );
}

// stage1 install list is run twice on the fresh base tree: the first pacman -U
// may replace msys2-runtime and leave other packages unsatisfied; the second
// pass installs deps that were blocked or skipped on the first pass.
async function installStage1BuiltPackagesTwice(
  step: RunContext,
  stage: Msys2Stage,
) {
  await installPackages(step, stage, "stage1");
  await installPackages(step, stage, "stage1");
}

// Re-extract a stage tree via delete-msys64.bat and extract.bat. extract.bat uses
// Windows cmd tar xf (host tar), not msys64/usr/bin/tar.exe.
export async function extractMsys2Stage(
  step: RunContext,
  stage: Msys2StageTreeId,
) {
  const msys_stage = initMsys2Stage(step, stage);
  await killProcessesWithExecutableUnder(step, [msys_stage.stageRoot]);
  const system_root = process.env.SystemRoot || "C:\\Windows";
  const batch_opts: RunOptions = {
    cwd: msys_stage.stageRoot,
    env: {
      ...process.env,
      CI_TOOLS_ROOT: process.env.CI_TOOLS_ROOT || "D:\\CI-Tools",
      PATH: [
        path.join(system_root, "System32"),
        process.env.PATH || "",
      ].join(path.delimiter),
      CI_TOOLS_DISABLE_PAUSE: "true",
    },
  };
  delete batch_opts.env!.MSYSTEM;
  delete batch_opts.env!.MSYS;
  delete batch_opts.env!.CHERE_INVOKING;
  await step.run(cmdExe, ["/c", DELETE_MSYS64_BAT_FILENAME], batch_opts);
  await step.run(cmdExe, ["/c", EXTRACT_BAT_FILENAME], batch_opts);
}

export async function installStage1(step: RunContext) {
  const msys_stage = initMsys2Stage(step, "stage1");

  await installMsys2Base(step, msys_stage, true);
  await installMsys2AllPackages(step, msys_stage);
  step.log("===stage1: Install all original MSYS2 packages finished");
  await archiveFull(
    step,
    msys_stage,
    path.join(msys_stage.stageRoot, msys64FullArchiveFilename()),
    "stage1",
  );
}

export async function installStage2(step: RunContext) {
  const msys_stage = initMsys2Stage(step, "stage2");

  await installMsys2Base(step, msys_stage, true);
  await installStage1BuiltPackagesTwice(step, msys_stage);
  const stage2_extra_pacman_packages = [
    "mingw-w64-x86_64-python",
    "mingw-w64-x86_64-llvm",
    "mingw-w64-x86_64-clang",
  ];
  await executePacmanInstall(
    step,
    msys_stage,
    [
      `pacman -S --needed --noconfirm --overwrite \\* ${stage2_extra_pacman_packages.join(" ")}`,
    ],
    msys_stage.msys2Root,
  );
  step.log("===stage2: Switch to cygwin only use stage1 packages finished");
  await archiveFull(
    step,
    msys_stage,
    path.join(msys_stage.stageRoot, msys64FullArchiveFilename()),
    "stage2",
  );
}

export async function installStage3(step: RunContext) {
  const msys_stage = initMsys2Stage(step, "stage3");

  await installMsys2Base(step, msys_stage, true);
  await installStage1BuiltPackagesTwice(step, msys_stage);
  await installPackages(step, msys_stage, "stage2");
  step.log("===stage3: Switch all packages to cygwin finished");
  await archiveFull(
    step,
    msys_stage,
    path.join(msys_stage.stageRoot, msys64FullArchiveFilename()),
    "stage3",
  );
}

export async function extractMsys2Stage3MingwFromArchive(step: RunContext) {
  await extractMsys2FromStageArchive(
    step,
    initMsys2Stage(step, "stage3"),
    initMsys2Stage(step, "stage3-mingw64"),
    "stage3-mingw64",
  );
}

export async function installMingwPacmanPackagesStage3(step: RunContext) {
  const msys_stage = initMsys2Stage(step, "stage3-mingw64");
  const packages = mingwInstallPackages(MINGW_PACKAGE_PREFIX_DEFAULT);
  const mingw64_txt_path = stageRepoPath(msys_stage, GENERATED_MSYS_MINGW64_TXT);
  await fs.mkdir(path.dirname(mingw64_txt_path), { recursive: true });
  await fs.writeFile(mingw64_txt_path, packages.join("\n") + "\n", "utf-8");
  const mingw_txt_cygwin = await cygpathUnix(
    step,
    msys_stage,
    mingw64_txt_path,
  );

  await executePacmanInstall(
    step,
    msys_stage,
    [
      `pacman -S --noconfirm --needed $(cat ${mingw_txt_cygwin})`,
    ],
    msys_stage.msys2Root,
  );
  step.log("===stage3-mingw64: Install mingw pacman packages finished");
}

export async function installMingwBuiltPackagesStage3(step: RunContext) {
  const msys_stage = initMsys2Stage(step, "stage3-mingw64");
  await installPackages(step, msys_stage, "stage3-mingw64");
  step.log("===stage3-mingw64: Install built ports-mingw packages finished");
}

export async function archiveMingwStage3(step: RunContext) {
  const msys_stage = initMsys2Stage(step, "stage3-mingw64");
  await archiveFull(
    step,
    msys_stage,
    path.join(msys_stage.stageRoot, msys64FullArchiveFilename()),
    "stage3-mingw64",
  );
}
