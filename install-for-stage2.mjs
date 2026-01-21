import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { spawnProcessAsync } from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
});

async function rm_dir(folder_dir) {
  console.log(`Remove existing ${folder_dir}`);
  try {
    await fs.rm(folder_dir, { recursive: true, force: true });
  } catch (e) {
    console.log(`remove with error: ${e}`);
    process.exit(0);
  }
}

async function do_link_home(msys_root) {
  await rm_dir(path.join(msys_root, "home"));
  await rm_dir(path.join(msys_root, "var/cache/pacman/pkg"));

  await spawnProcessAsync(
    "cmd.exe",
    ["/C", "mklink /D home E:\\CI-Tools\\msys64-home\\home"],
    {
      cwd: msys_root,
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );
  await spawnProcessAsync(
    "cmd.exe",
    ["/C", "mklink /D pkg E:\\CI-Tools\\var-cache\\pacman\\pkg"],
    {
      cwd: path.join(msys_root, "var/cache/pacman/"),
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );
}

async function main() {
  const ci_tools_root = "E:/CI-Tools/msys64-stage2";
  // const ci_tools_root = "C:/CI-Tools";
  const msys_root = path.join(ci_tools_root, "msys64");
  const pkg_root = __dirname;
  await do_link_home(msys_root);
  for (let i = 0; i < 2; i += 1) {
    await spawnProcessAsync(
      `${msys_root}/usr/bin/bash.exe`,
      [
        "--login",
        "-c",
        "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
      ],
      {
        cwd: path.join(pkg_root, "dist"),
        env: {
          MSYS: "winsymlinks:native",
          MSYSTEM: "MSYS",
          CHERE_INVOKING: "1",
        },
      },
    );
  }
  await do_link_home(msys_root);
}

main();
