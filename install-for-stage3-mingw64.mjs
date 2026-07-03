import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import {
  MINGW_PACKAGE_PREFIX_DEFAULT,
  mingwInstallPackages,
} from "./scripts/mingw-install-list.ts";
import { GENERATED_MSYS_MINGW64_TXT } from "./scripts/build-config.ts";
import {
  archiveFull,
  executePacmanInstall,
  msys64FullArchiveFilename,
} from "./scripts/install-msys2-base.ts";
import { initMsys2Stage, cygpathUnix } from "./scripts/utils.ts";
import {
  extractMsys2FromStageArchive,
} from "./scripts/stage-extract.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runInstallForStage3Mingw64(step) {
  const stage3 = initMsys2Stage(step, "stage3");
  const stage3_mingw64 = initMsys2Stage(step, "stage3-mingw64");
  const pkg_root = __dirname;

  const packages = mingwInstallPackages(MINGW_PACKAGE_PREFIX_DEFAULT);
  const mingw64_txt_path = path.join(pkg_root, GENERATED_MSYS_MINGW64_TXT);
  await fs.writeFile(mingw64_txt_path, packages.join("\n"), "utf-8");

  await extractMsys2FromStageArchive(
    step,
    stage3,
    stage3_mingw64,
    "stage3-mingw64",
  );

  const mingw64_txt_cygwin = await cygpathUnix(
    step,
    stage3_mingw64,
    mingw64_txt_path,
  );

  await executePacmanInstall(
    step,
    stage3_mingw64,
    [`pacman -S --noconfirm --needed $(cat ${mingw64_txt_cygwin})`],
    stage3_mingw64.msys2Root,
  );
  console.log("===stage3-mingw64: Install mingw packages finished");
  const msys2_base_filename = msys64FullArchiveFilename();
  await archiveFull(
    step,
    stage3_mingw64,
    path.join(stage3_mingw64.stageRoot, msys2_base_filename),
  );
}
