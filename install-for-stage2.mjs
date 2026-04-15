import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  spawnProcessAsyncCapture,
  archiveFull,
  ci_tools_msys64_stage2,
  installMsys2BasePackages,
  installMsys2ExtractScript,
  executePacmanInstall,
} from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
  process.exit(-1);
});

async function main() {
  const msys_root = path.join(ci_tools_msys64_stage2, "msys64");
  const pkg_root = __dirname;
  const has_msys64 = await installMsys2BasePackages(
    ci_tools_msys64_stage2,
    msys_root,
    true,
  );

  const install_commands = [
    "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
    "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
    "pacman -S --needed --noconfirm --overwrite \\* mingw-w64-x86_64-python mingw-w64-x86_64-llvm mingw-w64-x86_64-clang",
  ];
  for (let i = 0; i < install_commands.length; i += 1) {
    console.log(`===Execute: "${install_commands[i]}"`);
    // reset the pacman cache folder
    await executePacmanInstall(
      msys_root,
      install_commands[i],
      path.join(pkg_root, "dist", "stage1"),
    );
  }
  console.log("===Switch to cygwin finished");
  const msys2_base_filename = await archiveFull(
    ci_tools_msys64_stage2,
    msys_root,
  );
  console.log(
    `===stage2: Archive finished as: ${msys2_base_filename} with has_msys64:${has_msys64}`,
  );
  await installMsys2ExtractScript(ci_tools_msys64_stage2, msys2_base_filename);
  console.log(`===stage2: Install extract script finished`);
}

main();
