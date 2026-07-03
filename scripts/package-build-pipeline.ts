import * as fs from "fs/promises";
import * as path from "path";
import {
  BUILD_PACKAGE_LIST_STAGE_CONFIG,
  type Msys2StageId,
} from "./build-config.ts";
import {
  type RunContext,
} from "./run-context.ts";
import {
  assertMsys2Root,
  generatedTxtPath,
  initMsys2Stage,
  stageRepoPath,
  runMsys2ScriptPath,
  type Msys2Stage,
} from "./utils.ts";
import { rebaseallMsys2 } from "./msys2-rebaseall.ts";

export async function clearInstallPackageList(listPath: string) {
  await fs.mkdir(path.dirname(listPath), { recursive: true });
  await fs.writeFile(listPath, "");
}

export async function readPackageList(listPath: string) {
  const content = await fs.readFile(listPath, "utf-8");
  return content
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export type RunPackageListOptions = {
  fromPackage?: string;
  onlyOne?: boolean;
  noExtract?: boolean;
};

async function runPackageList(
  step: RunContext,
  stage: Msys2Stage,
  listPath: string,
  options: RunPackageListOptions = {},
) {
  const packages = await readPackageList(listPath);
  step.log(`Package list ${listPath}: ${packages.length} item(s)`);
  let reached = !options.fromPackage;
  for (const packageDir of packages) {
    if (options.fromPackage && !reached) {
      if (packageDir === options.fromPackage) {
        reached = true;
      } else {
        continue;
      }
    }
    step.log(`Build and install ${packageDir} when needed`);
    const { code } = await runMsys2ScriptPath(step, stage, {
      script: "scripts/sh/single.sh",
      scriptArgs: [packageDir],
      exitOnFailure: false,
      pty: true,
    });
    if (code !== 0) {
      throw new Error(`single ${packageDir} failed with code ${code}`);
    }
    if (packageDir === "rust") {
      await rebaseallMsys2(step, stage);
    }
    if (options.onlyOne) {
      break;
    }
  }
  if (options.fromPackage && !reached) {
    throw new Error(
      `Package '${options.fromPackage}' not found in ${listPath}`,
    );
  }
}

export async function runBuildPackageList(
  step: RunContext,
  stageId: Msys2StageId,
  prepStepId: string,
  options: RunPackageListOptions = {},
) {
  const config = BUILD_PACKAGE_LIST_STAGE_CONFIG[stageId];
  const stage = initMsys2Stage(step, stageId, {
    ...(options.noExtract ? { MSYS_BUILD_NO_EXTRACT: "enabled" } : {}),
  });

  if (config.setupScriptPath) {
    await runMsys2ScriptPath(step, stage, { script: config.setupScriptPath });
  }

  await assertMsys2Root(step, stage, prepStepId);

  const packageListPath = stageRepoPath(stage, generatedTxtPath(stageId, "list"));
  const installListPath = stageRepoPath(stage, generatedTxtPath(stageId, "install"));
  if (!options.fromPackage) {
    await clearInstallPackageList(installListPath);
  }
  await runPackageList(step, stage, packageListPath, options);

  if (config.finalizeScriptPath) {
    await runMsys2ScriptPath(step, stage, { script: config.finalizeScriptPath });
  }
}
