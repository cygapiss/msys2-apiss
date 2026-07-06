import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import type { RunContext, RunLogger, RunOptions, RunResult } from "./run-context.ts";
import {
  BUILD_PACKAGE_LIST_STAGE_CONFIG,
  GENERATED_DIR,
  MSYS2_BASE_INSTALLED_TARBALL,
  MSYS2_BASE_TARBALL,
  MSYS64_CACHES_DIR_NAME,
  MSYS64_DIR_NAME,
  MSYS_BASH_ENV,
  PACMAN_PKG_CACHE_SUBDIR,
  DEFAULT_CI_TOOLS_ROOT,
  type Msys2StageId,
} from "./build-config.ts";
import { removeTreePath } from "./remove-tree.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(scriptDir, "..");

export function hostTarPath() {
  const system_root = process.env.SystemRoot || "C:\\Windows";
  return path.join(system_root, "System32", "tar.exe");
}

export function hostCurlPath() {
  const system_root = process.env.SystemRoot || "C:\\Windows";
  return path.join(system_root, "System32", "curl.exe");
}

/** Resolve repo-relative path segments under repoRoot. Each part may use `/`. */
export function repoPath(...parts: string[]) {
  const segments = parts.flatMap((part) => part.split("/"));
  return path.join(repoRoot, ...segments);
}

/** Resolve repo-relative path segments under stage.repoRoot. Each part may use `/`. */
export function stageRepoPath(
  stage: Pick<Msys2Stage, "repoRoot">,
  ...parts: string[]
) {
  const segments = parts.flatMap((part) => part.split("/"));
  return path.join(stage.repoRoot, ...segments);
}

/** Repo-relative scripts/generated/{stage}-{target}.txt path. */
export function generatedTxtPath(
  stage: Msys2StageId,
  target: "list" | "install",
) {
  return `${GENERATED_DIR}/${stage}-${target}.txt`;
}

export async function fsExistsAsync(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {}
  return false;
}

/** Directory symbolic link. Always type "dir"; never junction. */
export function symlinkDirectory(target: string, linkPath: string) {
  return fs.symlink(target, linkPath, "dir");
}

/** Remove linkPath without following symlinks (shared target stays intact). */
export function unlinkDirectory(linkPath: string) {
  return removeTreePath(linkPath, false);
}

function ciToolsBase() {
  return process.env.CI_TOOLS_ROOT || DEFAULT_CI_TOOLS_ROOT;
}

export type Msys2Stage = {
  /** Repository root (parent of scripts/). */
  repoRoot: string;
  /** ciToolsBase(). */
  ciToolsBase: string;
  /** ${this.ciToolsBase}/msys64-${stage} */
  stageRoot: string;
  msys2Root: string;
  home: string;
  pacmanPkg: string;
  sharedHome: string;
  sharedPacmanPkg: string;
  cacheRoot: string;
  /** Shared msys64-caches bootstrap snapshot; never delete from clearMsys2. */
  baseTarball: string;
  /** Post-bootstrap installed tree cache; restore skips rewrite when present. */
  baseInstalledTarball: string;
  /** msys repo package list inside the stage msys64 tree. */
  baseInstalledMsysTxt: string;
  bash: string;
  dash: string;
  cygpath: string;
  pactree: string;
  pacman: string;
  ldd: string;
  tar: string;
  env: NodeJS.ProcessEnv;
};

export function initMsys2Stage(
  step: RunContext,
  stageId: Msys2StageId,
  optionsEnv: NodeJS.ProcessEnv = {},
): Msys2Stage {
  const { stageTreeId, bootstrapEnv } =
    BUILD_PACKAGE_LIST_STAGE_CONFIG[stageId];
  const ciToolsBaseDir = ciToolsBase();
  const stageRoot = `${ciToolsBaseDir}/msys64-${stageTreeId}`;
  const msys2Root = path.join(stageRoot, "msys64");
  const cacheRoot = path.join(ciToolsBaseDir, MSYS64_CACHES_DIR_NAME);
  const cache_msys64_root = path.join(cacheRoot, MSYS64_DIR_NAME);
  const stagePaths: Msys2Stage = {
    repoRoot,
    ciToolsBase: ciToolsBaseDir,
    stageRoot,
    msys2Root,
    home: path.join(msys2Root, "home"),
    pacmanPkg: path.join(msys2Root, ...PACMAN_PKG_CACHE_SUBDIR.split("/")),
    sharedHome: path.join(cache_msys64_root, "home"),
    sharedPacmanPkg: path.join(cache_msys64_root, ...PACMAN_PKG_CACHE_SUBDIR.split('/')),
    cacheRoot: cacheRoot,
    baseTarball: path.join(cacheRoot, MSYS2_BASE_TARBALL),
    baseInstalledTarball: path.join(cacheRoot, MSYS2_BASE_INSTALLED_TARBALL),
    baseInstalledMsysTxt: path.join(msys2Root, "msys.txt"),
    bash: path.join(msys2Root, "usr", "bin", "bash.exe"),
    dash: path.join(msys2Root, "usr", "bin", "dash.exe"),
    cygpath: path.join(msys2Root, "usr", "bin", "cygpath.exe"),
    pactree: path.join(msys2Root, "usr", "bin", "pactree.exe"),
    pacman: path.join(msys2Root, "usr", "bin", "pacman.exe"),
    ldd: path.join(msys2Root, "usr", "bin", "ldd.exe"),
    tar: path.join(msys2Root, "usr", "bin", "tar.exe"),
    env: {
      ...process.env,
      ...MSYS_BASH_ENV,
      ...bootstrapEnv,
      ...optionsEnv,
    },
  };
  step.logFile(`The ${stageId} bash is: ${stagePaths.bash}`);
  return stagePaths;
}

export type CygpathFormat = "unix" | "windows";

/** Run cygpath -u/-w via bash --login; returns last stdout line. */
export async function cygpath(
  step: RunLogger,
  stage: Pick<Msys2Stage, "bash" | "env" | "repoRoot">,
  inputPath: string,
  format: CygpathFormat = "unix",
) {
  const flag = format === "unix" ? "-u" : "-w";
  const { stdout, code } = await step.run(
    stage.bash,
    ["--login", "-c", `cygpath ${flag} ${JSON.stringify(inputPath)}`],
    {
      cwd: stage.repoRoot,
      env: stage.env,
      capture: true,
      exitOnFailure: false,
    },
  );
  if (code !== 0) {
    throw new Error(`cygpath ${flag} failed (${code}) for ${inputPath}`);
  }
  const result = stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .at(-1) ?? "";
  if (format === "windows") {
    return path.win32.normalize(result);
  }
  return result;
}

export async function assertMsys2Root(
  step: RunLogger,
  stage: Msys2Stage,
  prepStepId: string,
) {
  if (
    !(await fsExistsAsync(stage.msys2Root)) ||
    !(await fsExistsAsync(stage.bash))
  ) {
    throw new Error(
      `msys64 not found at ${stage.msys2Root}; run ${prepStepId} first`,
    );
  }
  let cygpath_msys_root: string;
  try {
    cygpath_msys_root = await cygpath(step, stage, "/", "windows");
  } catch (err) {
    const codeMatch =
      err instanceof Error ? err.message.match(/\((\d+)\)/) : null;
    const codeSuffix = codeMatch ? ` (code ${codeMatch[1]})` : "";
    throw new Error(
      `msys64 cygpath check failed at ${stage.bash}${codeSuffix}; run ${prepStepId} first`,
    );
  }
  const expected_msys_root = path.win32.normalize(stage.msys2Root);
  if (path.resolve(cygpath_msys_root) !== path.resolve(expected_msys_root)) {
    throw new Error(
      `msys64 cygpath -w / returned ${cygpath_msys_root}, expected ${expected_msys_root}; run ${prepStepId} first`,
    );
  }
}

export type RunMsys2ScriptPathOptions = RunOptions & {
  script: string;
  /**
   * Passed as positional args to the script inside the `bash --login -c`
   * command. Each value is shell-quoted with JSON.stringify so metacharacters
   * are treated as data. Must not contain `$` (double-quoted words still
   * expand variables). Pass dynamic values through stage.env (or env below)
   * and expand them inside the script instead.
   */
  scriptArgs?: string[];
  /**
   * Bash snippet prepended to the script invocation inside the same
   * `bash --login -c` process. Use it to export env vars or source helpers
   * the script depends on, without spawning an extra shell.
   */
  prelude?: string;
};

export async function runMsys2ScriptPath(
  step: RunLogger,
  stage: Msys2Stage,
  options: RunMsys2ScriptPathOptions,
): Promise<RunResult> {
  const {
    script,
    scriptArgs = [],
    prelude,
    env,
    cwd = stage.repoRoot,
    ...runOptions
  } = options;
  // scriptArgs are embedded in the bash -c string; quote each arg and reject `$`
  // so bash does not expand variables inside the quoted words.
  for (const arg of scriptArgs) {
    if (arg.includes("$")) {
      throw new Error(
        `runMsys2ScriptPath: scriptArgs must not contain '$'; ` +
          `pass dynamic values via env instead: ${arg}`,
      );
    }
  }
  const args = scriptArgs.map((arg) => JSON.stringify(arg)).join(" ");
  let command = args ? `sh ${script} ${args}` : `sh ${script}`;
  if (prelude) {
    command = `${prelude}\n${command}`;
  }
  return step.run(
    stage.bash,
    ["--login", "-c", command],
    {
      cwd,
      env: env ?? stage.env,
      ...runOptions,
    },
  );
}
