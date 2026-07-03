import { mock } from "node:test";
import type { RunContext, RunLogger } from "../scripts/run-context.ts";

type MakeRunLoggerOverrides = Partial<RunLogger> & Record<string, unknown>;

export function makeRunLogger(
  overrides: MakeRunLoggerOverrides = {},
): RunContext {
  const base = {
    log: () => {},
    logFile: () => {},
    error: () => {},
    run: mock.fn(async () => ({ stdout: "", stderr: "", code: 0 })),
  } satisfies RunLogger;
  return { ...base, ...overrides } as unknown as RunContext;
}
