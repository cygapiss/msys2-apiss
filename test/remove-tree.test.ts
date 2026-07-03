import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { removeTreePath } from "../scripts/remove-tree.ts";
import { symlinkDirectory } from "../scripts/utils.ts";

async function makeTreeWithSymlink() {
  const scanRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-remove-tree-"));
  const deleteFolder = path.join(scanRoot, "inner-tree");
  const sharedTarget = path.join(scanRoot, "shared-target");
  const sharedFile = path.join(sharedTarget, "keep.txt");
  const linkPath = path.join(deleteFolder, "shared-link");
  await mkdir(deleteFolder, { recursive: true });
  await mkdir(sharedTarget, { recursive: true });
  await writeFile(sharedFile, "keep");
  await symlinkDirectory(sharedTarget, linkPath);
  return { scanRoot, deleteFolder, sharedTarget, sharedFile };
}

test("removeTreePath removes non-symlink trees", async () => {
  const scanRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-remove-tree-"));
  const deleteFolder = path.join(scanRoot, "inner-tree");
  const nestedFile = path.join(deleteFolder, "nested", "remove.txt");
  await mkdir(path.dirname(nestedFile), { recursive: true });
  await writeFile(nestedFile, "remove");

  try {
    await removeTreePath(deleteFolder, false);

    await assert.rejects(() => access(deleteFolder));
  } finally {
    await rm(scanRoot, { recursive: true, force: true });
  }
});

test("removeTreePath with followSymlinks true removes non-symlink trees", async () => {
  const scanRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-remove-tree-"));
  const deleteFolder = path.join(scanRoot, "inner-tree");
  const nestedFile = path.join(deleteFolder, "nested", "remove.txt");
  await mkdir(path.dirname(nestedFile), { recursive: true });
  await writeFile(nestedFile, "remove");

  try {
    await removeTreePath(deleteFolder, true);

    await assert.rejects(() => access(deleteFolder));
  } finally {
    await rm(scanRoot, { recursive: true, force: true });
  }
});

test("removeTreePath(false) removes symlink entry not its target", async () => {
  const scanRoot = await mkdtemp(path.join(tmpdir(), "ci-tools-remove-tree-"));
  const sharedTarget = path.join(scanRoot, "shared-pkg");
  const sharedFile = path.join(sharedTarget, "keep.pkg.tar.zst");
  const linkPath = path.join(scanRoot, "local-pkg-link");
  await mkdir(sharedTarget, { recursive: true });
  await writeFile(sharedFile, "keep");
  await symlinkDirectory(sharedTarget, linkPath);

  try {
    await removeTreePath(linkPath, false);

    await assert.rejects(() => access(linkPath));
    await assert.doesNotReject(() => access(sharedTarget));
    await assert.doesNotReject(() => access(sharedFile));
  } finally {
    await rm(scanRoot, { recursive: true, force: true });
  }
});

test("removeTreePath does not follow symlinks by default", async () => {
  const { scanRoot, deleteFolder, sharedTarget, sharedFile } =
    await makeTreeWithSymlink();

  try {
    await removeTreePath(deleteFolder, false);

    await assert.rejects(() => access(deleteFolder));
    await assert.doesNotReject(() => access(sharedTarget));
    await assert.doesNotReject(() => access(sharedFile));
  } finally {
    await rm(scanRoot, { recursive: true, force: true });
  }
});

test("removeTreePath follows symlinks when followSymlinks is true", async () => {
  const { scanRoot, deleteFolder, sharedTarget, sharedFile } =
    await makeTreeWithSymlink();

  try {
    await removeTreePath(deleteFolder, true);

    await assert.rejects(() => access(deleteFolder));
    await assert.rejects(() => access(sharedFile));
    await assert.doesNotReject(() => access(sharedTarget));
  } finally {
    await rm(scanRoot, { recursive: true, force: true });
  }
});
