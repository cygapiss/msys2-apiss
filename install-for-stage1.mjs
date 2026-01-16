import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import process, { exit } from "node:process";
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
    `msys2-base-x86_64-${getYYYYMMDD(new Date())}-full.tar`
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
        "; "
      ),
    ],
    {
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    }
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
    }
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

  // await clear_msys64(msys_root);

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
      }
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
    }
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
    }
  );

  console.log("Upgrade base packages finished");

  const msys_list_capture = await spawnProcessAsyncCapture(
    `${msys_root}/usr/bin/pacman.exe`,
    ["-Sl", "msys"]
  );
  const msys_list_content = msys_list_capture.stdout.trim();
  const packages = [];

  for (let pkg of msys_list_content.split("\n")) {
    const pkg_name = pkg.split(" ")[1];
    if (black_list.has(pkg_name)) continue;
    packages.push(pkg_name);
  }
  const msys_txt_path = path.join(pkg_root, "msys.txt");
  await fs.writeFile(msys_txt_path, packages.join("\n"), "utf-8");

  console.log(`===Installing all packages`);

  const bash_commands_for_instlal_all = [
    `sed -i 's/^SigLevel.*$/SigLevel=Never/g' /etc/pacman.conf`,
    `cat /etc/pacman.conf | grep ^SigLevel`,
    `pacman -S --noconfirm --needed $(cat msys.txt)`,
  ];

  await spawnProcessAsync(`${msys_root}/usr/bin/bash.exe`, [
    "--login",
    "-c",
    `cd ${pkg_root_cygwin}/; ${bash_commands_for_instlal_all.join("; ")}`,
  ]);

  console.log(
    `===Installing packages finished, then install newer version msys2-runtime`
  );

  const bash_msys_runtime_for_intall = [
    `sed -i 's/^SigLevel.*$/SigLevel=Required/g' /etc/pacman.conf`,
    `cat /etc/pacman.conf | grep ^SigLevel`,
    `pacman -U --noconfirm msys2-runtime-3.6.6-2-x86_64.pkg.tar.zst msys2-runtime-devel-3.6.6-2-x86_64.pkg.tar.zst`,
  ];

  await spawnProcessAsync(`${msys_root}/usr/bin/bash.exe`, [
    "--login",
    "-c",
    `cd ${pkg_root_cygwin}/dist-init;  ${bash_msys_runtime_for_intall.join(
      "; "
    )}`,
  ]);

  console.log(`===Newer msys2-runtime install finished`);

  if (!has_msys64) {
    await archive_full(ci_tools_root, msys_root, cache_root_cygwin);
  }
  process.exit(0);
}

main();
