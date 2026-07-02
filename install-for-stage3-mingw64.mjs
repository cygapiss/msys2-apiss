import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import {
  MINGW_PACKAGE_PREFIX_DEFAULT,
  mingwInstallPackages,
} from "./scripts/mingw-install-list.ts";
import {
  archiveFull,
  executePacmanInstall,
  installMsys2ExtractScript,
  getYYYYMMDD,
} from "./scripts/install-msys2-base.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function install_mingw(MINGW_PACKAGE_PREFIX) {
  const ci_tools_msys64_parent = "D:/CI-Tools/msys64-stage3";
  const msys_root = path.join(ci_tools_msys64_parent, "msys64");
  const pkg_root = __dirname;

  const packages = mingwInstallPackages(MINGW_PACKAGE_PREFIX_DEFAULT);
  const msys_txt_path = path.join(pkg_root, "install-mingw-for-stage3.txt");
  await fs.writeFile(msys_txt_path, packages.join("\n"), "utf-8");

  await executePacmanInstall(msys_root, `pacman -S --noconfirm --needed $(cat install-mingw-for-stage3.txt)`, pkg_root);
  console.log("===stage3: Install mingw packages finished");
  const msys2_base_filename = await archiveFull(
    ci_tools_msys64_parent,
    msys_root,
    `msys2-mingw-x86_64-${getYYYYMMDD(new Date())}-full.tar`
  );
  await installMsys2ExtractScript(ci_tools_msys64_parent, msys2_base_filename, "extract-mingw.bat");

  console.log(
    `===stage3: Archive finished as: ${msys2_base_filename} for mingw64`,
  );
}

install_mingw();
