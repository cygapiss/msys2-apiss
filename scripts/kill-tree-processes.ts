import * as path from "path";
import { fileURLToPath } from "url";
import { removeTreePath } from "./remove-tree.ts";
import type { RunLogger } from "./run-context.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// Windows process killer before deleting a directory tree.
//
// Two scan dimensions:
//   scan_targets     - directory prefix(es) and/or absolute *.exe paths; kill
//                      processes whose ExecutablePath starts under a folder
//                      entry or equals an executable entry
//                      (e.g. msys64-stage2\..., or D:\tools\make.exe)
//   locker_executables - absolute host-tool paths outside delete_folder;
//                        pass 2 kills Restart Manager lockers whose exe is
//                        under delete_folder or matches one of these
//                        (e.g. cmd.exe, node.exe, explorer.exe, notepad++.exe)
//
// Pass 1 (ExecutablePath): kill when the binary path starts under a folder
// entry in scan_targets or equals an *.exe entry there.
// Pass 2 (Restart Manager): if fs.rm still fails, find who locks delete_folder
// and kill those PIDs when ExecutablePath is under delete_folder or matches
// locker_executables.
//
// removeTreeWithKillRetry: pass 1 uses scan_targets; fs.rm(delete_folder); pass 2
// uses delete_folder for lock scan. scan_targets may be wider than delete_folder.
//
// PowerShell reads CI_TREE_KILL_SCAN_ROOTS, CI_TREE_KILL_SCAN_ROOT_EXECUTABLES,
// and CI_TREE_KILL_LOCKER_EXECUTABLES (pipe-separated). $exclude lists PIDs only ($PID, nodePid for Node.js
// itself, node ancestor PIDs). The running Node PID is never killed even when
// its path appears in locker_executables.

/** Pipe-separated absolute directory paths passed to PowerShell (pass 1). */
export const TREE_KILL_SCAN_ROOTS_ENV = "CI_TREE_KILL_SCAN_ROOTS";
/** Pipe-separated absolute *.exe paths from scan_targets (pass 1). */
export const TREE_KILL_SCAN_ROOT_EXECUTABLES_ENV =
  "CI_TREE_KILL_SCAN_ROOT_EXECUTABLES";
/** Absolute folder path passed to PowerShell (pass 2 lock scan). */
export const TREE_KILL_DELETE_FOLDER_ENV = "CI_TREE_KILL_DELETE_FOLDER";
/** Pipe-separated absolute *.exe paths passed to PowerShell (pass 2). */
export const TREE_KILL_LOCKER_EXECUTABLES_ENV =
  "CI_TREE_KILL_LOCKER_EXECUTABLES";
export const TREE_KILL_SCAN_ROOTS_SEP = "|";

function dedupeExecutablePaths(paths: readonly string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of paths) {
    const resolved = path.resolve(entry);
    const key = resolved.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

/** Default locker_executables: host tools outside delete_folder. */
export function defaultTreeKillLockerExecutables(): readonly string[] {
  const system_root = process.env.SystemRoot || "C:\\Windows";
  const program_files = process.env.ProgramFiles || "C:\\Program Files";
  const program_files_x86 = process.env["ProgramFiles(x86)"];
  const local_app_data = process.env.LOCALAPPDATA;
  const candidates = [
    path.join(system_root, "explorer.exe"),
    path.join(system_root, "System32", "cmd.exe"),
    path.join(system_root, "System32", "notepad.exe"),
    path.join(system_root, "System32", "tar.exe"),
    path.join(
      system_root,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    path.join(program_files, "PowerShell", "7", "pwsh.exe"),
    path.join(program_files, "nodejs", "node.exe"),
    path.join(program_files, "Git", "cmd", "git.exe"),
    path.join(program_files, "Git", "bin", "git.exe"),
    path.join(program_files, "Git", "usr", "bin", "bash.exe"),
    path.join(program_files, "Microsoft VS Code", "Code.exe"),
    path.join(program_files, "Windows Terminal", "wt.exe"),
    path.join(program_files, "7-Zip", "7z.exe"),
    path.join(program_files, "Notepad++", "notepad++.exe"),
  ];
  if (local_app_data) {
    candidates.push(
      path.join(local_app_data, "Programs", "cursor", "Cursor.exe"),
    );
  }
  if (program_files_x86) {
    candidates.push(path.join(program_files_x86, "nodejs", "node.exe"));
    candidates.push(
      path.join(program_files_x86, "Notepad++", "notepad++.exe"),
    );
    candidates.push(path.join(program_files_x86, "7-Zip", "7z.exe"));
  }
  if (process.execPath) {
    candidates.push(process.execPath);
  }
  return dedupeExecutablePaths(candidates);
}

function isScanExecutableEntry(entry: string) {
  return /\.exe$/i.test(entry);
}

function partitionScanTargets(scan_targets: readonly string[]) {
  const folders: string[] = [];
  const executables: string[] = [];
  for (const entry of scan_targets) {
    const resolved = path.resolve(entry);
    if (isScanExecutableEntry(resolved)) {
      executables.push(resolved);
    } else {
      folders.push(resolved);
    }
  }
  return {
    folders: dedupeExecutablePaths(folders),
    executables: dedupeExecutablePaths(executables),
  };
}

/** Resolve scan_targets folder entries to absolute paths. */
export function resolveScanTargetFolders(scan_targets: readonly string[]) {
  return partitionScanTargets(scan_targets).folders;
}

/** Resolve one locker_executables entry to an absolute path. */
export function resolveLockerExecutable(executable: string) {
  return path.resolve(executable);
}

/** Encode scan_targets folder entries for CI_TREE_KILL_SCAN_ROOTS. */
export function formatScanTargetFoldersEnv(scan_targets: readonly string[]) {
  return partitionScanTargets(scan_targets).folders.join(
    TREE_KILL_SCAN_ROOTS_SEP,
  );
}

/** Encode scan_targets *.exe entries for CI_TREE_KILL_SCAN_ROOT_EXECUTABLES. */
export function formatScanTargetExecutablesEnv(scan_targets: readonly string[]) {
  return partitionScanTargets(scan_targets).executables.join(
    TREE_KILL_SCAN_ROOTS_SEP,
  );
}

/** Encode locker_executables for CI_TREE_KILL_LOCKER_EXECUTABLES. */
export function formatLockerExecutablesEnv(
  locker_executables: readonly string[],
) {
  return locker_executables
    .map(resolveLockerExecutable)
    .join(TREE_KILL_SCAN_ROOTS_SEP);
}

function treeKillTargetsEnv(scan_targets: readonly string[]): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [TREE_KILL_SCAN_ROOTS_ENV]: formatScanTargetFoldersEnv(scan_targets),
    [TREE_KILL_SCAN_ROOT_EXECUTABLES_ENV]:
      formatScanTargetExecutablesEnv(scan_targets),
  };
}

function treeKillLockEnv(
  delete_folder: string,
  locker_executables: readonly string[],
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [TREE_KILL_DELETE_FOLDER_ENV]: path.resolve(delete_folder),
    [TREE_KILL_LOCKER_EXECUTABLES_ENV]: formatLockerExecutablesEnv(
      locker_executables,
    ),
  };
}

/** Absolute path to pass-1 kill script (ExecutablePath scan). */
export function killTreeExecutablePathScript() {
  return path.join(scriptDir, "sh", "kill-tree-executable-path.ps1");
}

/** Absolute path to pass-2 kill script (Restart Manager lock scan). */
export function killTreeRestartManagerScript() {
  return path.join(scriptDir, "sh", "kill-tree-restart-manager.ps1");
}

/** powershell.exe -File args for a kill-tree script. */
export function killTreePowerShellFileArgs(
  nodePid: number,
  scriptPath: string,
): string[] {
  return [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-NodePid",
    String(nodePid),
  ];
}

function runTreeLockKillPowerShell(
  step: RunLogger,
  delete_folder: string,
  locker_executables: readonly string[],
  nodePid: number,
) {
  const tree = path.resolve(delete_folder);
  step.log(`Killing processes locking ${tree} ...`);
  return step.run(
    "powershell.exe",
    killTreePowerShellFileArgs(nodePid, killTreeRestartManagerScript()),
    {
      env: treeKillLockEnv(delete_folder, locker_executables),
      windowsHide: true,
    },
  );
}

function runTreeKillPowerShell(
  step: RunLogger,
  scan_targets: readonly string[],
  nodePid: number,
  logLabel: string,
) {
  const roots = resolveScanTargetFolders(scan_targets);
  step.log(`${logLabel} ${roots.join(", ")} ...`);
  return step
    .run(
      "powershell.exe",
      killTreePowerShellFileArgs(nodePid, killTreeExecutablePathScript()),
      {
        env: treeKillTargetsEnv(scan_targets),
        windowsHide: true,
      },
    )
    .then((result) => {
      step.log(`${logLabel} ${roots.join(", ")} done`);
      return result;
    });
}

// Pass 1 only. No-op on non-Windows.
//
// scan_targets - kill processes whose ExecutablePath is under a folder entry
//                or equals an *.exe entry
export async function killProcessesWithExecutableUnder(
  step: RunLogger,
  scan_targets: readonly string[],
) {
  if (process.platform !== "win32") {
    return;
  }
  await runTreeKillPowerShell(
    step,
    scan_targets,
    process.pid,
    "Killing processes under",
  );
}

// Pass 2 only. No-op on non-Windows.
//
// delete_folder - Restart Manager finds PIDs locking this tree
// locker_executables - kill lockers whose exe is under delete_folder or listed here
export async function killProcessesLockingTree(
  step: RunLogger,
  delete_folder: string,
  locker_executables: readonly string[] = defaultTreeKillLockerExecutables(),
) {
  if (process.platform !== "win32") {
    return;
  }
  await runTreeLockKillPowerShell(
    step,
    delete_folder,
    locker_executables,
    process.pid,
  );
}

// Pass 1, delete delete_folder, then pass 2 + delete on failure. No-op kill
// passes on non-Windows; delete still runs.
//
// scan_targets - pass 1: folder prefixes and/or exact *.exe paths
// locker_executables - pass 2: host exe paths among delete_folder lockers
// followSymlinks - default false: fs.rm never descends into symlinks/junctions
//                  when deleting (protects shared junction targets like
//                  msys64-caches). Set true to descend into link targets and
//                  delete their contents.
export async function removeTreeWithKillRetry(
  step: RunLogger,
  delete_folder: string,
  scan_targets: readonly string[],
  locker_executables: readonly string[] = defaultTreeKillLockerExecutables(),
  options: { followSymlinks?: boolean } = {},
) {
  const followSymlinks = options.followSymlinks ?? false;
  const tree = path.resolve(delete_folder);
  if (process.platform !== "win32") {
    await removeTreePath(tree, followSymlinks);
    return;
  }
  await killProcessesWithExecutableUnder(step, scan_targets);
  step.log(`Removing ${tree} ...`);
  try {
    await removeTreePath(tree, followSymlinks);
    step.log(`Removing ${tree} done`);
    return;
  } catch (firstError) {
    step.log(
      `Remove ${tree} failed (${firstError}); trying Restart Manager kill ...`,
    );
  }
  await killProcessesLockingTree(step, tree, locker_executables);
  step.log(`Removing ${tree} (retry) ...`);
  await removeTreePath(tree, followSymlinks);
  step.log(`Removing ${tree} done`);
}
