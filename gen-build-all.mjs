import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let need_exit = false;
process.on("SIGINT", function () {
  console.log("Caught interrupt signal");
  need_exit = true;
});

const packages_provides_by = {
  "perl-CPAN-Meta": "perl",
  "libuuid-devel": "libutil-linux-devel",
};

const packages_deferred_to_tail = [
  "autotools",
  "cmake",
  "git",
  "gtk-doc",

  // iconv should be built at the stage0
  "libiconv-devel",
  "libiconv",
];

// gcc can only be built after bootstrap, so it's stage2
const packages_deferred_to_stage2 = [
  "mingw-w64-cross-gcc",
  "mingw-w64-cross-ucrt64-gcc",
  "mingw-w64-cross-mingw32-gcc",
  "mingw-w64-cross-mingw64-gcc",
  "mingw-w64-cross-mingwarm64-gcc",
];

// Remove deps that prevent bootstrap
const deps_remove_map = {
  perl: ["groff", "libxcrypt-devel", "libxcrypt"],
  libxslt: ["libxml2", "libxml2-devel"],
  "docbook-xsl": ["libxml2", "libxml2-devel", "po4a"],
  clang: ["llvm-libs"],
  ninja: ["re2c", "libzstd", "libzstd-devel"],
  "perl-Locale-Gettext": ["help2man"],
  pkgconf: ["meson"],
  doxygen: ["liblzma", "liblzma-devel"],

  // This is for building git at the stage1
  rust: ["git"],
};

function calc_deps(deps_map, pkg_name) {
  let packages = [pkg_name];
  let offset = 0;
  let pkg_set = new Set(packages);
  while (offset < packages.length) {
    let current_pkg_name = packages[offset];
    // console.log(current_pkg_name)
    offset += 1;
    let pkg_names_to_append = deps_map[current_pkg_name];
    delete deps_map[current_pkg_name];
    if (pkg_names_to_append == undefined) continue;
    for (let pkg of pkg_names_to_append) {
      if (pkg == undefined) {
        console.log(`Failed ${current_pkg_name}`);
        continue;
      }
      if (pkg in packages_provides_by) {
        pkg = packages_provides_by[pkg];
      }
      if (pkg_set.has(pkg)) {
        continue;
      }
      packages.push(pkg);
      pkg_set.add(pkg);
    }
  }
  return packages.reverse();
}

function dump_deps(deps_map) {
  // console.log(deps_map);
  let keys_count = -1;

  // gettext-devel
  let packages = [];

  for (;;) {
    let keys = Object.keys(deps_map);
    if (keys.length == keys_count) {
      break;
    }
    keys_count = keys.length;
    if (keys.length == 0) {
      break;
    }
    for (let key of keys) {
      if (deps_map[key].length == 0) {
        packages.push(key);
        delete deps_map[key];
      }
    }
    keys = Object.keys(deps_map);
    for (let key of keys) {
      let items = deps_map[key];
      items = items.filter((element) => {
        let item = element.split("=")[0];
        item = element.split(">")[0];
        item = element.split("<")[0];
        if (Object.hasOwn(deps_map, item)) {
          return true;
        }
      });
      deps_map[key] = items;
    }
  }

  let final_keys = Object.keys(deps_map);
  console.log(`Circular map ${final_keys.length}`);
  for (let key of final_keys) {
    console.log(`${key}: ${JSON.stringify(deps_map[key])}`);
  }
  return packages;
}

async function write_script(
  script_init_content,
  packages,
  dir_for_package,
  output_filename,
  filter_package_out_set,
) {
  let dirs = [];
  let dir_set = new Set();
  let script = script_init_content;
  let packages_in_dir = {};
  for (let pkg of Object.keys(dir_for_package)) {
    let new_dir = dir_for_package[pkg];
    if (!(new_dir in packages_in_dir)) packages_in_dir[new_dir] = [];
    packages_in_dir[new_dir].push(pkg);
  }
  let packages_will_build = [];
  for (let pkg of packages) {
    let new_dir = dir_for_package[pkg];
    if (new_dir === undefined) {
      console.log(`new_dir: ${new_dir} for ${pkg}`);
    }
    if (filter_package_out_set.has(pkg)) {
      continue;
    }
    packages_will_build.push(pkg);
    if (!dir_set.has(new_dir)) {
      dirs.push(new_dir);
      dir_set.add(new_dir);
    }
  }
  // let dir_lines = await fs.readFile("failed_dirs.txt", "utf-8");
  // dirs = dir_lines.split("\n");
  // console.log(dirs)
  for (let new_dir of dirs) {
    script += `sh build-single.sh ${new_dir}\n`;
    packages_will_build.push(...packages_in_dir[new_dir]);
  }
  // console.log(dirs)
  await fs.writeFile(output_filename, script);
  return packages_will_build;
}

async function get_deps_map_make() {
  const deps_json_filepath = path.join(__dirname, "deps.json");
  const deps_json = JSON.parse(await fs.readFile(deps_json_filepath, "utf-8"));
  // dump_deps(deps_json.deps_map);
  const deps_map_make = {};
  const dir_for_package = {};

  let packages_deferred_set = new Set(
    [].concat(packages_deferred_to_tail, packages_deferred_to_stage2),
  );
  for (let pkg of deps_json.pkg_info) {
    for (let pkgname of pkg.pkgname.split(" ")) {
      let items = [];
      if (!deps_json.deps_map[pkgname]) {
        deps_json.deps_map[pkgname] = [];
      }
      if (typeof pkg.makedepends == "string" && pkg.makedepends.trim() != "") {
        items = [].concat(
          pkg.makedepends.split(" "),
          deps_json.deps_map[pkgname],
        );
      } else {
        items = deps_json.deps_map[pkgname];
      }
      items = items.map((element) => {
        if (element == undefined) {
          console.log(
            `Undefined for: ${pkgname} makedepends: '${pkg.makedepends}'`,
          );
          return "";
        }
        let item = element.split("=")[0];
        item = item.split(">")[0];
        item = item.split("<")[0];
        return item;
      });
      items = items.filter(
        (x) =>
          !packages_deferred_set.has(x) &&
          x != "gcc-libs" &&
          x != "gcc" &&
          x != pkgname &&
          x != "",
      );
      items = Array.from(new Set(items));
      // console.log(pkgname, items);
      deps_map_make[pkgname] = items;
      dir_for_package[pkgname] = pkg.dir;
      // console.log(deps_map_make[pkgname]);
    }
  }

  for (let filter_key of Object.keys(deps_remove_map)) {
    for (let pkg of deps_remove_map[filter_key]) {
      deps_map_make[pkg] = deps_map_make[pkg].filter((x) => x != filter_key);
    }
  }

  deps_map_make["base-devel"].push(...packages_deferred_to_tail);

  deps_map_make["base-devel"].push("tcl-doc");
  deps_map_make["base-devel"].push("tcl-devel");
  deps_map_make["base-devel"].push("bash-devel");

  deps_map_make["base-devel"].push("gcc");

  return { deps_map_make, dir_for_package };
}

async function main() {
  let { deps_map_make, dir_for_package } = await get_deps_map_make();

  console.log("deps_map_make update finished");
  // console.log(JSON.stringify(deps_map_make, null, 2))
  let deps_map_make_cloned = JSON.parse(JSON.stringify(deps_map_make));
  let packages = dump_deps(deps_map_make);
  let packages_to_include_base_devel = new Set([]);
  if (Object.keys(deps_map_make).length == 0) {
    console.log("All packages are sorted out");
    packages_to_include_base_devel = new Set(
      calc_deps(deps_map_make_cloned, "base-devel"),
    );
  }

  let packages_base_devel = packages.filter((x) =>
    packages_to_include_base_devel.has(x),
  );

  const packages_will_build = await write_script(
    "",
    packages_base_devel,
    dir_for_package,
    "msys-stage1-list.sh",
    new Set(packages_deferred_to_stage2),
  );

  let packages_will_build_set = new Set(packages_will_build);
  let packages_other = packages.filter((x) => !packages_will_build_set.has(x));

  await write_script(
    // texinfo need build twice as it's called perl in runtime for testing it self
    `#!/bin/bash
sh build-single.sh texinfo
`,
    packages_other,
    dir_for_package,
    "msys-stage2-list.sh",
    new Set([
      // :: cmake-bootstrap-4.2.1-1 and cmake-4.2.1-2 are in conflict. Remove cmake? [Y/n]
      "cmake-bootstrap",

      // :: mingw-w64-cross-clang-crt-13.0.0.r1.gb45abfec4-1 and mingw-w64-cross-crt-13.0.0.r1.gb45abfec4-1 are in conflict. Remove mingw-w64-cross-crt? [Y/n] n
      "mingw-w64-cross-clang",
      // :: mingw-w64-cross-clang-crt-13.0.0.r1.gb45abfec4-1 and mingw-w64-cross-crt-13.0.0.r1.gb45abfec4-1 are in conflict. Remove mingw-w64-cross-crt? [Y/n] n
      "mingw-w64-cross-clang-crt",
      // :: mingw-w64-cross-clang-headers-13.0.0.r1.gb45abfec4-1 and mingw-w64-cross-headers-13.0.0.r1.gb45abfec4-1 are in conflict. Remove mingw-w64-cross-headers?
      "mingw-w64-cross-clang-headers",

      // parallel: /usr/bin/parallel exists in filesystem /usr/bin/parallel.exe is owned by moreutils 0.70-1
      "parallel",

      // gnu-netcat-0.7.1-3 and openbsd-netcat-1.234_1-1 are in conflict. Remove openbsd-netcat? [Y/n] "
      "gnu-netcat",
    ]),
  );
}

main();
