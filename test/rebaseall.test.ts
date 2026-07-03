import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { rebaseallMsys2 } from "../scripts/msys2-rebaseall.ts";
import type { RunOptions } from "../scripts/run-context.ts";
import { makeMsys2Stage } from "./make-msys2-stage.ts";
import { makeRunLogger } from "./make-run-logger.ts";

test("rebaseallMsys2 runs rm, rebaseall, rm with cleared MSYSTEM", async () => {
  const runs: {
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
  }[] = [];
  const step = makeRunLogger({
    run: mock.fn(async (command: string, args: string[], options?: RunOptions) => {
      runs.push({ command, args, env: options?.env });
      return { stdout: "", stderr: "", code: 0 };
    }),
  });
  const stage = makeMsys2Stage("stage2");

  await rebaseallMsys2(step, stage);

  assert.deepEqual(
    runs.map((run) => ({
      command: run.command,
      args: run.args,
      msystem: run.env?.MSYSTEM,
      msys: run.env?.MSYS,
      chere_invoking: run.env?.CHERE_INVOKING,
    })),
    [
      {
        command: stage.bash,
        args: ["--login", "-c", "rm -rf /etc/rebase.db.x86_64"],
        msystem: "CYGWIN",
        msys: "winsymlinks:native",
        chere_invoking: "1",
      },
      {
        command: stage.dash,
        args: ["/usr/bin/rebaseall", "-p", "-b", "0x400000000"],
        msystem: "",
        msys: "",
        chere_invoking: "",
      },
      {
        command: stage.bash,
        args: ["--login", "-c", "rm -rf /etc/rebase.db.x86_64"],
        msystem: "CYGWIN",
        msys: "winsymlinks:native",
        chere_invoking: "1",
      },
    ],
  );
});
