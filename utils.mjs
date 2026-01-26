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
}

function getYYYYMMDD(date) {
  const year = date.getFullYear();
  let month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
  let day = date.getDate().toString();

  // Pad month and day with a leading zero if single digit
  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return year + month + day;
}

export async function archiveFull(
  ci_tools_root,
  msys_root,
  ci_tools_root_cygwin,
) {
  const msys2_base_filename = `msys2-base-x86_64-${getYYYYMMDD(new Date())}-full.tar`;
  let target_msys_tar_path = path.join(ci_tools_root, msys2_base_filename);
  let target_msys_tar_path_cygwin = `${ci_tools_root_cygwin}/${msys2_base_filename}`;
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
  await spawnProcessAsync(
    `${msys_root}/usr/bin/tar.exe`,
    ["cf", target_msys_tar_path_cygwin, "msys64"],
    {
      cwd: ci_tools_root,
      env: {
        MSYS: "winsymlinks:native",
        MSYSTEM: "MSYS",
        CHERE_INVOKING: "1",
      },
    },
  );

  await spawnProcessAsync(
    `${msys_root}/usr/bin/bash.exe`,
    [
      "--login",
      "-c",
      [
        `mkdir -p /var/cache/pacman/pkg`,
        `rm -rf /var/cache/pacman/pkg`,
        `cd /var/cache/pacman/`,
        `ln -s -T /e/CI-Tools/var-cache/pacman/pkg pkg`,
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
