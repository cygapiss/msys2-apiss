import * as fs from "fs/promises";
import * as path from "path";
import { pathToFileURL } from "url";

export type ParsedArgs =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "ok"; folderPath: string };

export async function findNewestDirectFileMtime(
  folderPath: string,
): Promise<number | undefined> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  let newestMtimeMs: number | undefined;

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const stat = await fs.stat(path.join(folderPath, entry.name));
    if (newestMtimeMs === undefined || stat.mtimeMs > newestMtimeMs) {
      newestMtimeMs = stat.mtimeMs;
    }
  }

  return newestMtimeMs;
}

export async function updateFolderTimeFromNewestFile(
  folderPath: string,
): Promise<void> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await updateFolderTimeFromNewestFile(path.join(folderPath, entry.name));
    }
  }

  const newestMtimeMs = await findNewestDirectFileMtime(folderPath);
  if (newestMtimeMs === undefined) {
    return;
  }

  const dirStat = await fs.stat(folderPath);
  await fs.utimes(folderPath, dirStat.atime, new Date(newestMtimeMs));
}

function printHelp() {
  console.log(`Usage: node scripts/update-folder-times.ts <folder>

Set each folder LastWriteTime from its newest direct file.

Walks FolderPath recursively. For every directory that contains at least one
direct file, sets that directory mtime to the newest direct file mtime in that
directory only. Subfolder times are not used when updating a parent folder.
Directories with no direct files are left unchanged.

Arguments:
  <folder>             Root directory to process (must exist)

Options:
  -h, --help           Show this help and exit
`);
}

export function parseArgv(argv: string[]): ParsedArgs {
  let folderPath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" };
    }
    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown argument: ${arg}` };
    }
    if (folderPath !== undefined) {
      return { kind: "error", message: `Unexpected extra argument: ${arg}` };
    }
    folderPath = arg;
  }

  if (folderPath === undefined) {
    return { kind: "error", message: "Missing required argument: <folder>" };
  }

  return { kind: "ok", folderPath };
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
  return parsed.folderPath;
}

async function main() {
  const folderPath = parseArgs(process.argv.slice(2));
  const resolved = path.resolve(folderPath);

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`not a directory: ${resolved}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("not a directory:")) {
      throw error;
    }
    throw new Error(`folder not found: ${resolved}`);
  }

  await updateFolderTimeFromNewestFile(resolved);
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
