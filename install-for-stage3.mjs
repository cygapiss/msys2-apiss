import * as path from "path";
import { fileURLToPath } from "url";
import {
  archiveFull,
  executePacmanInstall,
  installMsys2Base,
  msys64FullArchiveFilename,
} from "./scripts/install-msys2-base.ts";
import { initMsys2Stage } from "./scripts/utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runInstallForStage3(step) {
  const stage3 = initMsys2Stage(step, "stage3");
  const pkg_root = __dirname;
  await installMsys2Base(step, stage3, true);

  const install_commands = [
    "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
    "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
  ];
  await executePacmanInstall(
    step,
    stage3,
    install_commands,
    path.join(pkg_root, "dist", "stage1"),
  );
  await executePacmanInstall(
    step,
    stage3,
    ["pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`"],
    path.join(pkg_root, "dist", "stage2"),
  );
  console.log("===stage3: Switch to cygwin finished");
  const msys2_base_filename = msys64FullArchiveFilename();
  await archiveFull(
    step,
    stage3,
    path.join(stage3.stageRoot, msys2_base_filename),
  );
}
