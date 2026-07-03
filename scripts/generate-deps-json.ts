import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import {
  type RunContext,
} from "./run-context.ts";
import {
  GENERATED_DEPS_JSON,
  GENERATED_PKG_INFO_SH,
} from "./build-config.ts";
import {
  type Msys2Stage,
  stageRepoPath,
  runMsys2ScriptPath,
} from "./utils.ts";

export async function runGenerateDepsJson(step: RunContext, stage: Msys2Stage) {
  const portsDir = stageRepoPath(stage, "ports");
  const packages_list = await fs.readdir(portsDir);
  let script = "";
  for (let pkg_name of packages_list) {
    const fullUrl = path.join(portsDir, pkg_name, "PKGBUILD");
    if (!fsSync.existsSync(fullUrl)) {
      console.log(`Invalid ${fullUrl}`);
      continue;
    }
    // if (pkg_name.startsWith(".")) continue;
    script += `pkgrel=\n`;
    script += `pkgver=\n`;
    script += `pkgname=()\n`;
    script += `pkgbase=\n`;
    script += `makedepends=()\n`;
    script += `source ./ports/${pkg_name}/PKGBUILD; echo "{\\\"makedepends\\\": \\\"\${makedepends[*]}\\\", \\\"pkgrel\\\": \\\"\${pkgrel}\\\", \\\"pkgver\\\": \\\"\${pkgver}\\\", \\\"dir\\\": \\\"${pkg_name}\\\", \\\"pkgname\\\": \\\"\${pkgname[*]}\\\", \\\"pkgbase\\\": \\\"\${pkgbase}\\\"}"\n`;
  }
  const pkg_info_sh_path = stageRepoPath(stage, GENERATED_PKG_INFO_SH);
  await fs.writeFile(pkg_info_sh_path, script);
  const pkg_info = await runMsys2ScriptPath(step, stage, {
    script: GENERATED_PKG_INFO_SH,
    capture: true,
  });
  step.logFile(`All path checked`);
  step.logFile(pkg_info.stdout);

  const packages = await fs.readFile(stage.baseInstalledMsysTxt, "utf-8");

  const deps_map: Record<string, string[]> = {};
  for (let pkg_name of packages.trim().split("\n")) {
    if (pkg_name == undefined) {
      continue;
    }
    const deps = await step.run(
      stage.pactree,
      [pkg_name, "-u", "-d", "1"],
      { env: stage.env, capture: true },
    );
    step.logFile(`Deps for ${pkg_name} is :[\n${deps.stdout}\n]`);
    deps_map[pkg_name] = deps.stdout.trim().split("\n").slice(1);
  }
  await fs.writeFile(
    stageRepoPath(stage, GENERATED_DEPS_JSON),
    JSON.stringify(
      {
        pkg_info: JSON.parse(
          "[" + pkg_info.stdout.trim().split("\n").join(",") + "]",
        ),
        deps_map: deps_map,
      },
      null,
      2,
    ),
  );
}
