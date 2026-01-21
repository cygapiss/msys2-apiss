import * as path from "path";
import { fileURLToPath } from "url";
import { spawnProcessAsync } from "./utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
});

async function main() {
  const ci_tools_root = "E:/CI-Tools/msys64-stage2";
  // const ci_tools_root = "C:/CI-Tools";
  const msys_root = path.join(ci_tools_root, "msys64");
  const pkg_root = __dirname;

  for (let i = 0; i < 2; i += 1) {
    await spawnProcessAsync(
      `${msys_root}/usr/bin/bash.exe`,
      ["--login", "-c", "pacman -U --noconfirm --overwrite \\* `ls | tr '\n' ' '`"],
      {
        cwd: path.join(pkg_root, "dist"),
        env: {
          MSYS: "winsymlinks:native",
          MSYSTEM: "MSYS",
          CHERE_INVOKING: "1",
        },
      },
    );
  }
}

main();
