import assert from "node:assert/strict";
import * as realFs from "node:fs/promises";
import path from "node:path";
import { mock, test, type TestContext } from "node:test";
import { MSYS64_DIR_NAME } from "../scripts/build-config.ts";
import { hostTarPath } from "../scripts/utils.ts";
import * as realUtils from "../scripts/utils.ts";
import type { RunOptions } from "../scripts/run-context.ts";
import { makeMsys2Stage } from "./make-msys2-stage.ts";
import { makeRunLogger } from "./make-run-logger.ts";

const writeFileMock = mock.fn(
  async (...args: unknown[]) =>
    realFs.writeFile(...(args as Parameters<typeof realFs.writeFile>)),
);
const mkdirMock = mock.fn(
  async (...args: unknown[]) =>
    realFs.mkdir(...(args as Parameters<typeof realFs.mkdir>)),
);
const symlinkMock = mock.fn(
  async (...args: unknown[]) =>
    realFs.symlink(...(args as Parameters<typeof realFs.symlink>)),
);
const copyFileMock = mock.fn(
  async (...args: unknown[]) =>
    realFs.copyFile(...(args as Parameters<typeof realFs.copyFile>)),
);
const rmMock = mock.fn(async () => {});
const fsExistsAsyncMock = mock.fn(async (..._args: unknown[]) => true);
const runMsys2ScriptPathMock = mock.fn(async () => ({
  stdout: "",
  stderr: "",
  code: 0,
}));
const removeTreeWithKillRetryMock = mock.fn(async () => {});
const linkMsys2CacheMock = mock.fn(async () => {});
const unlinkMsys2CacheMock = mock.fn(async () => {});
const unlinkDirectoryMock = mock.fn(async () => {});

let moduleLoaded = false;
let installMsys2BaseModule:
  | typeof import("../scripts/install-msys2-base.ts")
  | undefined;

async function loadInstallMsys2Base(t: TestContext) {
  if (!moduleLoaded) {
    t.mock.module("node:fs/promises", {
      namedExports: {
        ...realFs,
        get writeFile() {
          return writeFileMock;
        },
        get mkdir() {
          return mkdirMock;
        },
        get symlink() {
          return symlinkMock;
        },
        get rm() {
          return rmMock;
        },
        get copyFile() {
          return copyFileMock;
        },
      },
    });
    t.mock.module("../scripts/utils.ts", {
      namedExports: {
        ...realUtils,
        get fsExistsAsync() {
          return fsExistsAsyncMock;
        },
        get assertMsys2Root() {
          return async (
            step: Parameters<typeof realUtils.assertMsys2Root>[0],
            stage: Parameters<typeof realUtils.assertMsys2Root>[1],
            prepStepId: string,
          ) => {
            if (
              !(await fsExistsAsyncMock(stage.msys2Root)) ||
              !(await fsExistsAsyncMock(stage.bash))
            ) {
              throw new Error(
                `msys64 not found at ${stage.msys2Root}; run ${prepStepId} first`,
              );
            }
            const { stdout, code } = await step.run(
              stage.bash,
              ["--login", "-c", "cygpath -w /"],
              {
                cwd: stage.repoRoot,
                env: stage.env,
                capture: true,
                exitOnFailure: false,
              },
            );
            if (code !== 0) {
              throw new Error(
                `msys64 cygpath check failed at ${stage.bash} (code ${code}); run ${prepStepId} first`,
              );
            }
            const cygpath_msys_root = path.win32.normalize(stdout.trim());
            const expected_msys_root = path.win32.normalize(stage.msys2Root);
            if (
              path.resolve(cygpath_msys_root) !==
              path.resolve(expected_msys_root)
            ) {
              throw new Error(
                `msys64 cygpath -w / returned ${cygpath_msys_root}, expected ${expected_msys_root}; run ${prepStepId} first`,
              );
            }
          };
        },
        get runMsys2ScriptPath() {
          return runMsys2ScriptPathMock;
        },
        get unlinkDirectory() {
          return unlinkDirectoryMock;
        },
      },
    });
    t.mock.module("../scripts/kill-tree-processes.ts", {
      namedExports: {
        get removeTreeWithKillRetry() {
          return removeTreeWithKillRetryMock;
        },
      },
    });
    const realMsys2Cache = await import("../scripts/msys2-cache.ts");
    t.mock.module("../scripts/msys2-cache.ts", {
      namedExports: {
        ensureMsys2BaseTarballCached:
          realMsys2Cache.ensureMsys2BaseTarballCached,
        get linkMsys2Cache() {
          return linkMsys2CacheMock;
        },
        get unlinkMsys2Cache() {
          return unlinkMsys2CacheMock;
        },
      },
    });
    installMsys2BaseModule = await import("../scripts/install-msys2-base.ts");
    moduleLoaded = true;
  }
  return installMsys2BaseModule!;
}

function mockArguments(mockFn: {
  mock: { calls: { arguments: unknown[] }[] };
}) {
  return mockFn.mock.calls.map((call) => call.arguments);
}

type SpawnRecord = {
  command: string;
  args: string[];
  options: RunOptions;
};

function spawnCalls(spawns: SpawnRecord[]) {
  return spawns.map((spawn) => ({
    command: spawn.command,
    args: spawn.args,
    cwd: spawn.options.cwd,
    env: spawn.options.env,
  }));
}

function processResult(stdout = "", code = 0) {
  return { stdout, stderr: "", code };
}

function resetFsMocks() {
  for (const mockFn of [
    writeFileMock,
    mkdirMock,
    symlinkMock,
    copyFileMock,
    rmMock,
    fsExistsAsyncMock,
    runMsys2ScriptPathMock,
    removeTreeWithKillRetryMock,
    linkMsys2CacheMock,
    unlinkMsys2CacheMock,
    unlinkDirectoryMock,
  ]) {
    mockFn.mock.resetCalls();
    mockFn.mock.restore();
  }
  writeFileMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.writeFile(...(args as Parameters<typeof realFs.writeFile>)),
  );
  mkdirMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.mkdir(...(args as Parameters<typeof realFs.mkdir>)),
  );
  symlinkMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.symlink(...(args as Parameters<typeof realFs.symlink>)),
  );
  copyFileMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.copyFile(...(args as Parameters<typeof realFs.copyFile>)),
  );
  rmMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.rm(...(args as Parameters<typeof realFs.rm>)),
  );
  fsExistsAsyncMock.mock.mockImplementation(async (..._args: unknown[]) => true);
  runMsys2ScriptPathMock.mock.mockImplementation(async () => ({
    stdout: "",
    stderr: "",
    code: 0,
  }));
  removeTreeWithKillRetryMock.mock.mockImplementation(async () => {});
  linkMsys2CacheMock.mock.mockImplementation(async () => {});
  unlinkMsys2CacheMock.mock.mockImplementation(async () => {});
  unlinkDirectoryMock.mock.mockImplementation(async () => {});
}

test("installMsys2Base", async (t) => {
  resetFsMocks();
  mkdirMock.mock.mockImplementation(async (..._args: unknown[]) => undefined);
  writeFileMock.mock.mockImplementation(async () => {});
  symlinkMock.mock.mockImplementation(async () => {});
  const stage = makeMsys2Stage("stage1");
  const cache_path = stage.baseInstalledTarball;
  fsExistsAsyncMock.mock.mockImplementation(async (target: unknown) => {
    if (target === cache_path) {
      return false;
    }
    return true;
  });
  const { installMsys2Base } = await loadInstallMsys2Base(t);
  const spawns: SpawnRecord[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options: RunOptions) => {
      spawns.push({ command, args, options });
      if (
        command === stage.bash &&
        args[0] === "--login" &&
        args[1] === "-c" &&
        args[2] === "cygpath -w /"
      ) {
        return processResult(`${stage.msys2Root}\n`);
      }
      if (command === stage.cygpath && args[0] === "-u" && args[1] === cache_path) {
        return processResult(`${cache_path}\n`);
      }
      return processResult();
    }),
  });

  await installMsys2Base(step, stage, false);

  assert.deepEqual(
    {
      removeTreeCalls: removeTreeWithKillRetryMock.mock.callCount(),
      linkMsys2CacheCalls: 1,
      unlinkMsys2CacheCalls: unlinkMsys2CacheMock.mock.callCount(),
      runProcessCalls: spawnCalls(spawns),
    },
    {
      removeTreeCalls: 0,
      linkMsys2CacheCalls: 1,
      unlinkMsys2CacheCalls: 2,
      runProcessCalls: [
        {
          command: stage.bash,
          args: ["--login", "-c", "cygpath -w /"],
          cwd: stage.repoRoot,
          env: stage.env,
        },
        ...[
          "pacman -Sy --noconfirm",
          "pacman -S --noconfirm --needed pacman",
        ].map((install_command) => ({
          command: stage.bash,
          args: [
            "--login",
            "-c",
            `{ yes 2>/dev/null; } | head -n 64 | { ${install_command}; }`,
          ],
          cwd: stage.msys2Root,
          env: stage.env,
        })),
        ...[
          "pacman -S --noconfirm --needed bash filesystem mintty msys2-runtime pacman-mirrors",
          "pacman -Syu --noconfirm",
        ].map((install_command) => ({
          command: stage.bash,
          args: [
            "--login",
            "-c",
            `{ yes 2>/dev/null; } | head -n 64 | { ${install_command}; }`,
          ],
          cwd: stage.msys2Root,
          env: stage.env,
        })),
        {
          command: stage.pacman,
          args: ["-Sl", "msys"],
          cwd: undefined,
          env: undefined,
        },
        {
          command: stage.cygpath,
          args: ["-u", cache_path],
          cwd: undefined,
          env: undefined,
        },
        {
          command: stage.tar,
          args: ["cf", cache_path, MSYS64_DIR_NAME],
          cwd: stage.stageRoot,
          env: stage.env,
        },
      ],
    },
  );
});

test("installMsys2Base extracts from cached upstream tarball", async (t) => {
  resetFsMocks();
  mkdirMock.mock.mockImplementation(async (..._args: unknown[]) => undefined);
  writeFileMock.mock.mockImplementation(async () => {});
  symlinkMock.mock.mockImplementation(async () => {});
  const stage = makeMsys2Stage("stage1");
  const installed_cache = stage.baseInstalledTarball;
  const upstream_tarball = stage.baseTarball;
  fsExistsAsyncMock.mock.mockImplementation(async (target: unknown) => {
    if (target === installed_cache) {
      return false;
    }
    if (target === upstream_tarball) {
      return true;
    }
    if (target === stage.msys2Root) {
      return false;
    }
    return false;
  });
  const { installMsys2Base } = await loadInstallMsys2Base(t);
  const spawns: SpawnRecord[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options: RunOptions) => {
      spawns.push({ command, args, options });
      if (command === stage.cygpath && args[0] === "-u" && args[1] === installed_cache) {
        return processResult(`${installed_cache}\n`);
      }
      return processResult();
    }),
  });

  await installMsys2Base(step, stage, false);

  assert.equal(spawns[0]?.command, "tar");
  assert.deepEqual(spawns[0]?.args, ["xf", upstream_tarball]);
  assert.equal(spawns[0]?.options.cwd, stage.stageRoot);
  assert.equal(linkMsys2CacheMock.mock.callCount(), 1);
  assert.equal(unlinkMsys2CacheMock.mock.callCount(), 2);
  assert.equal(
    spawns.at(-1)?.command,
    stage.tar,
    "writes installed result cache after bootstrap",
  );
  assert.equal(spawns.at(-1)?.args[0], "cf");
});

test("installMsys2Base throws when cache restore tar fails", async (t) => {
  resetFsMocks();
  const stage = makeMsys2Stage("stage1");
  const cache_path = stage.baseInstalledTarball;
  fsExistsAsyncMock.mock.mockImplementation(async (target: unknown) =>
    target === cache_path ||
    target === stage.baseTarball ||
    target === stage.msys2Root,
  );
  const { installMsys2Base } = await loadInstallMsys2Base(t);
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[]) => {
      if (command === hostTarPath() && args[0] === "-xf" && args[1] === cache_path) {
        return processResult("", 1);
      }
      return processResult();
    }),
  });

  await assert.rejects(
    () => installMsys2Base(step, stage, true),
    (err) => {
      assert.ok(err instanceof Error);
      assert.match(
        err.message,
        new RegExp(
          `Failed to restore MSYS2 base packages from cache \\(1\\): ${cache_path.replace(/\\/g, "\\\\")}`,
        ),
      );
      return true;
    },
  );
  assert.equal(removeTreeWithKillRetryMock.mock.callCount(), 1);
});

test("installMsys2Base restores from base packages cache", async (t) => {
  resetFsMocks();
  const stage = makeMsys2Stage("stage2");
  const cache_path = stage.baseInstalledTarball;
  fsExistsAsyncMock.mock.mockImplementation(async (target: unknown) =>
    target === cache_path ||
    target === stage.baseTarball,
  );
  const { installMsys2Base } = await loadInstallMsys2Base(t);
  const spawns: SpawnRecord[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options: RunOptions) => {
      spawns.push({ command, args, options });
      return processResult();
    }),
  });

  await installMsys2Base(step, stage, false);

  assert.deepEqual(
    {
      copyFileCalls: mockArguments(copyFileMock),
      runProcessCalls: spawnCalls(spawns),
    },
    {
      copyFileCalls: [],
      runProcessCalls: [
        {
          command: hostTarPath(),
          args: ["-xf", cache_path],
          cwd: stage.stageRoot,
          env: undefined,
        },
      ],
    },
  );
});

test("clearMsys2 merges pacman cache before remove", async (t) => {
  resetFsMocks();
  const stage = makeMsys2Stage("stage1");
  fsExistsAsyncMock.mock.mockImplementation(async (target: unknown) =>
    target === stage.msys2Root,
  );
  const { clearMsys2 } = await loadInstallMsys2Base(t);
  const step = makeRunLogger();

  await clearMsys2(step, stage);

  assert.equal(unlinkMsys2CacheMock.mock.callCount(), 1);
  assert.equal(removeTreeWithKillRetryMock.mock.callCount(), 1);
});

test("clearMsys2 throws when removeTreeWithKillRetry fails", async (t) => {
  resetFsMocks();
  const stage = makeMsys2Stage("stage1");
  fsExistsAsyncMock.mock.mockImplementation(async (target: unknown) =>
    target === stage.msys2Root,
  );
  const { clearMsys2 } = await loadInstallMsys2Base(t);
  removeTreeWithKillRetryMock.mock.mockImplementation(async () => {
    throw new Error(
      `remove ${stage.msys2Root} failed: EPERM: operation not permitted`,
    );
  });
  const step = makeRunLogger();

  await assert.rejects(
    () => clearMsys2(step, stage),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(
        err.message,
        `remove ${stage.msys2Root} failed: EPERM: operation not permitted`,
      );
      return true;
    },
  );

  assert.equal(unlinkMsys2CacheMock.mock.callCount(), 1);
  assert.equal(removeTreeWithKillRetryMock.mock.callCount(), 1);
});

test("installMsys2Base propagates clearMsys2 failure", async (t) => {
  resetFsMocks();
  const stage = makeMsys2Stage("stage1");
  const step = makeRunLogger();
  const { installMsys2Base } = await loadInstallMsys2Base(t);
  removeTreeWithKillRetryMock.mock.mockImplementation(async () => {
    throw new Error(
      `remove ${stage.msys2Root} failed: EPERM: operation not permitted`,
    );
  });

  await assert.rejects(
    () => installMsys2Base(step, stage, true),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(
        err.message,
        `remove ${stage.msys2Root} failed: EPERM: operation not permitted`,
      );
      return true;
    },
  );

  assert.equal(removeTreeWithKillRetryMock.mock.callCount(), 1);
});

test("archiveFull", async (t) => {
  resetFsMocks();
  rmMock.mock.mockImplementation(async () => {});
  mkdirMock.mock.mockImplementation(async (..._args: unknown[]) => undefined);
  writeFileMock.mock.mockImplementation(async () => {});
  const { archiveFull } = await loadInstallMsys2Base(t);
  const stage = makeMsys2Stage("stage1");
  const msys2_base_filename = "msys2-base-x86_64-20251213-full.tar";
  const target_msys_tar_path = path.join(stage.stageRoot, msys2_base_filename);
  const target_msys_tar_path_cygwin = "/d/CI-Tools/msys64-stage1/msys2-base-x86_64-20251213-full.tar";
  const spawns: SpawnRecord[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options: RunOptions) => {
      if (command === stage.cygpath && args[1] === target_msys_tar_path) {
        return processResult(`${target_msys_tar_path_cygwin}\n`);
      }
      spawns.push({ command, args, options });
      return processResult();
    }),
  });

  await archiveFull(step, stage, target_msys_tar_path);

  assert.deepEqual(
    {
      rmCalls: mockArguments(rmMock),
      unlinkMsys2CacheCalls: mockArguments(unlinkMsys2CacheMock),
      runProcessCalls: spawnCalls(spawns),
    },
    {
      rmCalls: [
        [
          target_msys_tar_path,
          { force: true, recursive: true },
        ],
      ],
      unlinkMsys2CacheCalls: [[step, stage]],
      runProcessCalls: [
        {
          command: stage.tar,
          args: [
            "cf",
            target_msys_tar_path_cygwin,
            MSYS64_DIR_NAME,
          ],
          cwd: stage.stageRoot,
          env: stage.env,
        },
      ],
    },
  );
});

test("archiveFull finalizes stage archive", async (t) => {
  resetFsMocks();
  rmMock.mock.mockImplementation(async () => {});
  mkdirMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.mkdir(...(args as Parameters<typeof realFs.mkdir>)),
  );
  writeFileMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.writeFile(...(args as Parameters<typeof realFs.writeFile>)),
  );
  const { archiveFull } = await loadInstallMsys2Base(t);
  const stage = makeMsys2Stage("stage1");
  const archive_name = "msys2-base-x86_64-20251213-full.tar";
  const target_msys_tar_path = path.join(stage.stageRoot, archive_name);
  const target_msys_tar_path_cygwin = "/d/CI-Tools/msys64-stage1/msys2-base-x86_64-20251213-full.tar";
  const logs: string[] = [];
  const logFiles: string[] = [];
  const spawns: SpawnRecord[] = [];
  const step = makeRunLogger({
    log: (...args: unknown[]) => logs.push(String(args[0])),
    logFile: (...args: unknown[]) => logFiles.push(String(args[0])),
    run: mock.fn(async (command: string, args: string[], options: RunOptions) => {
      if (command === stage.cygpath && args[1] === target_msys_tar_path) {
        return processResult(`${target_msys_tar_path_cygwin}\n`);
      }
      spawns.push({ command, args, options });
      return processResult();
    }),
  });

  await archiveFull(step, stage, target_msys_tar_path, "stage1");

  assert.equal(unlinkMsys2CacheMock.mock.callCount(), 1);
  assert.equal(linkMsys2CacheMock.mock.callCount(), 1);
  assert.deepEqual(linkMsys2CacheMock.mock.calls[0]?.arguments, [step, stage]);
  assert.deepEqual(logs, [
    `===Compress msys64 into ${target_msys_tar_path}`,
    `===stage1: Archive finished as: ${archive_name}`,
    "===stage1: Wrote extract.bat and delete-msys64.bat",
  ]);
  assert.ok(logFiles.some((line) => line.includes("extract.bat")));
  assert.ok(logFiles.some((line) => line.includes("delete-msys64.bat")));
  assert.deepEqual(
    spawns[0],
    {
      command: stage.tar,
      args: ["cf", target_msys_tar_path_cygwin, MSYS64_DIR_NAME],
      options: { cwd: stage.stageRoot, env: stage.env },
    },
  );

  const extractBat = await realFs.readFile(
    path.join(stage.stageRoot, "extract.bat"),
    "utf-8",
  );
  const deleteBat = await realFs.readFile(
    path.join(stage.stageRoot, "delete-msys64.bat"),
    "utf-8",
  );
  assert.match(extractBat, new RegExp(archive_name.replace(".", "\\.")));
  assert.match(deleteBat, /safe_unlink_dir|msys64/);
});

test("wrapPacmanNonInteractiveCommand pipes bounded yes into pacman", async () => {
  const { wrapPacmanNonInteractiveCommand } = await import(
    "../scripts/install-msys2-base.ts"
  );
  assert.equal(
    wrapPacmanNonInteractiveCommand("pacman -Syu --noconfirm"),
    "{ yes 2>/dev/null; } | head -n 64 | { pacman -Syu --noconfirm; }",
  );
});

test("getYYYYMMDD", async () => {
  const { getYYYYMMDD } = await import("../scripts/install-msys2-base.ts");
  assert.equal(getYYYYMMDD(new Date(2025, 11, 13)), "20251213");
  assert.equal(getYYYYMMDD(new Date(2025, 0, 5)), "20250105");
});

test("msys64FullArchiveFilename", async () => {
  const { msys64FullArchiveFilename } = await import(
    "../scripts/install-msys2-base.ts"
  );
  const date = new Date(2025, 11, 13);
  assert.equal(
    msys64FullArchiveFilename(date),
    "msys2-installed-x86_64-20251213.tar",
  );
});
