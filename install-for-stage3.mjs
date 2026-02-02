import * as path from "path";
import { fileURLToPath } from "url";
import {
  spawnProcessAsync,
  spawnProcessAsyncCapture,
  removeDirectory,
  archiveFull,
} from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
});

async function main() {
  const ci_tools_root = "D:/CI-Tools/msys64-stage3";
  const msys_root = path.join(ci_tools_root, "msys64");
  const pkg_root = __dirname;
  await removeDirectory(msys_root);
  await spawnProcessAsync(
    `tar`,
    ["xf", path.join(ci_tools_root, "msys2-base-x86_64-20251213.tar.zst")],
    {
      cwd: ci_tools_root,
    },
  );
  console.log("Extract base finished\n");
  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      `echo "Init msys with $MSYSTEM finished"; rm -rf /var/lib/pacman/db.lck; pacman -Syu --noconfirm`,
    ],
    {
      env: {
        MSYSTEM: "MSYS",
      },
    },
  );
  const ci_tools_root_cygwin = (
    await spawnProcessAsyncCapture(`${msys_root}/usr/bin/cygpath.exe`, [
      ci_tools_root,
    ])
  ).stdout.trim();
  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      [
        `mkdir -p /var/cache/pacman/pkg`,
        `rm -rf /var/cache/pacman/pkg`,
        `cd /var/cache/pacman/`,
        `ln -s -T /d/CI-Tools/var-cache/pacman/pkg pkg`,
        `cat /etc/pacman.conf | grep ^SigLevel`,
        `cd ${ci_tools_root_cygwin}/`,
        `pacman -Syu --noconfirm`,
      ].join("; "),
    ],
    {
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );
  for (let i = 0; i < 2; i += 1) {
    await spawnProcessAsync(
      `${msys_root}/usr/bin/bash.exe`,
      [
        "--login",
        "-c",
        "pacman -U --noconfirm --overwrite \\* `ls *.pkg.tar.zst | tr '\n' ' '`",
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
  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
    ],
    {
      cwd: path.join(pkg_root, "dist-final"),
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );
  console.log("===Switch to cygwin finished");
  await archiveFull(ci_tools_root, msys_root, ci_tools_root_cygwin);
  console.log("===Archive stage2 finished");
}

main();
