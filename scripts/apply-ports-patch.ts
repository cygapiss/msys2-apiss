import { spawn } from "child_process";
import { existsSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const DEFAULT_PATCHES_DIR = "patches";

const PORTS_DIRS = ["ports", "ports-mingw"] as const;
type PortsDir = (typeof PORTS_DIRS)[number];

type GitRunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

function windowsGitCandidates() {
  const candidates: string[] = [];
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  if (programFiles) {
    candidates.push(path.join(programFiles, "Git", "cmd", "git.exe"));
  }
  if (programFilesX86) {
    candidates.push(path.join(programFilesX86, "Git", "cmd", "git.exe"));
  }
  candidates.push("C:\\Program Files\\Git\\cmd\\git.exe");
  candidates.push("C:\\Program Files (x86)\\Git\\cmd\\git.exe");
  return [...new Set(candidates)];
}

class WindowsGit {
  readonly gitPath: string;

  constructor() {
    const candidates = windowsGitCandidates();
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
      throw new Error(
        `Windows git not found (checked: ${candidates.join(", ")})`,
      );
    }
    this.gitPath = found;
  }

  run(args: string[], cwd: string): Promise<GitRunResult> {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      const child = spawn(this.gitPath, args, { cwd, windowsHide: false });

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        resolve({ code: 1, stdout, stderr: `${stderr}${error}\n` });
      });
      child.on("close", (code) => {
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  }
}

export async function readFormatPatchCommitMessage(patchPath: string) {
  const content = await fs.readFile(patchPath, "utf-8");
  const sep = content.indexOf("\n---\n");
  if (sep < 0) {
    throw new Error(`patch has no mbox separator: ${patchPath}`);
  }
  const header = content.slice(0, sep);
  const lines = header.split(/\r?\n/);
  const subjectLine = lines.find((line) => line.startsWith("Subject: "));
  if (!subjectLine) {
    throw new Error(`patch has no Subject line: ${patchPath}`);
  }
  const subjectIdx = lines.indexOf(subjectLine);
  const subject = subjectLine.slice("Subject: ".length);
  const bodyLines = lines.slice(subjectIdx + 1);
  while (bodyLines.length > 0 && bodyLines[0] === "") {
    bodyLines.shift();
  }
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
    bodyLines.pop();
  }
  return [subject, ...bodyLines].join("\n");
}

function logGitOutput(stdout: string, stderr: string) {
  if (stdout.trim()) {
    console.log(stdout.trimEnd());
  }
  if (stderr.trim()) {
    console.error(stderr.trimEnd());
  }
}

async function runGitOrThrow(
  git: WindowsGit,
  args: string[],
  cwd: string,
  action: string,
) {
  const { code, stdout, stderr } = await git.run(args, cwd);
  logGitOutput(stdout, stderr);
  if (code !== 0) {
    const detail = stderr.trim() || stdout.trim();
    throw new Error(
      `${action} failed (${code})${detail ? `: ${detail}` : ""}`,
    );
  }
}

export function porcelainPath(line: string) {
  let filePart = line.slice(3);
  if (filePart.includes(" -> ")) {
    filePart = filePart.split(" -> ").pop() ?? filePart;
  }
  if (filePart.startsWith('"') && filePart.endsWith('"')) {
    filePart = filePart.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return filePart.replace(/\\/g, "/");
}

export async function readFormatPatchPaths(patchPath: string, portsDir: PortsDir) {
  const content = await fs.readFile(patchPath, "utf-8");
  const paths = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith("diff --git ")) {
      continue;
    }
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (!match) {
      continue;
    }
    paths.add(`${portsDir}/${match[1]}`.replace(/\\/g, "/"));
    paths.add(`${portsDir}/${match[2]}`.replace(/\\/g, "/"));
  }
  return paths;
}

async function assertCleanWorkingTree(
  git: WindowsGit,
  root: string,
  ignorePaths: string[] = [],
  patchPaths: Set<string> = new Set(),
) {
  const ignore = new Set(
    ignorePaths.map((entry) => entry.replace(/\\/g, "/")),
  );

  const { code, stdout, stderr } = await git.run(
    ["status", "--porcelain"],
    root,
  );
  if (code !== 0) {
    throw new Error(
      `git status failed (${code})${stderr ? `: ${stderr.trim()}` : ""}`,
    );
  }

  const dirtyLines = stdout
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .filter((line) => {
      const filePath = porcelainPath(line);
      if (ignore.has(filePath)) {
        return false;
      }
      return line.slice(0, 2) !== "??" || patchPaths.has(filePath);
    });

  if (dirtyLines.length > 0) {
    throw new Error(
      `working directory is not clean; commit or stash changes first:\n${dirtyLines.join("\n")}`,
    );
  }
}

export async function assertNoIndexLock(root: string) {
  const lockPath = path.join(root, ".git", "index.lock");
  try {
    await fs.access(lockPath);
    throw new Error(
      `git index lock exists (${lockPath}); another git process may be running, ` +
        `or a previous git command crashed. Close other git tools, wait for them ` +
        `to finish, or remove the lock file manually if no git process is running`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("git index lock exists")) {
      throw error;
    }
  }
}

async function assertNoAmInProgress(root: string) {
  try {
    await fs.access(path.join(root, ".git", "rebase-apply"));
    throw new Error("git am in progress; run git am --abort first");
  } catch (error) {
    if (error instanceof Error && error.message.includes("git am in progress")) {
      throw error;
    }
  }
}

export async function assertGitRepositoryReady(root: string) {
  await assertNoAmInProgress(root);
  await assertNoIndexLock(root);
}

export function gitApplyCheckArgs(
  portsDir: PortsDir,
  patchPath: string,
): string[] {
  return [
    "apply",
    "--check",
    "--whitespace=nowarn",
    `--directory=${portsDir}`,
    "--verbose",
    patchPath,
  ];
}

export function gitAmArgs(portsDir: PortsDir, patchPath: string): string[] {
  return ["am", "--whitespace=nowarn", `--directory=${portsDir}`, patchPath];
}

function printHelp() {
  console.log(`Usage: node scripts/apply-ports-patch.ts [options] [<patch>]

Apply git-format patch(es) under ports/ or ports-mingw/ using Windows git,
then commit with the message from each patch (git am). Requires a clean
tracked working directory; untracked files are allowed unless a patch touches
the same path.

Arguments:
  <patch>              Patch file or directory under repo root (default: ${DEFAULT_PATCHES_DIR})
                       Directories apply all *.patch files in sorted order

Options:
  -h, --help           Show this help and exit
  --dry-run            Check patch(es) apply; show commit message(s)
  --patch <path>       Same as positional <patch>
  --ports-dir <dir>    Target tree: ports or ports-mingw (default: ports)
`);
}

function isPortsDir(value: string): value is PortsDir {
  return (PORTS_DIRS as readonly string[]).includes(value);
}

export type ParsedArgs =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      dryRun: boolean;
      patch: string | undefined;
      portsDir: PortsDir;
    };

export function parseArgv(argv: string[]): ParsedArgs {
  let dryRun = false;
  let patch: string | undefined;
  let positionalPatch: string | undefined;
  let portsDir: PortsDir = "ports";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" };
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--patch") {
      const value = argv[i + 1];
      if (!value) {
        return { kind: "error", message: "Missing value for --patch" };
      }
      patch = value;
      i += 1;
      continue;
    }
    if (arg === "--ports-dir") {
      const value = argv[i + 1];
      if (!value || !isPortsDir(value)) {
        return {
          kind: "error",
          message: `Invalid --ports-dir value: ${value ?? "(missing)"} (expected: ${PORTS_DIRS.join(" or ")})`,
        };
      }
      portsDir = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown argument: ${arg}` };
    }
    if (positionalPatch !== undefined) {
      return { kind: "error", message: `Unexpected extra argument: ${arg}` };
    }
    positionalPatch = arg;
  }

  if (patch !== undefined && positionalPatch !== undefined) {
    return {
      kind: "error",
      message: "Specify the patch once: use <patch> or --patch, not both",
    };
  }

  return {
    kind: "ok",
    dryRun,
    patch: patch ?? positionalPatch,
    portsDir,
  };
}

function parseArgs(argv: string[]) {
  const parsed = parseArgv(argv);
  if (parsed.kind === "help") {
    printHelp();
    process.exit(0);
  }
  if (parsed.kind === "error") {
    console.error(parsed.message);
    console.error("Run with --help for usage.");
    process.exit(1);
  }
  return {
    dryRun: parsed.dryRun,
    patch: parsed.patch,
    portsDir: parsed.portsDir,
  };
}

export type PatchEntry = {
  relPath: string;
  absPath: string;
};

export async function resolvePatchEntriesFrom(
  root: string,
  patchInput: string,
): Promise<PatchEntry[]> {
  const absPath = path.join(root, patchInput);
  let stat;
  try {
    stat = await fs.stat(absPath);
  } catch {
    throw new Error(`patch not found: ${absPath}`);
  }

  if (stat.isFile()) {
    return [{ relPath: patchInput.replace(/\\/g, "/"), absPath }];
  }

  if (stat.isDirectory()) {
    const names = (await fs.readdir(absPath))
      .filter((name) => name.endsWith(".patch"))
      .sort();
    if (names.length === 0) {
      throw new Error(`no .patch files found in: ${absPath}`);
    }
    return names.map((name) => ({
      relPath: path.join(patchInput, name).replace(/\\/g, "/"),
      absPath: path.join(absPath, name),
    }));
  }

  throw new Error(`patch path is not a file or directory: ${absPath}`);
}

async function resolvePatchEntries(patchInput: string): Promise<PatchEntry[]> {
  return resolvePatchEntriesFrom(REPO_ROOT, patchInput);
}

async function applyPatchEntry(
  git: WindowsGit,
  entry: PatchEntry,
  portsDir: PortsDir,
  root: string,
  dryRun: boolean,
) {
  await assertNoIndexLock(root);

  const args = dryRun
    ? gitApplyCheckArgs(portsDir, entry.absPath)
    : gitAmArgs(portsDir, entry.absPath);
  const action = dryRun ? "git apply --check" : "git am";

  console.log(
    `${dryRun ? "Dry-run" : "Apply and commit"} ${entry.relPath} under ${portsDir}/ with ${git.gitPath}`,
  );

  if (dryRun) {
    const commitMessage = await readFormatPatchCommitMessage(entry.absPath);
    console.log("Commit message from patch:");
    console.log(commitMessage);
    console.log("");
  }

  await runGitOrThrow(git, args, root, action);

  if (dryRun) {
    console.log(
      `Dry run OK: would apply and commit ${entry.relPath} under ${portsDir}/`,
    );
  } else {
    console.log(`Applied and committed ${entry.relPath} under ${portsDir}/`);
  }
}

async function main() {
  const { dryRun, patch, portsDir } = parseArgs(process.argv.slice(2));
  const patchInput = patch ?? DEFAULT_PATCHES_DIR;
  const git = new WindowsGit();

  const patchEntries = await resolvePatchEntries(patchInput);
  const portsDirPath = path.join(REPO_ROOT, portsDir);
  const root = REPO_ROOT;

  try {
    await fs.access(portsDirPath);
  } catch {
    throw new Error(`${portsDir}/ not found: ${portsDirPath}`);
  }

  await assertGitRepositoryReady(root);

  const patchPaths = new Set<string>();
  for (const entry of patchEntries) {
    for (const touchedPath of await readFormatPatchPaths(entry.absPath, portsDir)) {
      patchPaths.add(touchedPath);
    }
  }
  await assertCleanWorkingTree(
    git,
    root,
    patchEntries.map((entry) => entry.relPath),
    patchPaths,
  );

  for (const entry of patchEntries) {
    await applyPatchEntry(git, entry, portsDir, root, dryRun);
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
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
