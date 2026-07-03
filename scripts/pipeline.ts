import { runGenerateDepsJson } from "./generate-deps-json.ts";
import { runGeneratePackageLists } from "./generate-package-lists.ts";
import {
  downloadRuntimePackagesInit,
  installMsys2HookRuntime,
  installMsys2OriginalRuntime,
} from "./msys2-runtime-bootstrap.ts";
import {
  archiveMingwStage3,
  extractMsys2Stage,
  extractMsys2Stage3MingwFromArchive,
  installMingwBuiltPackagesStage3,
  installMingwPacmanPackagesStage3,
  installStage1,
  installStage2,
  installStage3,
} from "./install-stages.ts";
import {
  runBuildPackageList,
  type RunPackageListOptions,
} from "./package-build-pipeline.ts";
import { RunContext } from "./run-context.ts";
import { checkStageDepsForStage } from "./stage-deps-check.ts";
import {
  initMsys2Stage,
  repoPath,
} from "./utils.ts";

export type PipelineStep = {
  id: string;
  group: number;
  /** Group heading for start.bat --help (set on the first step in each group). */
  groupLabel?: string;
  label: string;
  /** Default follow-on when running the full pipeline or printing --only hints. */
  nextStep?: string;
  step: (step: RunContext, options: RunPackageListOptions) => Promise<void>;
};

export function pipelineMaxGroup() {
  return pipelines.reduce((max, item) => Math.max(max, item.group), 0);
}

export function formatPipelineGroupsHelp() {
  const seen = new Set<number>();
  const lines: string[] = [];
  for (const item of pipelines) {
    if (seen.has(item.group) || !item.groupLabel) {
      continue;
    }
    seen.add(item.group);
    const stepCount = pipelines.filter((p) => p.group === item.group).length;
    let line = `  ${item.group}. ${item.groupLabel}`;
    if (stepCount > 1) {
      line += ` (${stepCount} steps)`;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function formatPipelineStepsHelp() {
  const idWidth = Math.max(...pipelines.map((item) => item.id.length));
  return pipelines
    .map(
      (item) =>
        `  ${item.group}. ${item.id.padEnd(idWidth)} ${item.label}`,
    )
    .join("\n");
}

export function pipelineLogName(id: string) {
  return `${id}.txt`;
}

let activePipelineRunContext: RunContext | null = null;
let pipelineSigintExitPending = false;

export function getActivePipelineRunContext() {
  return activePipelineRunContext;
}

/** Reset SIGINT guard; for tests only. */
export function resetPipelineSigintStateForTest() {
  pipelineSigintExitPending = false;
}

export type HandlePipelineSigintDeps = {
  getActiveRunContext?: () => RunContext | null;
  exit?: (code: number) => void;
};

export function handlePipelineSigint(deps: HandlePipelineSigintDeps = {}) {
  if (pipelineSigintExitPending) {
    return;
  }
  pipelineSigintExitPending = true;
  const getActiveRunContext =
    deps.getActiveRunContext ?? getActivePipelineRunContext;
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const activeRunContext = getActiveRunContext();
  if (activeRunContext) {
    void activeRunContext.closeLogStream().finally(() => exit(130));
    return;
  }
  exit(130);
}

export async function runPipelineStep(
  item: PipelineStep,
  options: RunPackageListOptions,
) {
  const logPath = repoPath("scripts", "logs", pipelineLogName(item.id));
  const runner = new RunContext(logPath);
  activePipelineRunContext = runner;
  try {
    await runner.step(async (step) => {
      runner.log(item.label);
      runner.log(`Log: ${logPath}`);
      await item.step(step, options);
    });
  } finally {
    if (activePipelineRunContext === runner) {
      activePipelineRunContext = null;
    }
  }
}

export const pipelines: PipelineStep[] = [
  {
    id: "stage1-install-prep",
    group: 1,
    groupLabel: "stage1 install prep",
    label: "Install MSYS base packages into msys64-stage1",
    step: installStage1,
    // install-prep leaves a live tree and archive; skip optional stage1-extract.
    nextStep: "stage1-generate-deps-json",
  },
  {
    id: "stage1-extract",
    group: 2,
    groupLabel: "stage1 extract archive",
    label: "Extract msys64-stage1 from archive",
    step: async (step) => {
      await extractMsys2Stage(step, "stage1");
    },
  },
  {
    id: "stage1-generate-deps-json",
    group: 3,
    groupLabel: "stage1 deps and package lists",
    label: "Generate scripts/generated/deps.json (generate-deps-json.ts)",
    step: async (step) => {
      const stage = initMsys2Stage(step, "stage1");
      await runGenerateDepsJson(step, stage);
    },
  },
  {
    id: "stage1-generate-package-lists",
    group: 3,
    label: "Generate stage1/stage2 package lists (generate-package-lists.ts)",
    step: async (step) => {
      const stage = initMsys2Stage(step, "stage1");
      await runGeneratePackageLists(step, stage);
    },
  },
  {
    id: "stage1-rt-origin-download",
    group: 4,
    groupLabel: "stage1 hook/runtime builds",
    label: "Download runtime init packages into dist-pkg",
    step: async (step) => {
      const stage = initMsys2Stage(step, "stage1");
      await downloadRuntimePackagesInit(step, stage);
    },
  },
  {
    id: "stage1-rt-origin-install",
    group: 4,
    label: "Install original msys2-runtime packages",
    step: async (step) => {
      const stage = initMsys2Stage(step, "stage1");
      // Install twice because we may downgrade msys2-runtime and cause fork error.
      // 0 [main] pacman 414 dofork: child -1 - forked process 27040 died unexpectedly,
      // retry 0, exit code 0xC0000005, errno 11
      await installMsys2OriginalRuntime(step, stage);
      await installMsys2OriginalRuntime(step, stage);
    },
  },
  {
    id: "stage1-rt-hook-list-build",
    group: 4,
    label: "Build msys2-runtime (stage1-rt-hook-list.txt)",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage1-rt-hook", "stage1-extract", options);
    },
  },
  {
    id: "stage1-rt-hook-install",
    group: 4,
    label: "Install hook-patched msys2-runtime packages",
    step: async (step) => {
      const stage = initMsys2Stage(step, "stage1");
      await installMsys2HookRuntime(step, stage, "./dist/stage1-rt-hook");
    },
  },
  {
    id: "stage1-core-list-build",
    group: 4,
    label: "Build stage1-core packages (stage1-core-list.txt)",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage1-core", "stage1-extract", options);
    },
  },
  {
    id: "stage1-list-build",
    group: 5,
    groupLabel: "stage1 package list",
    label: "Build stage1 package list (stage1-list.txt)",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage1", "stage1-extract", options);
    },
  },
  {
    id: "stage2-install-prep",
    group: 6,
    groupLabel: "stage2 install prep",
    label: "Install stage1-built packages into msys64-stage2",
    step: installStage2,
    // install-prep leaves a live tree and archive; skip optional stage2-extract.
    nextStep: "stage2-deps-check",
  },
  {
    id: "stage2-extract",
    group: 7,
    groupLabel: "stage2 extract archive and deps check",
    label: "Extract msys64-stage2 from archive",
    step: async (step) => {
      await extractMsys2Stage(step, "stage2");
    },
  },
  {
    id: "stage2-deps-check",
    group: 7,
    label: "Check stage2 /usr cygwin DLL dependencies",
    step: async (step) => {
      await checkStageDepsForStage(step, "stage2");
    },
  },
  {
    id: "stage2-cross-rust",
    group: 8,
    groupLabel: "stage2 cross rust",
    label: "stage2 build rust (cross)",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage2-cross-rust", "stage2-extract", options);
    },
  },
  {
    id: "stage2-list-build",
    group: 9,
    groupLabel: "stage2 package lists (list, conflict, cross clang)",
    label: "Build stage2 package list (stage2-list.txt)",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage2", "stage2-extract", options);
    },
  },
  {
    id: "stage2-conflict",
    group: 9,
    label: "stage2 build conflict packages (stage2-conflict-list.txt)",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage2-conflict", "stage2-extract", options);
    },
  },
  {
    id: "stage2-cross-clang",
    group: 9,
    label: "stage2 build cross clang",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage2-cross-clang", "stage2-extract", options);
    },
  },
  {
    id: "stage3-install-prep",
    group: 10,
    groupLabel:
      "stage3 install prep (next: cygwin deps check; extract is optional)",
    label: "Install stage1/stage2 packages into msys64-stage3 and create archive",
    step: installStage3,
    // install-prep leaves a live tree and archive; skip optional stage3-extract.
    nextStep: "stage3-deps-check",
  },
  {
    id: "stage3-extract",
    group: 11,
    groupLabel:
      "stage3 extract, cygwin deps check, mingw prep, pacman install, " +
      "build, built install, archive (stage3-mingw64-extract is optional)",
    label: "Extract msys64-stage3 from archive",
    step: async (step) => {
      await extractMsys2Stage(step, "stage3");
    },
  },
  {
    id: "stage3-deps-check",
    group: 11,
    label: "Check stage3 /usr cygwin DLL dependencies",
    step: async (step) => {
      await checkStageDepsForStage(step, "stage3");
    },
  },
  {
    id: "stage3-mingw64-prep",
    group: 11,
    label: "Extract msys64-stage3-mingw64 from stage3 archive",
    step: extractMsys2Stage3MingwFromArchive,
  },
  {
    id: "stage3-mingw64-install",
    group: 11,
    label: "Install mingw-w64 pacman packages for msys64-stage3-mingw64",
    step: installMingwPacmanPackagesStage3,
  },
  {
    id: "stage3-mingw64-list-build",
    group: 11,
    label: "Build ports-mingw packages (stage3-mingw64-list.txt)",
    step: async (step, options) => {
      await runBuildPackageList(step, "stage3-mingw64", "stage3-mingw64-install", options);
    },
  },
  {
    id: "stage3-mingw64-list-install",
    group: 11,
    label: "Install built ports-mingw packages into msys64-stage3-mingw64",
    step: installMingwBuiltPackagesStage3,
  },
  {
    id: "stage3-mingw64-archive",
    group: 11,
    label: "Archive msys64-stage3-mingw64",
    nextStep: "stage-all-finished",
    step: archiveMingwStage3,
  },
  {
    id: "stage3-mingw64-extract",
    group: 11,
    label: "Extract msys64-stage3-mingw64 from archive",
    nextStep: "stage-all-finished",
    step: async (step) => {
      await extractMsys2Stage(step, "stage3-mingw64");
    },
  },
  {
    id: "stage-all-finished",
    group: 12,
    groupLabel: "stage-all-finished",
    label: "All pipeline stages finished",
    step: async (step) => {
      step.log("===All pipeline stages finished");
    },
  },
];

export function findPipelineStepIndex(fromId: string) {
  const index = pipelines.findIndex((item) => item.id === fromId);
  if (index >= 0) {
    return index;
  }
  return -1;
}

export function resolveFromStep(fromArg: string): string {
  const maxGroup = pipelineMaxGroup();
  if (/^\d+$/.test(fromArg)) {
    const group = Number(fromArg);
    if (group < 1 || group > maxGroup) {
      throw new Error(`No pipeline step for group ${group}`);
    }
    const step = pipelines.find((item) => item.group === group);
    if (!step) {
      throw new Error(`No pipeline step for group ${group}`);
    }
    return step.id;
  }
  return fromArg;
}

function assertKnownPipelineStep(stepId: string) {
  if (findPipelineStepIndex(stepId) < 0) {
    throw new Error(`Unknown pipeline step: ${stepId}`);
  }
}

export function parseFromArg(fromArg: string) {
  const comma = fromArg.indexOf(",");
  if (comma < 0) {
    const stepId = resolveFromStep(fromArg);
    assertKnownPipelineStep(stepId);
    return { stepId };
  }
  const fromPackage = fromArg.slice(comma + 1);
  if (!fromPackage) {
    throw new Error("--from step,package requires a package name after the comma");
  }
  const stepId = resolveFromStep(fromArg.slice(0, comma));
  assertKnownPipelineStep(stepId);
  return {
    stepId,
    fromPackage,
  };
}

export function resolvePipelineNextIndex(index: number): number {
  const item = pipelines[index];
  if (item.nextStep) {
    const nextIndex = findPipelineStepIndex(item.nextStep);
    if (nextIndex < 0) {
      throw new Error(`Unknown nextStep ${item.nextStep} for ${item.id}`);
    }
    return nextIndex;
  }
  return index + 1;
}
