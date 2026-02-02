import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import process from "node:process";
import {
  black_list,
  spawnProcessAsync,
  spawnProcessAsyncCapture,
  archiveFull
} from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
});

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
  const ci_tools_root = "D:/CI-Tools/msys64-stage1";
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
      ["xf", path.join(ci_tools_root, "msys2-base-x86_64-20251213.tar.zst")],
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

  const ci_tools_root_cygwin = (
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

  console.log("Upgrade base packages finished");

  const msys_list_capture = await spawnProcessAsyncCapture(
    `${msys_root}/usr/bin/pacman.exe`,
    ["-Sl", "msys"],
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
    `===Installing packages finished, then install newer version msys2-runtime`,
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
      "; ",
    )}`,
  ]);

  console.log(`===Newer msys2-runtime install finished`);

  if (!has_msys64) {
    await archiveFull(ci_tools_root, msys_root, ci_tools_root_cygwin);
  }
  process.exit(0);
}

main();
