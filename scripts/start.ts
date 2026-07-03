import * as path from "path";
import { pathToFileURL } from "url";
import {
  DEFAULT_CI_TOOLS_ROOT,
} from "./build-config.ts";
import {
  findPipelineStepIndex,
  formatPipelineGroupsHelp,
  formatPipelineStepsHelp,
  handlePipelineSigint,
  type HandlePipelineSigintDeps,
  parseFromArg,
  pipelineMaxGroup,
  pipelines,
  resolvePipelineNextIndex,
  runPipelineStep,
} from "./pipeline.ts";
import { initMsys2Stage } from "./utils.ts";
import { RunContext } from "./run-context.ts";

export function handleStartSigint(deps: HandlePipelineSigintDeps = {}) {
  console.log("Caught interrupt signal");
  handlePipelineSigint(deps);
}

function printHelp() {
  const maxGroup = pipelineMaxGroup();
  console.log(`Usage: start.bat [--from <step>[,<package>]] [--only] [--no-extract] [--help]

Run the MSYS2/Cygwin bootstrap pipeline from the beginning or from a step.

Options:
  -h, --help           Show this help and exit
  --from <step>        Start at <step> and run through the end
  --from <step>,<pkg>  Resume a package-list step at port dir <pkg>
  --only               With --from, run only that step and exit
  --no-extract         Set MSYS_BUILD_NO_EXTRACT on Msys2Stage (makepkg --noextract)

Environment:
  CI_TOOLS_ROOT        CI tools root (default: ${DEFAULT_CI_TOOLS_ROOT})

Pipeline groups ( --from <n> starts at the first step in group n ):
${formatPipelineGroupsHelp()}

Steps (--from accepts the id or group number 1-${maxGroup}):
${formatPipelineStepsHelp()}
`);
}

function parseArgs(argv: string[]) {
  let fromStep: string | null = null;
  let fromPackage: string | undefined;
  let onlyStep = false;
  let noExtract = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--only") {
      onlyStep = true;
      continue;
    }
    if (arg === "--no-extract") {
      noExtract = true;
      continue;
    }
    if (arg === "--from") {
      const value = argv[i + 1];
      if (!value) {
        console.error("Missing value for --from");
        console.error("Run start.bat --help for usage.");
        process.exit(1);
      }
      try {
        const parsed = parseFromArg(value);
        fromStep = parsed.stepId;
        fromPackage = parsed.fromPackage;
      } catch (error) {
        console.error(String(error));
        process.exit(1);
      }
      i += 1;
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    console.error("Run start.bat --help for usage.");
    process.exit(1);
  }

  return { fromStep, fromPackage, onlyStep, noExtract };
}

async function main() {
  const { fromStep, fromPackage, onlyStep, noExtract } = parseArgs(
    process.argv.slice(2),
  );
  const ciToolsBase = initMsys2Stage(new RunContext(null), 'stage1').ciToolsBase;
  console.log(`CI_TOOLS_ROOT is: ${ciToolsBase}`);

  let startIndex = 0;
  if (fromStep) {
    startIndex = findPipelineStepIndex(fromStep);
    if (startIndex < 0) {
      console.error(`Unknown pipeline step: ${fromStep}`);
      console.error("Run start.bat --help for the step list.");
      process.exit(1);
    }
    console.log(
      `Starting pipeline at step ${startIndex + 1}/${pipelines.length}: ${pipelines[startIndex].label} (${pipelines[startIndex].id})`,
    );
  }

  if (onlyStep && !fromStep) {
    console.error("--only requires --from");
    console.error("Run start.bat --help for usage.");
    process.exit(1);
  }

  for (let i = startIndex; i < pipelines.length; ) {
    const item = pipelines[i];
    const options = {
      fromPackage: item.id === fromStep ? fromPackage : undefined,
      onlyOne: onlyStep && !!fromPackage && item.id === fromStep,
      noExtract,
    };
    console.log("");
    console.log(`=== ${i + 1}/${pipelines.length}: ${item.label} (${item.id}) ===`);
    await runPipelineStep(item, options);
    const nextIndex = resolvePipelineNextIndex(i);
    if (nextIndex < 0 || nextIndex >= pipelines.length) {
      break;
    }
    if (onlyStep) {
      console.log(`Next step: start.bat --from ${pipelines[nextIndex].id}`);
      break;
    }
    i = nextIndex;
  }
}

function isMainModule() {
  const entryPoint = process.argv[1];
  return (
    entryPoint !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(entryPoint)).href
  );
}

if (isMainModule()) {
  process.on("SIGINT", () => {
    handleStartSigint();
  });
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
