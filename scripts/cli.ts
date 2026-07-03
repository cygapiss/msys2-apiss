import process from "node:process";
import {
  BUILD_PACKAGE_LIST_STAGE_CONFIG,
  BUILD_PACKAGE_LIST_STAGES,
  SCRIPTS_LOGS_DIR,
  isMsys2StageId,
  type Msys2StageId,
  type Msys2StageTreeId,
} from "./build-config.ts";
import {
  downloadRuntimePackagesInit,
  installMsys2HookRuntime,
  installMsys2OriginalRuntime,
} from "./msys2-runtime-bootstrap.ts";
import { runGenerateDepsJson } from "./generate-deps-json.ts";
import { runGeneratePackageLists } from "./generate-package-lists.ts";
import {
  killProcessesWithExecutableUnder,
  removeTreeWithKillRetry,
} from "./kill-tree-processes.ts";
import {
  runBuildPackageList,
  type RunPackageListOptions,
} from "./package-build-pipeline.ts";
import { RunContext } from "./run-context.ts";
import { assertMsys2Root, initMsys2Stage, repoPath } from "./utils.ts";

const BUILD_LIST_INIT_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "stage1-build-list-init.txt",
);

const DOWNLOAD_RUNTIME_INIT_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "stage1-download-runtime-init.txt",
);

const INSTALL_MSYS2_ORIGINAL_RUNTIME_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "install-msys2-original-runtime.txt",
);

const INSTALL_MSYS2_HOOK_RUNTIME_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "install-msys2-hook-runtime.txt",
);

const INSTALL_FOR_STAGE1_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "stage1-install-prep.txt",
);

const INSTALL_FOR_STAGE2_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "install-for-stage2.txt",
);

const INSTALL_FOR_STAGE3_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "install-for-stage3.txt",
);

const INSTALL_MINGW_FOR_STAGE3_LOG = repoPath(
  SCRIPTS_LOGS_DIR,
  "install-for-stage3-mingw64.txt",
);

type InstallStageRunner = (step: RunContext) => Promise<void>;

const INSTALL_STAGE_COMMANDS = {
  "install-for-stage1": {
    log: INSTALL_FOR_STAGE1_LOG,
    stage: "stage1",
  },
  "install-for-stage2": {
    log: INSTALL_FOR_STAGE2_LOG,
    stage: "stage2",
  },
  "install-for-stage3": {
    log: INSTALL_FOR_STAGE3_LOG,
    stage: "stage3",
  },
  "install-for-stage3-mingw64": {
    log: INSTALL_MINGW_FOR_STAGE3_LOG,
    stage: "stage3-mingw64",
  },
} as const satisfies Record<
  string,
  {
    log: string;
    stage: Msys2StageTreeId;
  }
>;

type InstallStageCommand = keyof typeof INSTALL_STAGE_COMMANDS;

async function importInstallStageRunner(
  spec: string,
  exportName: string,
): Promise<InstallStageRunner> {
  const mod = await import(spec);
  return mod[exportName] as InstallStageRunner;
}

async function loadInstallStageRunner(
  command: InstallStageCommand,
): Promise<InstallStageRunner> {
  switch (command) {
    case "install-for-stage1":
      return importInstallStageRunner(
        "../install-for-stage1.mjs",
        "runInstallForStage1",
      );
    case "install-for-stage2":
      return importInstallStageRunner(
        "../install-for-stage2.mjs",
        "runInstallForStage2",
      );
    case "install-for-stage3":
      return importInstallStageRunner(
        "../install-for-stage3.mjs",
        "runInstallForStage3",
      );
    case "install-for-stage3-mingw64":
      return importInstallStageRunner(
        "../install-for-stage3-mingw64.mjs",
        "runInstallForStage3Mingw64",
      );
  }
}

function isInstallStageCommand(command: string): command is InstallStageCommand {
  return Object.hasOwn(INSTALL_STAGE_COMMANDS, command);
}

async function runInstallStageCommand(command: InstallStageCommand) {
  const { log, stage } = INSTALL_STAGE_COMMANDS[command];
  const run = await loadInstallStageRunner(command);
  console.log(`=== Running ${command} ...`);
  console.log(`=== Log file: ${log}`);
  const step = new RunContext(log);
  await step.step(async (step) => {
    const stageRoot = initMsys2Stage(step, stage).stageRoot;
    await killProcessesWithExecutableUnder(step, [stageRoot]);
    await run(step);
  });
  console.log(`=== Finished ${command}; log: ${log}`);
}

async function runKillStageProcessesCommand(stage_rootName: string) {
  const step = new RunContext(null, { exitOnFailure: false });
  await step.step(async (step) => {
    const stage = initMsys2Stage(step, stage_rootName as Msys2StageId);
    console.log(`Killing processes and removing ${stage.msys2Root} ...`);
    await removeTreeWithKillRetry(step, stage.msys2Root, [stage.stageRoot]);
  });
}

async function runDownloadRuntimeInitCommand() {
  console.log(`Download runtime init packages to ${DOWNLOAD_RUNTIME_INIT_LOG}`);
  const step = new RunContext(DOWNLOAD_RUNTIME_INIT_LOG);
  await step.step(async (step) => {
    const stage = initMsys2Stage(step, "stage1");
    await downloadRuntimePackagesInit(step, stage);
  });
}

async function runInstallMsys2OriginalRuntimeCommand() {
  console.log(`Install original msys2-runtime to ${INSTALL_MSYS2_ORIGINAL_RUNTIME_LOG}`);
  const step = new RunContext(INSTALL_MSYS2_ORIGINAL_RUNTIME_LOG);
  await step.step(async (step) => {
    const stage = initMsys2Stage(step, "stage1");
    await installMsys2OriginalRuntime(step, stage);
  });
}

async function runInstallMsys2HookRuntimeCommand() {
  console.log(`Install hook msys2-runtime to ${INSTALL_MSYS2_HOOK_RUNTIME_LOG}`);
  const step = new RunContext(INSTALL_MSYS2_HOOK_RUNTIME_LOG);
  await step.step(async (step) => {
    const stage = initMsys2Stage(step, "stage1");
    await installMsys2HookRuntime(step, stage);
  });
}

async function runBuildListInitCommand() {
  console.log(`Generate build lists to ${BUILD_LIST_INIT_LOG}`);
  const step = new RunContext(BUILD_LIST_INIT_LOG);
  await step.step(async (step) => {
    const stage = initMsys2Stage(step, "stage1");
    await assertMsys2Root(step, stage, "stage1-install-prep and extract_msys64");
    await runGenerateDepsJson(step, stage);
    await runGeneratePackageLists(step, stage);
  });
}

const BUILD_PACKAGE_LIST_USAGE = `Usage: node scripts/cli.ts build-package-list <${BUILD_PACKAGE_LIST_STAGES.join("|")}> [--from <pkg>] [--only-one] [--no-extract]`;

function parseBuildPackageListOptions(args: string[]): RunPackageListOptions {
  const options: RunPackageListOptions = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--only-one") {
      options.onlyOne = true;
    } else if (arg === "--no-extract") {
      options.noExtract = true;
    } else if (arg === "--from") {
      const value = args[i + 1];
      if (!value) {
        console.error("--from requires a package name");
        console.error(BUILD_PACKAGE_LIST_USAGE);
        process.exit(1);
      }
      options.fromPackage = value;
      i += 1;
    } else {
      console.error(`Unknown build-package-list option: ${arg}`);
      console.error(BUILD_PACKAGE_LIST_USAGE);
      process.exit(1);
    }
  }
  return options;
}

async function runBuildPackageListCommand(
  stageId: string,
  options: RunPackageListOptions,
) {
  if (!isMsys2StageId(stageId)) {
    console.error(BUILD_PACKAGE_LIST_USAGE);
    process.exit(1);
  }
  const logPath = repoPath(SCRIPTS_LOGS_DIR, `build-${stageId}.txt`);
  const prepStepId = `${BUILD_PACKAGE_LIST_STAGE_CONFIG[stageId].stageTreeId}-extract`;
  console.log(`Build package list ${stageId} to ${logPath}`);
  const step = new RunContext(logPath);
  await step.step(async (step) => {
    await runBuildPackageList(step, stageId, prepStepId, options);
  });
  console.log(`Finished build package list ${stageId}; log: ${logPath}`);
}

async function main() {
  const command = process.argv[2];
  if (command === "build-list-init") {
    await runBuildListInitCommand();
    return;
  }
  if (command === "download-runtime-init") {
    await runDownloadRuntimeInitCommand();
    return;
  }
  if (command === "install-msys2-original-runtime") {
    await runInstallMsys2OriginalRuntimeCommand();
    return;
  }
  if (command === "install-msys2-hook-runtime") {
    await runInstallMsys2HookRuntimeCommand();
    return;
  }
  if (isInstallStageCommand(command)) {
    await runInstallStageCommand(command);
    return;
  }
  if (command === "kill-stage-processes") {
    const stage_rootName = process.argv[3];
    if (!stage_rootName) {
      console.error(
        "Usage: node scripts/cli.ts kill-stage-processes <stage-dir-name>",
      );
      process.exit(1);
    }
    await runKillStageProcessesCommand(stage_rootName);
    return;
  }
  if (command === "build-package-list") {
    const stageId = process.argv[3];
    if (!stageId) {
      console.error(BUILD_PACKAGE_LIST_USAGE);
      process.exit(1);
    }
    const options = parseBuildPackageListOptions(process.argv.slice(4));
    await runBuildPackageListCommand(stageId, options);
    return;
  }
  console.error("Usage: node scripts/cli.ts build-list-init");
  console.error("       node scripts/cli.ts download-runtime-init");
  console.error("       node scripts/cli.ts install-msys2-original-runtime");
  console.error("       node scripts/cli.ts install-msys2-hook-runtime");
  console.error(
    `       node scripts/cli.ts install-for-stage1|install-for-stage2|install-for-stage3|install-for-stage3-mingw64`,
  );
  console.error("       node scripts/cli.ts kill-stage-processes <stage-dir-name>");
  console.error(
    `       node scripts/cli.ts build-package-list <${BUILD_PACKAGE_LIST_STAGES.join("|")}> [--from <pkg>] [--only-one] [--no-extract]`,
  );
  process.exit(1);
}

main();
