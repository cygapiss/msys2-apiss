import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mock, test } from "node:test";
import {
  TREE_KILL_DELETE_FOLDER_ENV,
  TREE_KILL_LOCKER_EXECUTABLES_ENV,
  TREE_KILL_SCAN_ROOT_EXECUTABLES_ENV,
  TREE_KILL_SCAN_ROOTS_ENV,
  defaultTreeKillLockerExecutables,
  formatLockerExecutablesEnv,
  formatScanTargetExecutablesEnv,
  formatScanTargetFoldersEnv,
  killProcessesLockingTree,
  killProcessesWithExecutableUnder,
  killTreeExecutablePathScript,
  killTreePowerShellFileArgs,
  killTreeRestartManagerScript,
  resolveLockerExecutable,
  removeTreeWithKillRetry,
} from "../scripts/kill-tree-processes.ts";
import type { RunOptions } from "../scripts/run-context.ts";
import { makeRunLogger } from "./make-run-logger.ts";

function readKillTreeScript(name: string) {
  return fs.readFileSync(
    path.join(path.dirname(killTreeExecutablePathScript()), name),
    "utf8",
  );
}

test("killTreeExecutablePathScript reads scan folders from env", () => {
  const script = readKillTreeScript("kill-tree-executable-path.ps1");
  const shared = readKillTreeScript("kill-tree-shared.ps1");
  assert.match(script, /\$env:CI_TREE_KILL_SCAN_ROOTS/);
  assert.match(script, /\$env:CI_TREE_KILL_SCAN_ROOT_EXECUTABLES/);
  assert.match(script, /-NodePid/);
  assert.match(shared, /\$exclude = @\(\$PID, \$NodePid\)/);
  assert.match(shared, /\$shellExplorerPid/);
  assert.match(shared, /\$exclude \+= \$ancestor\.ProcessId/);
  assert.match(shared, /return \$exclude/);
  assert.match(shared, /StartsWith\(\$prefix, \[StringComparison\]::OrdinalIgnoreCase\)/);
  assert.match(shared, /ExecutablePath -ieq \$exe/);
  assert.doesNotMatch(script, /CI_TREE_KILL_LOCKER_EXECUTABLES/);
  assert.doesNotMatch(script, /CommandLine/);
  assert.doesNotMatch(shared, /\.Name -ine/);
});

test("kill-tree-shared excludes node ancestor PIDs but not shell explorer", () => {
  const shared = readKillTreeScript("kill-tree-shared.ps1");
  assert.match(shared, /\$exclude = @\(\$PID, \$NodePid\)/);
  assert.match(shared, /\$shellExplorerPid/);
  assert.match(shared, /\$ancestor\.ProcessId -eq \$shellExplorerPid/);
  assert.match(shared, /\$exclude \+= \$ancestor\.ProcessId/);
  assert.match(shared, /return \$exclude/);
  assert.doesNotMatch(shared, /\.Name -ine/);
});

test("formatScanTargetFoldersEnv joins resolved folders with pipe", () => {
  assert.equal(
    formatScanTargetFoldersEnv([
      "D:\\CI-Tools\\msys64-stage2",
      "D:\\CI-Tools\\msys64-stage3",
    ]),
    "D:\\CI-Tools\\msys64-stage2|D:\\CI-Tools\\msys64-stage3",
  );
});

test("formatScanTargetFoldersEnv excludes exe entries", () => {
  assert.equal(
    formatScanTargetFoldersEnv([
      "D:\\CI-Tools\\msys64-stage2",
      "D:\\tools\\make.exe",
    ]),
    "D:\\CI-Tools\\msys64-stage2",
  );
});

test("formatScanTargetExecutablesEnv extracts exe entries", () => {
  assert.equal(
    formatScanTargetExecutablesEnv([
      "D:\\CI-Tools\\msys64-stage2",
      "D:\\tools\\custom\\make.exe",
    ]),
    "D:\\tools\\custom\\make.exe",
  );
});

test("formatLockerExecutablesEnv resolves absolute exe paths", () => {
  assert.equal(
    formatLockerExecutablesEnv([
      "C:\\Windows\\System32\\tar.exe",
      "D:\\tools\\custom\\make.exe",
    ]),
    "C:\\Windows\\System32\\tar.exe|D:\\tools\\custom\\make.exe",
  );
});

test("resolveLockerExecutable resolves relative paths", () => {
  assert.equal(
    resolveLockerExecutable("relative\\tool.exe"),
    path.resolve("relative\\tool.exe"),
  );
});

test("defaultTreeKillLockerExecutables lists host tools outside msys64", () => {
  const system_root = process.env.SystemRoot || "C:\\Windows";
  const program_files = process.env.ProgramFiles || "C:\\Program Files";
  const defaults = defaultTreeKillLockerExecutables().map((entry) =>
    entry.toLowerCase(),
  );
  assert.ok(
    defaults.includes(path.join(system_root, "explorer.exe").toLowerCase()),
  );
  assert.ok(
    defaults.includes(path.join(system_root, "System32", "cmd.exe").toLowerCase()),
  );
  assert.ok(
    defaults.includes(path.join(system_root, "System32", "tar.exe").toLowerCase()),
  );
  assert.ok(
    defaults.includes(
      path
        .join(
          system_root,
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        )
        .toLowerCase(),
    ),
  );
  assert.ok(
    defaults.includes(
      path.join(program_files, "nodejs", "node.exe").toLowerCase(),
    ),
  );
  assert.ok(
    defaults.includes(
      path.join(system_root, "System32", "notepad.exe").toLowerCase(),
    ),
  );
  assert.ok(
    defaults.includes(
      path.join(program_files, "Notepad++", "notepad++.exe").toLowerCase(),
    ),
  );
  assert.ok(
    defaults.includes(
      path.join(program_files, "Git", "usr", "bin", "bash.exe").toLowerCase(),
    ),
  );
  assert.ok(
    defaults.includes(
      path.join(program_files, "Microsoft VS Code", "Code.exe").toLowerCase(),
    ),
  );
  assert.ok(
    defaults.includes(
      path.join(program_files, "Windows Terminal", "wt.exe").toLowerCase(),
    ),
  );
  assert.ok(
    defaults.includes(path.join(program_files, "7-Zip", "7z.exe").toLowerCase()),
  );
  assert.ok(
    defaults.includes(path.resolve(process.execPath).toLowerCase()),
  );
});

test("killTreeRestartManagerScript uses Restart Manager APIs", () => {
  const script = readKillTreeScript("kill-tree-restart-manager.ps1");
  assert.match(script, /RmRegisterResources/);
  assert.match(script, /Get-ChildItem -LiteralPath \$deleteFolder -Recurse -File/);
  assert.match(script, /GetLockingPids\(\$treeFiles\)/);
  assert.match(script, /-NodePid/);
  assert.match(script, /\$deleteFolder = \$env:CI_TREE_KILL_DELETE_FOLDER/);
  assert.match(script, /\$roots = @\(\$deleteFolder\)/);
  assert.match(script, /\$lockerExes = @\(\$env:CI_TREE_KILL_LOCKER_EXECUTABLES/);
  assert.match(script, /Test-TreeKillExecutablePathMatch -Proc \$proc -Roots \$roots -Exes \$lockerExes/);
});

test("killTreePowerShellFileArgs passes NodePid to script", () => {
  assert.deepEqual(
    killTreePowerShellFileArgs(4242, killTreeExecutablePathScript()),
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      killTreeExecutablePathScript(),
      "-NodePid",
      "4242",
    ],
  );
});

test("killProcessesWithExecutableUnder passes scan targets via env", async () => {
  if (process.platform !== "win32") {
    return;
  }

  const scanTargets = [
    path.join("D:\\CI-Tools", "msys64-stage2"),
    path.join("D:\\CI-Tools", "msys64-stage3"),
    path.join("D:\\tools", "custom", "make.exe"),
  ];
  const logs: string[] = [];
  const runs: {
    command: string;
    args: string[];
    options: RunOptions;
  }[] = [];
  const step = makeRunLogger({
    log: (...args: unknown[]) => {
      logs.push(String(args[0]));
    },
    run: mock.fn(async (command: string, args: string[], options?: RunOptions) => {
      runs.push({ command, args, options: options ?? {} });
      return { stdout: "", stderr: "", code: 0 };
    }),
  });

  await killProcessesWithExecutableUnder(step, scanTargets);

  assert.match(logs[0] ?? "", /Killing processes under/);
  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.command, "powershell.exe");
  assert.deepEqual(runs[0]?.args, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    killTreeExecutablePathScript(),
    "-NodePid",
    String(process.pid),
  ]);
  assert.equal(
    runs[0]?.options.env?.[TREE_KILL_SCAN_ROOTS_ENV],
    formatScanTargetFoldersEnv(scanTargets),
  );
  assert.equal(
    runs[0]?.options.env?.[TREE_KILL_SCAN_ROOT_EXECUTABLES_ENV],
    formatScanTargetExecutablesEnv(scanTargets),
  );
  assert.equal(runs[0]?.options.windowsHide, true);
  assert.equal(runs[0]?.options.env?.[TREE_KILL_LOCKER_EXECUTABLES_ENV], undefined);
});

test("killProcessesLockingTree passes delete_folder and locker executables via env", async () => {
  if (process.platform !== "win32") {
    return;
  }

  const deleteFolder = "D:\\CI-Tools\\msys64-stage2\\msys64";
  const logs: string[] = [];
  const runs: { env?: NodeJS.ProcessEnv }[] = [];
  const step = makeRunLogger({
    log: (...args: unknown[]) => {
      logs.push(String(args[0]));
    },
    run: mock.fn(async (_command: string, _args: string[], options?: RunOptions) => {
      runs.push({ env: options?.env });
      return { stdout: "", stderr: "", code: 0 };
    }),
  });

  await killProcessesLockingTree(step, deleteFolder);

  assert.match(logs[0] ?? "", /Killing processes locking/);
  assert.equal(
    runs[0]?.env?.[TREE_KILL_DELETE_FOLDER_ENV],
    path.resolve(deleteFolder),
  );
  assert.equal(
    runs[0]?.env?.[TREE_KILL_LOCKER_EXECUTABLES_ENV],
    formatLockerExecutablesEnv(defaultTreeKillLockerExecutables()),
  );
  assert.equal(runs[0]?.env?.[TREE_KILL_SCAN_ROOTS_ENV], undefined);
});

test("killProcessesLockingTree runs Restart Manager kill script", async () => {
  if (process.platform !== "win32") {
    return;
  }

  const runs: { args: string[] }[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (_command: string, args: string[]) => {
      runs.push({ args });
      return { stdout: "", stderr: "", code: 0 };
    }),
  });

  await killProcessesLockingTree(
    step,
    "D:\\CI-Tools\\msys64-stage2\\msys64",
  );

  assert.deepEqual(
    runs[0]?.args,
    killTreePowerShellFileArgs(process.pid, killTreeRestartManagerScript()),
  );
});

test("killProcessesLockingTree accepts custom locker executables", async () => {
  if (process.platform !== "win32") {
    return;
  }

  const deleteFolder = "D:\\CI-Tools\\msys64-stage2\\msys64";
  const lockerExecutables = [
    "C:\\Windows\\System32\\cmd.exe",
    "D:\\tools\\custom\\make.exe",
  ];
  const runs: { env?: NodeJS.ProcessEnv }[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (_command: string, _args: string[], options?: RunOptions) => {
      runs.push({ env: options?.env });
      return { stdout: "", stderr: "", code: 0 };
    }),
  });

  await killProcessesLockingTree(step, deleteFolder, lockerExecutables);

  assert.equal(
    runs[0]?.env?.[TREE_KILL_LOCKER_EXECUTABLES_ENV],
    formatLockerExecutablesEnv(lockerExecutables),
  );
});

test("removeTreeWithKillRetry scans and deletes independently", async () => {
  if (process.platform !== "win32") {
    return;
  }

  const runs: { env?: NodeJS.ProcessEnv }[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (_command: string, _args: string[], options?: RunOptions) => {
      runs.push({ env: options?.env });
      return { stdout: "", stderr: "", code: 0 };
    }),
  });
  const scanTargets = [
    "D:\\CI-Tools\\custom-scan-a",
    "D:\\CI-Tools\\custom-scan-b",
  ];
  const deleteFolder = "D:\\CI-Tools\\custom-scan-a\\inner-tree";

  await removeTreeWithKillRetry(step, deleteFolder, scanTargets);

  assert.equal(
    runs[0]?.env?.[TREE_KILL_SCAN_ROOTS_ENV],
    formatScanTargetFoldersEnv(scanTargets),
  );
  assert.equal(
    runs[0]?.env?.[TREE_KILL_SCAN_ROOT_EXECUTABLES_ENV],
    formatScanTargetExecutablesEnv(scanTargets),
  );
  assert.equal(runs[0]?.env?.[TREE_KILL_LOCKER_EXECUTABLES_ENV], undefined);
});
