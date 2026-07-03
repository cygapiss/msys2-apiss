import { type RunContext, type RunOptions } from "./run-context.ts";
import { type Msys2Stage } from "./utils.ts";

// Intentionally minimal: keep direct bash/dash spawns here (not runMsys2ScriptPath).
// rebaseall needs dash with cleared MSYSTEM and login bash for rm; a .sh wrapper
// would not simplify this and would hide the env contract documented below.

export async function rebaseallMsys2(step: RunContext, stage: Msys2Stage) {
  step.log("Run rebaseall -p (rebase DLLs in msys64)");
  // Must match the old :rebaseall_msys64_stage2_p intent, but the old batch
  // always "exit /B 0" and never checked rebaseall errorlevel, so failures were
  // silent on rebase 4.5+ (Invalid Baseaddress 0x70000000).
  //
  // Clear MSYS/MSYSTEM/CHERE_INVOKING so rebaseall uses the mingw file-list path
  // (find /usr/bin and /usr/lib). Keeping MSYSTEM=CYGWIN uses the cygwin path
  // (/etc/setup/*.lst.gz), which this bootstrap tree lacks; only addon DLLs get
  // listed and database-mode rebase can fail with "Too many DLLs for available
  // address space" when /etc/rebase.db.x86_64 is stale.
  //
  // Cleared MSYSTEM makes uname report MINGW64_NT, so rebaseall keeps legacy
  // DefaultBaseAddress=0x70000000. On x86_64 that is rejected (must be >
  // 0x200000000). Pass -b 0x400000000 explicitly: that is the x86_64 cygwin
  // default from /usr/bin/rebaseall, applied only when platform is cygwin|msys.
  //
  // Remove /etc/rebase.db.x86_64 before and after (before avoids stale-db merge
  // errors; after matches the old batch). -p skips the dash-only process check.
  const runOpts: RunOptions = { env: stage.env };
  await step.run(stage.bash, ["--login", "-c", "rm -rf /etc/rebase.db.x86_64"], runOpts);
  await step.run(stage.dash, ["/usr/bin/rebaseall", "-p", "-b", "0x400000000"], {
    env: { ...stage.env, MSYS: "", MSYSTEM: "", CHERE_INVOKING: "" },
  });
  await step.run(stage.bash, ["--login", "-c", "rm -rf /etc/rebase.db.x86_64"], runOpts);
}
