import * as path from "path";
import { fileURLToPath } from "url";
import {
  archiveFull,
  executePacmanInstall,
  installMsys2Base,
  msys64FullArchiveFilename,
} from "./scripts/install-msys2-base.ts";
import { cygpathUnix, initMsys2Stage } from "./scripts/utils.ts";

export async function runInstallForStage1(step) {
  const stage1 = initMsys2Stage(step, "stage1");

  await installMsys2Base(step, stage1, true);

  const msys_txt_cygwin = await cygpathUnix(
    step,
    stage1,
    stage1.baseInstalledMsysTxt,
  );

  step.log(`===Installing all packages`);

  const bash_commands_for_install_all = [
    `sed -i 's/^SigLevel.*$/SigLevel=Never/g' /etc/pacman.conf`,
    `cat /etc/pacman.conf | grep ^SigLevel`,
    `pacman -S --noconfirm --needed $(cat ${msys_txt_cygwin})`,
  ];

  await executePacmanInstall(
    step,
    stage1,
    bash_commands_for_install_all,
    stage1.msys2Root,
  );

  step.log(
    `===Installing all packages finished at ${stage1.stageRoot}`,
  );

  const msys2_base_filename = msys64FullArchiveFilename();
  await archiveFull(
    step,
    stage1,
    path.join(stage1.stageRoot, msys2_base_filename),
  );
}
