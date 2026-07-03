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

export async function runInstallForStage2(step) {
  const stage2 = initMsys2Stage(step, "stage2");
  const pkg_root = __dirname;
  await installMsys2Base(step, stage2, true);

  const install_commands = [
    "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
    "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
    "pacman -S --needed --noconfirm --overwrite \\* mingw-w64-x86_64-python mingw-w64-x86_64-llvm mingw-w64-x86_64-clang",
  ];
  await executePacmanInstall(
    step,
    stage2,
    install_commands,
    path.join(pkg_root, "dist", "stage1"),
  );
  console.log("===Switch to cygwin finished");
  const msys2_base_filename = msys64FullArchiveFilename();
  await archiveFull(
    step,
    stage2,
    path.join(stage2.stageRoot, msys2_base_filename),
  );
}
