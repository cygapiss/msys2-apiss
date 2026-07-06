import assert from "node:assert/strict";
import * as realFs from "node:fs/promises";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { mock, test, type TestContext } from "node:test";
import * as realUtils from "../scripts/utils.ts";
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
const symlinkDirectoryMock = mock.fn(
  async (...args: unknown[]) =>
    realUtils.symlinkDirectory(...(args as Parameters<typeof realUtils.symlinkDirectory>)),
);

let moduleLoaded = false;
let msys2CacheModule: typeof import("../scripts/msys2-cache.ts") | undefined;

async function loadMsys2Cache(t: TestContext) {
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
      },
    });
    t.mock.module("../scripts/utils.ts", {
      namedExports: {
        ...realUtils,
        get symlinkDirectory() {
          return symlinkDirectoryMock;
        },
      },
    });
    msys2CacheModule = await import("../scripts/msys2-cache.ts");
    moduleLoaded = true;
  }
  return msys2CacheModule!;
}

function mockArguments(mockFn: {
  mock: { calls: { arguments: unknown[] }[] };
}) {
  return mockFn.mock.calls.map((call) => call.arguments);
}

function resetFsMocks() {
  for (const mockFn of [writeFileMock, mkdirMock, symlinkDirectoryMock]) {
    mockFn.mock.resetCalls();
    mockFn.mock.restore();
  }
  writeFileMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.writeFile(...(args as Parameters<typeof realFs.writeFile>)),
  );
  mkdirMock.mock.mockImplementation(async (...args: unknown[]) =>
    realFs.mkdir(...(args as Parameters<typeof realFs.mkdir>)),
  );
  symlinkDirectoryMock.mock.mockImplementation(async (...args: unknown[]) =>
    realUtils.symlinkDirectory(...(args as Parameters<typeof realUtils.symlinkDirectory>)),
  );
}

test("linkMsys2Cache symlinks home and pacman to shared", async (t) => {
  resetFsMocks();
  mkdirMock.mock.mockImplementation(async (..._args: unknown[]) => undefined);
  symlinkDirectoryMock.mock.mockImplementation(async () => {});
  const { linkMsys2Cache } = await loadMsys2Cache(t);
  const stage = makeMsys2Stage("stage1");
  const local_home = path.resolve(stage.home);
  const local_pkg = path.resolve(stage.pacmanPkg);
  const shared_home = path.resolve(stage.sharedHome);
  const shared_pkg = path.resolve(stage.sharedPacmanPkg);
  const logs: string[] = [];
  const step = makeRunLogger({
    log: (...args: unknown[]) => logs.push(String(args[0])),
  });

  await linkMsys2Cache(step, stage);

  assert.deepEqual(
    {
      mkdirCalls: mockArguments(mkdirMock),
      writeFileCalls: mockArguments(writeFileMock),
      symlinkDirectoryCalls: mockArguments(symlinkDirectoryMock),
      logs,
    },
    {
      mkdirCalls: [
        [shared_pkg, { recursive: true }],
        [shared_home, { recursive: true }],
        [path.dirname(local_home), { recursive: true }],
        [shared_pkg, { recursive: true }],
        [path.dirname(local_pkg), { recursive: true }],
      ],
      writeFileCalls: [],
      symlinkDirectoryCalls: [
        [shared_home, local_home],
        [shared_pkg, local_pkg],
      ],
      logs: [`===linkMsys2Cache at ${stage.msys2Root}`],
    },
  );
});

test("unlinkMsys2Cache merges to shared and restores local home and pacmanPkg", async (t) => {
  resetFsMocks();
  t.mock.restoreAll();
  moduleLoaded = false;
  msys2CacheModule = undefined;
  const stage = makeMsys2Stage("stage1");
  const local_pkg = stage.pacmanPkg;
  const shared_pkg = stage.sharedPacmanPkg;
  const shared_home = stage.sharedHome;
  const pkg_file = path.join(local_pkg, "foo-1.pkg.tar.zst");
  await realFs.mkdir(local_pkg, { recursive: true });
  await writeFile(pkg_file, "package");
  await realFs.mkdir(shared_home, { recursive: true });
  await realFs.mkdir(path.dirname(stage.home), { recursive: true });
  await realUtils.symlinkDirectory(
    path.resolve(shared_home),
    path.resolve(stage.home),
  );
  await realFs.mkdir(stage.msys2Root, { recursive: true });
  await realFs.mkdir(path.dirname(stage.bash), { recursive: true });
  await writeFile(stage.bash, "");
  const logFiles: string[] = [];
  const step = makeRunLogger({
    logFile: (...args: unknown[]) => logFiles.push(String(args[0])),
    run: mock.fn(async () => ({
      stdout: `${stage.msys2Root}\n`,
      stderr: "",
      code: 0,
    })),
  });
  const { linkMsys2Cache, unlinkMsys2Cache } = await import("../scripts/msys2-cache.ts");

  await linkMsys2Cache(step, stage);
  await unlinkMsys2Cache(step, stage);

  await assert.doesNotReject(() => access(local_pkg));
  await assert.doesNotReject(() => access(stage.home));
  await assert.doesNotReject(() => access(path.join(shared_pkg, "foo-1.pkg.tar.zst")));
  await assert.doesNotReject(() => access(shared_home));
});

test("unlinkDirectory removes symlink without deleting shared target", async () => {
  const stage = makeMsys2Stage("stage1");
  const shared_pkg = stage.sharedPacmanPkg;
  const shared_file = path.join(shared_pkg, "keep.pkg.tar.zst");
  await realFs.mkdir(shared_pkg, { recursive: true });
  await writeFile(shared_file, "keep");
  await realFs.mkdir(path.dirname(stage.pacmanPkg), { recursive: true });
  await realUtils.symlinkDirectory(path.resolve(shared_pkg), path.resolve(stage.pacmanPkg));
  const { unlinkDirectory } = await import("../scripts/utils.ts");

  await unlinkDirectory(stage.pacmanPkg);

  await assert.rejects(() => access(stage.pacmanPkg));
  await assert.doesNotReject(() => access(shared_file));
});
