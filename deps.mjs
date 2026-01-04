import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import process from "node:process";
import { black_list, spawnProcessAsyncCapture } from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let need_exit = false;
process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
  need_exit = true;
});

async function main() {
  const portsDir = path.join(__dirname, "ports");
  const packages_list = await fs.readdir(portsDir);
  let script = "";
  for (let pkg_name of packages_list) {
    const fullUrl = path.join(portsDir, pkg_name, "PKGBUILD");
    if (!fsSync.existsSync(fullUrl)) {
      console.log(`Invalid ${fullUrl}`);
      continue
    }
    // if (pkg_name.startsWith(".")) continue;
    script += `pkgrel=\n`;
    script += `pkgver=\n`;
    script += `pkgname=()\n`;
    script += `pkgbase=\n`;
    script += `makedepends=()\n`;
    script += `source ./ports/${pkg_name}/PKGBUILD; echo "{\\\"makedepends\\\": \\\"\${makedepends[*]}\\\", \\\"pkgrel\\\": \\\"\${pkgrel}\\\", \\\"pkgver\\\": \\\"\${pkgver}\\\", \\\"dir\\\": \\\"${pkg_name}\\\", \\\"pkgname\\\": \\\"\${pkgname[*]}\\\", \\\"pkgbase\\\": \\\"\${pkgbase}\\\"}"\n`;
  }
  await fs.writeFile("pkg_info.sh", script);
  const pkg_info = await spawnProcessAsyncCapture(
    `C:/CI-Tools/msys64/usr/bin/bash.exe`,
    ["--login", "-c", "source pkg_info.sh"],
    {
      env: {
        CHERE_INVOKING: 1,
      },
    }
  );
  console.log(`All path checked`);
  console.log(pkg_info.stdout);

  const msys_packages = path.join(__dirname, "msys.txt");
  const packages = await fs.readFile(msys_packages, "utf-8");

  const deps_map = {};
  for (let pkg_name of packages.trim().split("\n")) {
    if (black_list.has(pkg_name)) continue;
    if (pkg_name == undefined) {
      continue
    }
    if (need_exit) {
      break;
    }
    const deps = await spawnProcessAsyncCapture(
      `C:/CI-Tools/msys64/usr/bin/pactree.exe`,
      [pkg_name, "-u", "-d", "1"]
    );
    console.log(`Deps for ${pkg_name} is :[\n${deps.stdout}\n]`);
    deps_map[pkg_name] = deps.stdout.trim().split("\n").slice(1);
  }
  await fs.writeFile(
    "deps.json",
    JSON.stringify(
      {
        pkg_info: JSON.parse(
          "[" + pkg_info.stdout.trim().split("\n").join(",") + "]"
        ),
        deps_map: deps_map,
      },
      null,
      2
    )
  );
}

main();
