import assert from "node:assert/strict";
import { mock, test, type TestContext } from "node:test";
import * as realInstallMsys2Base from "../scripts/install-msys2-base.ts";
import * as realKillTree from "../scripts/kill-tree-processes.ts";
import * as realUtils from "../scripts/utils.ts";
import type { RunOptions } from "../scripts/run-context.ts";
import { makeMsys2Stage } from "./make-msys2-stage.ts";
import { makeRunLogger } from "./make-run-logger.ts";

const fsExistsAsyncMock = mock.fn(async (..._args: unknown[]) => true);
const runMsys2ScriptPathMock = mock.fn(async () => ({
  stdout: "",
  stderr: "",
  code: 0,
}));
const removeTreeWithKillRetryMock = mock.fn(async () => {});
const executePacmanInstallMock = mock.fn(async () => {});

let moduleLoaded = false;
let installStagesModule:
  | typeof import("../scripts/install-stages.ts")
  | undefined;

async function loadInstallStages(t: TestContext) {
  if (!moduleLoaded) {
    t.mock.module("../scripts/utils.ts", {
      namedExports: {
        ...realUtils,
        get fsExistsAsync() {
          return fsExistsAsyncMock;
        },
        get runMsys2ScriptPath() {
          return runMsys2ScriptPathMock;
        },
      },
    });
    t.mock.module("../scripts/kill-tree-processes.ts", {
      namedExports: {
        ...realKillTree,
        get removeTreeWithKillRetry() {
          return removeTreeWithKillRetryMock;
        },
      },
    });
    t.mock.module("../scripts/install-msys2-base.ts", {
      namedExports: {
        ...realInstallMsys2Base,
        get executePacmanInstall() {
          return executePacmanInstallMock;
        },
      },
    });
    installStagesModule = await import("../scripts/install-stages.ts");
    moduleLoaded = true;
  }
  return installStagesModule!;
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
    fsExistsAsyncMock,
    runMsys2ScriptPathMock,
    removeTreeWithKillRetryMock,
    executePacmanInstallMock,
  ]) {
    mockFn.mock.resetCalls();
    mockFn.mock.restore();
  }
  fsExistsAsyncMock.mock.mockImplementation(async (..._args: unknown[]) => true);
  runMsys2ScriptPathMock.mock.mockImplementation(async () => ({
    stdout: "",
    stderr: "",
    code: 0,
  }));
  removeTreeWithKillRetryMock.mock.mockImplementation(async () => {});
  executePacmanInstallMock.mock.mockImplementation(async () => {});
}

test("installMsys2AllPackages", async (t) => {
  resetFsMocks();
  const { installMsys2AllPackages } = await loadInstallStages(t);
  const stage = makeMsys2Stage("stage1");
  const msys_txt_cygwin = "/d/CI-Tools/msys64-stage1/msys64/msys.txt";
  const spawns: SpawnRecord[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options: RunOptions) => {
      if (command === stage.cygpath && args[1] === stage.baseInstalledMsysTxt) {
        return processResult(`${msys_txt_cygwin}\n`);
      }
      spawns.push({ command, args, options });
      return processResult();
    }),
  });

  await installMsys2AllPackages(step, stage);

  assert.deepEqual(
    {
      executePacmanInstallCalls: mockArguments(executePacmanInstallMock),
      runProcessCalls: spawnCalls(spawns),
    },
    {
      executePacmanInstallCalls: [
        [
          step,
          stage,
          [
            `sed -i 's/^SigLevel.*$/SigLevel=Never/g' /etc/pacman.conf`,
            `cat /etc/pacman.conf | grep ^SigLevel`,
            `pacman -S --noconfirm --needed $(cat ${msys_txt_cygwin})`,
          ],
          stage.msys2Root,
        ],
      ],
      runProcessCalls: [],
    },
  );
});
