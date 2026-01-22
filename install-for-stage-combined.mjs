import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import process from "node:process";
import {
  black_list,
  spawnProcessAsync,
  spawnProcessAsyncCapture,
} from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
});
function getYYYYMMDD(date) {
  const year = date.getFullYear();
  let month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
  let day = date.getDate().toString();

  // Pad month and day with a leading zero if single digit
  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return year + month + day;
}

async function archive_full(ci_tools_root, msys_root, cache_root_cygwin) {
  let target_msys_tar_path = path.join(
    ci_tools_root,
    `msys2-base-x86_64-${getYYYYMMDD(new Date())}-full.tar`,
  );
  console.log(`===Compress msys64 into ${target_msys_tar_path}`);
  try {
    await fs.rm(target_msys_tar_path, { force: true, recursive: true });
  } catch (e) {
    console.log(`remove ${target_msys_tar_path} failed with: ${e}`);
  }

  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      [`rm -rf /var/cache/pacman/pkg`, `mkdir -p /var/cache/pacman/pkg`].join(
        "; ",
      ),
    ],
    {
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );
  await spawnProcessAsync(`tar`, ["cf", target_msys_tar_path, "msys64"], {
    cwd: ci_tools_root,
  });
  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      [
        `mkdir -p /var/cache/pacman/pkg`,
        `rm -rf /var/cache/pacman/pkg`,
        `cd /var/cache/pacman/`,
        `ln -s -T ${cache_root_cygwin}/var-cache/pacman/pkg pkg`,
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
}

async function clear_msys64(msys_root) {
  console.log(`Remove existing ${msys_root}`);
  try {
    await fs.rm(msys_root, { recursive: true, force: true });
  } catch (e) {
    console.log(`remove with error: ${e}`);
    process.exit(0);
  }
}

async function main() {
  const ci_tools_root = "C:/CI-Tools";
  const msys_root = path.join(ci_tools_root, "msys64");
  const pkg_root = __dirname;

  await clear_msys64(msys_root);

  console.log(`===Init env`);
  let has_msys64 = false;
  try {
    await fs.access(msys_root);
    has_msys64 = true;
  } catch (e) {}
  if (!has_msys64) {
    console.log(`===Extracting base`);
    await spawnProcessAsync(
      `tar`,
      ["xf", path.join(ci_tools_root, "msys2-base-x86_64-20251213.tar")],
      {
        cwd: ci_tools_root,
      },
    );
    console.log("Extract base finished\n");
  }

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
  const pkg_root_cygwin = (
    await spawnProcessAsyncCapture(`${msys_root}/usr/bin/cygpath.exe`, [
      pkg_root,
    ])
  ).stdout.trim();

  const cache_root_cygwin = (
    await spawnProcessAsyncCapture(`${msys_root}/usr/bin/cygpath.exe`, [
      ci_tools_root,
    ])
  ).stdout.trim();

  console.log(`===Init env finished then upgrade base packages`);

  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      [
        `mkdir -p /var/cache/pacman/pkg`,
        `rm -rf /var/cache/pacman/pkg`,
        `cd /var/cache/pacman/`,
        `ln -s -T ${cache_root_cygwin}/var-cache/pacman/pkg pkg`,
        `cat /etc/pacman.conf | grep ^SigLevel`,
        `cd ${cache_root_cygwin}/`,
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

  console.log(`===Installing all packages`);

  for (let i = 0; i < 2; i += 1) {
    await spawnProcessAsync(
      `${msys_root}/usr/bin/bash.exe`,
      [
        "--login",
        "-c",
        "ls; pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`",
      ],
      {
        cwd: path.join(ci_tools_root, "cygwin-dist"),
        env: {
          MSYS: "winsymlinks:native",
          MSYSTEM: "MSYS",
          CHERE_INVOKING: "1",
        },
      },
    );
  }

  if (!has_msys64) {
    await archive_full(ci_tools_root, msys_root, cache_root_cygwin);
  }
  process.exit(0);
}

main();
