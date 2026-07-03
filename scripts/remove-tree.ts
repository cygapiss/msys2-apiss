import * as fs from "fs/promises";
import * as path from "path";

// Remove a symlink/junction entry itself, never the target it points at.
// Windows junctions report isSymbolicLink() via lstat; unlink removes file
// symlinks, rmdir removes directory junctions (EPERM/EISDIR from unlink).
async function removeSymlinkPath(target: string) {
  try {
    await fs.unlink(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EISDIR") {
      await fs.rmdir(target);
      return;
    }
    throw error;
  }
}

// Recursive delete that descends into symlink/junction targets: when an entry
// is a link to a directory, its target contents are deleted, then the link
// entry itself is removed (the empty target inode is left in place). Use only
// when callers explicitly opt in; this can wipe shared junction targets such
// as msys64-caches.
async function removeTreeFollowSymlinks(target: string) {
  let stats;
  try {
    stats = await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
  if (stats.isSymbolicLink()) {
    let resolved;
    try {
      resolved = await fs.stat(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await removeSymlinkPath(target);
        return;
      }
      throw error;
    }
    if (resolved.isDirectory()) {
      const realTarget = await fs.realpath(target);
      const entries = await fs.readdir(realTarget);
      for (const entry of entries) {
        await removeTreeFollowSymlinks(path.join(realTarget, entry));
      }
    }
    await removeSymlinkPath(target);
    return;
  }
  if (stats.isDirectory()) {
    const entries = await fs.readdir(target);
    for (const entry of entries) {
      await removeTreeFollowSymlinks(path.join(target, entry));
    }
    await fs.rmdir(target);
    return;
  }
  await fs.unlink(target);
}

// Delete tree, honoring followSymlinks. false (default in callers): fs.rm never
// descends into symlinks/junctions (it unlinks the link, leaving shared
// junction targets like msys64-caches intact) and tolerates locked files. true:
// descend into link targets and delete their contents.
export function removeTreePath(tree: string, followSymlinks: boolean) {
  return followSymlinks
    ? removeTreeFollowSymlinks(tree)
    : fs.rm(tree, { recursive: true, force: true });
}
