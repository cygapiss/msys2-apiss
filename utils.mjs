import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

export const black_list = new Set([
  // "ca-certificates",
  "cmake-bootstrap", // cmake-emacs-4.2.1-1 and cmake-bootstrap-4.2.1-1 are in conflict.
  "mingw-w64-cross-clang", // mingw-w64-cross-clang: /opt/i686-w64-mingw32/bin/ar exists in filesystem
  "mingw-w64-cross-clang-crt",
  "mingw-w64-cross-clang-headers",
  "msys2-runtime-3.3",
  "msys2-runtime-3.3-devel",
  "msys2-runtime-3.4",
  "msys2-runtime-3.4-devel",
  "msys2-runtime-3.5",
  "msys2-runtime-3.5-devel",
  "parallel", // parallel: /usr/bin/parallel exists in filesystem /usr/bin/parallel.exe is owned by moreutils 0.70-1
  "gnu-netcat", // gnu-netcat-0.7.1-3 and openbsd-netcat-1.234_1-1 are in conflict. Remove openbsd-netcat? [Y/n] "
]);

export const ci_tools_base = process.env.CI_TOOLS_ROOT || "D:/CI-Tools";

export const ci_tools_msys64_stage0 = `${ci_tools_base}/msys64-stage0`;
export const ci_tools_msys64_stage2 = `${ci_tools_base}/msys64-stage2`;
export const ci_tools_msys64_stage3 = `${ci_tools_base}/msys64-stage3`;

export function spawnProcessAsyncCapture(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    // Collect stdout and stderr data
    let stdoutOutput = "";
    let stderrOutput = "";

    const child = spawn(command, args, options);

    // Capture stdout data chunks
    child.stdout.on("data", (data) => {
      stdoutOutput += data.toString();
    });

    // Capture stderr data chunks
    child.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    // Handle process errors (e.g., command not found)
    child.on("error", (err) => {
      reject(err);
    });

    // Handle process exit
    child.on("close", (code) => {
      if (code !== 0) {
        // Reject the promise if the process fails (non-zero exit code)
        reject(new Error(`Process exited with code ${code}: ${stderrOutput}`));
      } else {
        // Resolve the promise with the captured output
        resolve({ stdout: stdoutOutput, stderr: stderrOutput, code });
      }
    });
  });
}

export function spawnProcessAsync(command, args = [], options = {}) {
  let p = spawn(command, args, options);
  return new Promise((resolve) => {
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
    p.on("exit", (code) => {
      resolve(code);
    });
  });
}

export async function removeDirectory(folder_dir) {
  console.log(`Remove existing ${folder_dir}`);
  try {
    await fs.rm(folder_dir, { recursive: true, force: true });
  } catch (e) {
    console.log(`remove with error: ${e}`);
    process.exit(0);
  }
  let has_folder = await fsExistsAsync(folder_dir);
  console.log(
    `Remove ${folder_dir} finished with: ${has_folder ? "exists" : "not exists"}`,
  );
}

export function getYYYYMMDD(date) {
  const year = date.getFullYear();
  let month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
  let day = date.getDate().toString();

  // Pad month and day with a leading zero if single digit
  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return year + month + day;
}

export async function linkPacmanCache(msys_root) {
  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      [
        "export CI_TOOLS_DIR_WIN=`cygpath -w /`/../..",
        "export CI_TOOLS_DIR_POSIX=`cygpath -p $CI_TOOLS_DIR_WIN`",
        "echo CI_TOOLS_DIR_POSIX:$CI_TOOLS_DIR_POSIX",
        "rm -rf /var/lib/pacman/db.lck",
        "unlink /var/cache/pacman/pkg 2>/dev/null || true",
        "mkdir -p /var/cache/pacman/pkg",
        "touch /var/cache/pacman/pkg/gitignore",
        "cp -af /var/cache/pacman/pkg/* $CI_TOOLS_DIR_POSIX/msys64-caches/msys64/var/cache/pacman/pkg",
        "rm -rf /var/cache/pacman/pkg",
        "pushd /var/cache/pacman/",
        "ln -s -T $CI_TOOLS_DIR_POSIX/msys64-caches/msys64/var/cache/pacman/pkg pkg",
        "popd",
        `cat /etc/pacman.conf | grep ^SigLevel`,
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

export async function archiveFull(
  ci_tools_msys64_parent,
  msys_root,
  msys2_base_filename
) {
  const ci_tools_msys64_parent_cygwin = (
    await spawnProcessAsyncCapture(`${msys_root}/usr/bin/cygpath.exe`, [
      ci_tools_msys64_parent,
    ])
  ).stdout.trim();
  if (!msys2_base_filename) {
    msys2_base_filename = `msys2-base-x86_64-${getYYYYMMDD(new Date())}-full.tar`;
  }
  let target_msys_tar_path = path.join(
    ci_tools_msys64_parent,
    msys2_base_filename,
  );
  let target_msys_tar_path_cygwin = `${ci_tools_msys64_parent_cygwin}/${msys2_base_filename}`;
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
      [
        `rm -f ${target_msys_tar_path_cygwin}`,
        `rm -rf /var/cache/pacman/pkg`,
        `mkdir -p /var/cache/pacman/pkg`,
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
  await spawnProcessAsync(
    `${msys_root}/usr/bin/tar.exe`,
    ["cf", target_msys_tar_path_cygwin, "msys64"],
    {
      cwd: ci_tools_msys64_parent,
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );

  await linkPacmanCache(msys_root);
  return msys2_base_filename;
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

export async function executePacmanInstall(msys_root, install_command, cwd) {
  console.log(`===Execute: "${install_command}" at ${msys_root} at ${cwd}`);
  // reset the pacman cache folder
  await linkPacmanCache(msys_root);
  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    ["--login", "-c", install_command],
    {
      cwd: cwd,
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );
}

export async function fsExistsAsync(p) {
  try {
    await fs.access(p);
    return true;
  } catch (e) {}
  return false;
}

export async function installMsys2BasePackages(
  ci_tools_msys64_parent,
  msys_root,
  enable_clear_msys64,
) {
  if (enable_clear_msys64) {
    await clear_msys64(msys_root);
  }

  console.log(`===Init env at ${msys_root}`);
  let has_msys64 = await fsExistsAsync(msys_root);
  if (!has_msys64) {
    console.log(`===Extracting base`);
    await spawnProcessAsync(
      `tar`,
      [
        "xf",
        path.join(ci_tools_msys64_parent, "msys2-base-x86_64-20251213.tar.zst"),
      ],
      {
        cwd: ci_tools_msys64_parent,
      },
    );
    console.log("===Extract base finished\n");
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
  }

  console.log(`===Init env finished then upgrade base packages at ${msys_root}`);
  await executePacmanInstall(msys_root, `pacman -Syu --noconfirm`, msys_root);
  console.log("===Upgrade base packages finished");
  return has_msys64;
}

export async function installMsys2AllPackages(
  ci_tools_msys64_parent,
  pkg_root,
  enable_clear_msys64,
) {
  const msys_root = path.join(ci_tools_msys64_parent, "msys64");
  const has_msys64 = await installMsys2BasePackages(
    ci_tools_msys64_parent,
    msys_root,
    enable_clear_msys64,
  );
  const pkg_root_cygwin = (
    await spawnProcessAsyncCapture(`${msys_root}/usr/bin/cygpath.exe`, [
      pkg_root,
    ])
  ).stdout.trim();

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

  const bash_commands_for_install_all = [
    `sed -i 's/^SigLevel.*$/SigLevel=Never/g' /etc/pacman.conf`,
    `cat /etc/pacman.conf | grep ^SigLevel`,
    `pacman -S --noconfirm --needed $(cat msys.txt)`,
  ];

  await spawnProcessAsync(`${msys_root}/usr/bin/bash.exe`, [
    "--login",
    "-c",
    `cd ${pkg_root_cygwin}/; ${bash_commands_for_install_all.join("; ")}`,
  ]);

  console.log(
    `===Installing all packages finished at ${ci_tools_msys64_parent}`,
  );

  return has_msys64;
}

export async function installMsys2ExtractScript(
  ci_tools_msys64_parent,
  msys2_base_filename,
  bat_filename,
) {
  const pacman_cache_pash = "msys64\\var\\cache\\pacman\\pkg";
  const msys_64_home = `msys64\\home`;
  const extract_bat_content = `
pushd "%~dp0"\..
set __CI_TOOLS_DIR=%CD%
popd
set _MSYS64_CACHES=%__CI_TOOLS_DIR%\\msys64-caches

pushd "%~dp0"

if not exist msys64 (
  tar xf ${msys2_base_filename}
)

del /F /Q ${msys_64_home}
rd /s /q ${msys_64_home}
mklink /D ${msys_64_home} %_MSYS64_CACHES%\\${msys_64_home}

del /F /Q ${pacman_cache_pash}
rd /s /q ${pacman_cache_pash}
mklink /D ${pacman_cache_pash} %_MSYS64_CACHES%\\${pacman_cache_pash}

popd

if defined CI_TOOLS_DISABLE_PAUSE ( goto :eof )

pause
`;
  await fs.writeFile(
    path.join(ci_tools_msys64_parent, bat_filename || "extract.bat"),
    extract_bat_content,
    "utf-8",
  );
}
