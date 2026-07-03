import * as fs from "fs/promises";
import * as path from "path";
import {
  DELETE_MSYS64_BAT_FILENAME,
  EXTRACT_BAT_FILENAME,
  MSYS64_DIR_NAME,
} from "./build-config.ts";
import { removeTreeWithKillRetry } from "./kill-tree-processes.ts";
import type { RunLogger } from "./run-context.ts";
import { fsExistsAsync, hostTarPath, stageRepoPath, type Msys2Stage } from "./utils.ts";

const EXTRACT_BAT_TEMPLATE_REL = "scripts/sh/extract.in.bat";
const DELETE_MSYS64_BAT_TEMPLATE_REL = "scripts/sh/delete-msys64.in.bat";
const EXTRACT_BAT_ARCHIVE_PLACEHOLDER = "@__MSYS2_STAGE_EXTRACT_ARCHIVE__@";

export function parseExtractBatArchiveName(extract_bat: string) {
  for (const set_match of extract_bat.matchAll(
    /^\s*set "MSYS2_STAGE_EXTRACT_ARCHIVE=(\S+)"/gm,
  )) {
    if (!set_match[1].includes("%")) {
      return set_match[1];
    }
  }
  return null;
}

export async function writeExtractBat(
  step: RunLogger,
  stage: Msys2Stage,
  msys2_base_filename: string,
) {
  const extract_bat_path = path.join(stage.stageRoot, EXTRACT_BAT_FILENAME);
  const template = await fs.readFile(
    stageRepoPath(stage, EXTRACT_BAT_TEMPLATE_REL),
    "utf-8",
  );
  const content = template.replace(
    EXTRACT_BAT_ARCHIVE_PLACEHOLDER,
    msys2_base_filename,
  );
  await fs.writeFile(extract_bat_path, content, "utf-8");
  step.logFile(`===Wrote ${extract_bat_path}`);
}

export async function writeDeleteMsys2Bat(
  step: RunLogger,
  stage: Msys2Stage,
) {
  const delete_bat_path = path.join(
    stage.stageRoot,
    DELETE_MSYS64_BAT_FILENAME,
  );
  const content = await fs.readFile(
    stageRepoPath(stage, DELETE_MSYS64_BAT_TEMPLATE_REL),
    "utf-8",
  );
  await fs.writeFile(delete_bat_path, content, "utf-8");
  step.logFile(`===Wrote ${delete_bat_path}`);
}

export async function writeStageExtractBats(
  step: RunLogger,
  stage: Msys2Stage,
  msys2_base_filename: string,
) {
  await writeExtractBat(
    step,
    stage,
    msys2_base_filename,
  );
  await writeDeleteMsys2Bat(step, stage);
}

// Bootstrap targetStage by unpacking the archive named in sourceStage/extract.bat.
export async function extractMsys2FromStageArchive(
  step: RunLogger,
  sourceStage: Msys2Stage,
  targetStage: Msys2Stage,
  logLabel: string,
) {
  const extract_bat_path = path.join(sourceStage.stageRoot, EXTRACT_BAT_FILENAME);
  const extract_bat = await fs.readFile(extract_bat_path, "utf-8");
  const archive_name = parseExtractBatArchiveName(extract_bat);
  if (!archive_name) {
    throw new Error(`${logLabel}: No MSYS2_STAGE_EXTRACT_ARCHIVE in ${extract_bat_path}`);
  }
  const archive_path = path.join(sourceStage.stageRoot, archive_name);
  if (!(await fsExistsAsync(archive_path))) {
    throw new Error(`${logLabel}: Archive not found: ${archive_path}`);
  }

  const msys2Root = path.join(targetStage.stageRoot, MSYS64_DIR_NAME);
  await fs.mkdir(targetStage.stageRoot, { recursive: true });
  step.log(
    `===${logLabel}: ${hostTarPath()} -xf ${archive_path} (cwd ${targetStage.stageRoot})`,
  );
  await removeTreeWithKillRetry(step, msys2Root, [targetStage.stageRoot]);
  await step.run(hostTarPath(), ["-xf", archive_path], {
    cwd: targetStage.stageRoot,
  });
  step.log(`===${logLabel}: tar -xf ${archive_name} done`);
  if (!(await fsExistsAsync(msys2Root))) {
    throw new Error(
      `${logLabel}: tar -xf did not create ${msys2Root} from ${archive_path}`,
    );
  }
}
