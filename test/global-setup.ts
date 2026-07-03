import {
  initMsys2StageCacheTracking,
  teardownMsys2StageCaches,
} from "./make-msys2-stage.ts";

export async function globalSetup() {
  await initMsys2StageCacheTracking();
}

export async function globalTeardown() {
  await teardownMsys2StageCaches();
}
