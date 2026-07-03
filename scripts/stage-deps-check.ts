import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type RunContext, type RunOptions } from "./run-context.ts";
import { initMsys2Stage, stageRepoPath, type Msys2Stage } from "./utils.ts";

const CYG_DLL_NAME = /^cyg.*\.dll$|-cygwin\.dll$/i;
const CYG_DLL_NAME_WHITELIST = [
  "libtcl",
  "libexpect",
  "libfdt",
  "rustc_driver",
  "winpty",
];
const MSYS_DLL_DEP = /msys-[^\s]+\.dll/;
const MSYS_DLL_NAME = /^msys-.*\.dll$/i;
const LDD_EXEC_FORMAT_ERROR = /Exec format error/;

export function isWhitelistedDllName(base: string): boolean {
  const lower = base.toLowerCase();
  return (
    lower.endsWith(".dll") &&
    CYG_DLL_NAME_WHITELIST.some((prefix) =>
      lower.startsWith(prefix.toLowerCase()),
    )
  );
}

export function isUsrBinPath(file: string): boolean {
  return file.startsWith("/usr/bin/");
}

export function isValidDllName(dll: string, base: string): boolean {
  return (
    CYG_DLL_NAME.test(base) ||
    (isUsrBinPath(dll) && isWhitelistedDllName(base))
  );
}

type StageDepsCheckId = "stage2" | "stage3";

async function checkStageDeps(
  step: RunContext,
  stage: Msys2Stage,
  stageId: StageDepsCheckId,
) {
  const logDir = stageRepoPath(stage, "scripts", "logs");
  const reportPath = path.join(logDir, `${stageId}-deps-check-report.txt`);
  const failPath = path.join(logDir, `${stageId}-deps-check-fail.txt`);
  const warnPath = path.join(logDir, `${stageId}-deps-check-warn.txt`);
  const runOpts: RunOptions = {
    cwd: stage.repoRoot,
    env: stage.env,
    capture: true,
    exitOnFailure: false,
  };
  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(reportPath, "");
  await fs.writeFile(failPath, "");
  await fs.writeFile(warnPath, "");

  const failures: string[] = [];

  const recordFailure = async (msg: string) => {
    failures.push(msg);
    step.error(msg);
    await fs.appendFile(failPath, `${msg}\n`);
  };

  const recordIssue = async (file: string, detail: string) => {
    if (isUsrBinPath(file)) {
      await recordFailure(`ERROR: ${detail}`);
      return;
    }
    const msg = `WARNING: ${detail}`;
    step.logFile(msg);
    await fs.appendFile(warnPath, `${msg}\n`);
  };

  step.log(`${stageId} deps check: scanning /usr DLL names`);
  const allDlls = await step.run(
    stage.bash,
    ["--login", "-c", "find /usr/ -type f -name '*.dll' 2>/dev/null"],
    runOpts,
  );
  const dllPaths = allDlls.stdout.trim().split("\n").filter(Boolean);
  const cygDllPaths: string[] = [];
  for (const dll of dllPaths) {
    cygDllPaths.push(dll);
    const base = path.posix.basename(dll);
    if (!isUsrBinPath(dll) && MSYS_DLL_NAME.test(base)) {
      await recordFailure(
        `ERROR: DLL outside /usr/bin must not start with msys-: ${dll}`,
      );
      continue;
    }
    if (!isValidDllName(dll, base)) {
      await recordIssue(
        dll,
        `DLL name must start with cyg or end with -cygwin.dll: ${dll}`,
      );
      continue;
    }
  }

  step.log(`${stageId} deps check: listing PE exe targets`);
  const fileListing = await step.run(
    stage.bash,
    [
      "--login",
      "-c",
      "find /usr/ -type f -name '*.exe' -print0 2>/dev/null | xargs -0 file 2>/dev/null || true",
    ],
    runOpts,
  );
  const peExePaths = fileListing.stdout
    .trim()
    .split("\n")
    .filter((line) => /PE32|MS-DOS executable/.test(line))
    .map((line) => line.replace(/: .*$/, ""))
    .filter(Boolean);
  const lddTargets = [...new Set([...cygDllPaths, ...peExePaths])];

  step.log(
    `${stageId} deps check: running ldd on ${lddTargets.length} files (report: ${reportPath})`,
  );

  for (let i = 0; i < lddTargets.length; i += 1) {
    const file = lddTargets[i];
    if ((i + 1) % 25 === 0 || i === 0 || i + 1 === lddTargets.length) {
      step.log(
        `${stageId} deps check: ldd ${i + 1}/${lddTargets.length} ${file}`,
      );
    }
    const lddResult = await step.run(stage.ldd, [file], {
      env: stage.env,
      capture: true,
      exitOnFailure: false,
    });
    const lddOut = [lddResult.stdout, lddResult.stderr]
      .filter(Boolean)
      .join("\n");
    await fs.appendFile(reportPath, `${file}\n${lddOut}\n\n`);
    if (LDD_EXEC_FORMAT_ERROR.test(lddOut)) {
      await recordIssue(file, `ldd exec format error: ${file}`);
      continue;
    }
    for (const line of lddOut.split("\n")) {
      if (MSYS_DLL_DEP.test(line)) {
        await recordIssue(
          file,
          `msys DLL dependency in ${file}: ${line.trim()}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `${stageId} deps check failed (${failures.length} issue(s)); see ${failPath}`,
    );
  }
  step.log(`${stageId} deps check passed; report: ${reportPath}`);
}

export async function checkStageDepsForStage(
  step: RunContext,
  stage: StageDepsCheckId,
) {
  await checkStageDeps(step, initMsys2Stage(step, stage), stage);
}
