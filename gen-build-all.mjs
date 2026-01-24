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
  "perl-Test-Simple": "perl",
  "perl-Scalar-List-Utils": "perl",
  "perl-Exporter": "perl",
  "perl-IO-Socket-IP": "perl",
  "perl-IO-stringy": "perl-IO-Stringy",
  "libuuid-devel": "libutil-linux-devel",
  libuuid: "libutil-linux",
  awk: "gawk",
  sh: "bash",
  python3: "python",
  man: "man-db",
  autoconf: "autoconf-wrapper",
};

const packages_deferred_to_tail = [
  "autotools-wrappers",
  "autotools",
  "cmake",
  "gcc",
  "git",
  "gtk-doc",
  "meson",
  "ninja",
];

// gcc can only be built after bootstrap, so it's stage2
const packages_deferred_to_stage2 = [
  "mingw-w64-cross-gcc",
  "mingw-w64-cross-ucrt64-gcc",
  "mingw-w64-cross-mingw32-gcc",
  "mingw-w64-cross-mingw64-gcc",
  "mingw-w64-cross-mingwarm64-gcc",
  "rust",
];

// Remove deps that prevent bootstrap
const deps_remove_map = {
  // libiconv already be built at stage0
  libiconv: ["gettext"],
  libxslt: ["libxml2"],
  perl: ["groff", "libxcrypt"],
  "docbook-xsl": ["libxml2", "po4a"],
  "perl-Locale-Gettext": ["help2man"],
  doxygen: ["xz"],
  "mingw-w64-cross-mingwarm64-gcc": [
    "mingw-w64-cross-mingwarm64-crt",
    "mingw-w64-cross-mingwarm64-winpthreads",
    "mingw-w64-cross-mingwarm64-windows-default-manifest",
  ],
  "mingw-w64-cross-gcc": [
    "mingw-w64-cross-crt",
    "mingw-w64-cross-winpthreads",
    "mingw-w64-cross-windows-default-manifest",
  ],
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
        if (Object.hasOwn(deps_map, element)) {
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
  if (final_keys.length > 0) {
    process.exit(0);
  }
  return packages;
}

async function write_script(
  script_init_content,
  packages,
  output_filename,
  filter_package_out_set,
) {
  let script = script_init_content;
  let packages_will_build = [];
  for (let pkg of packages) {
    if (filter_package_out_set.has(pkg)) {
      continue;
    }
    script += `sh build-single.sh ${pkg}\n`;
    packages_will_build.push(pkg);
  }
  await fs.writeFile(output_filename, script);
  return packages_will_build;
}

async function get_deps_map_make() {
  const deps_json_filepath = path.join(__dirname, "deps.json");
  const deps_json = JSON.parse(await fs.readFile(deps_json_filepath, "utf-8"));
  const deps_map_make_pkg = {};
  const dir_for_package = {};

  for (let pkg of deps_json.pkg_info) {
    let packages_for_subdir = pkg.pkgname.split(" ");
    for (let pkgname of packages_for_subdir) {
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
        if (item in packages_provides_by) {
          item = packages_provides_by[item];
        }
        return item;
      });
      items = Array.from(new Set(items));
      // console.log(pkgname, items);
      deps_map_make_pkg[pkgname] = items;
      dir_for_package[pkgname] = pkg.dir;
      // console.log(deps_map_make_pkg[pkgname]);
    }
  }

  let deps_map_make = {};
  for (let key of Object.keys(deps_map_make_pkg)) {
    let dir_name = dir_for_package[key];
    if (!(dir_name in deps_map_make)) {
      deps_map_make[dir_name] = [];
    }
    let values = deps_map_make_pkg[key];
    let values_set = new Set(
      [].concat(
        deps_map_make[dir_name],
        values.map((x) => {
          let new_dir = dir_for_package[x];
          if (!new_dir) {
            console.log(key, x);
          }
          return new_dir;
        }),
      ),
    );
    if (values_set.has(dir_name)) values_set.delete(dir_name);
    for (let package_defer of packages_deferred_to_tail) {
      if (values_set.has(package_defer)) {
        values_set.delete(package_defer);
      }
    }
    deps_map_make[dir_name] = Array.from(values_set);
  }

  for (let filter_key of Object.keys(deps_remove_map)) {
    for (let pkg of deps_remove_map[filter_key]) {
      if (pkg in deps_map_make) {
        deps_map_make[pkg] = deps_map_make[pkg].filter((x) => x != filter_key);
      } else {
        console.log(`Invalid ${pkg}`);
      }
    }
  }

  deps_map_make["base-devel"].push(...packages_deferred_to_tail);

  deps_map_make["base-devel"].push("gcc");

  return deps_map_make;
}

async function main() {
  let deps_map_make = await get_deps_map_make();
  await fs.writeFile(
    "deps-map-make.json",
    JSON.stringify(deps_map_make, null, 2),
  );
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
    "msys-stage1-list.sh",
    new Set(packages_deferred_to_stage2),
  );

  let packages_will_build_set = new Set(packages_will_build);
  let packages_other = packages.filter((x) => !packages_will_build_set.has(x));

  await write_script(
    // texinfo need build twice as it's called perl in runtime for testing it self
    `sh build-single.sh texinfo
MSYS_BUILD_WITH_CLEAN=enabled sh build-single.sh libxml2
`,
    packages_other,
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
