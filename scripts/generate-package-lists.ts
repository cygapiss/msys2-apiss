import * as fs from "fs/promises";
import {
  GENERATED_DEPS_JSON,
  GENERATED_DEPS_MAP_MAKE_JSON,
  type Msys2StageId,
  packages_conflict,
  packages_cross_clang,
  packages_cross_rust,
  packages_excluded_from_stage_lists,
  stage1_core_packages,
  stage1_rt_hook_packages,
  stage3_mingw64_build_packages,
} from "./build-config.ts";
import { generatedTxtPath, stageRepoPath, type Msys2Stage } from "./utils.ts";
import {
  type RunLogger,
} from "./run-context.ts";

type PkgInfo = {
  makedepends: string;
  pkgrel: string;
  pkgver: string;
  dir: string;
  pkgname: string;
  pkgbase: string;
};

type DepsJson = {
  pkg_info: PkgInfo[];
  deps_map: Record<string, string[]>;
};

type DepsMapMake = Record<string, string[]>;

const packages_provides_by: Record<string, string> = {
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
const deps_remove_map: Record<string, string[]> = {
  // libiconv already be built at stage1-core
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
  // file need built before util-linux, but python depends on util-linux, break the cycle
  "python": ["file"],
};

function calc_deps(
  step: RunLogger,
  deps_map: DepsMapMake,
  pkg_name: string,
) {
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
        step.logFile(`Failed ${current_pkg_name}`);
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

function dump_deps(step: RunLogger, deps_map: DepsMapMake) {
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
      items = items.filter((element: string) => Object.hasOwn(deps_map, element));
      deps_map[key] = items;
    }
  }

  let final_keys = Object.keys(deps_map);
  step.logFile(`Circular map ${final_keys.length}`);
  for (let key of final_keys) {
    step.logFile(`${key}: ${JSON.stringify(deps_map[key])}`);
  }
  if (final_keys.length > 0) {
    throw new Error(
      `Circular dependencies remain (${final_keys.length}); see deps log`,
    );
  }
  return packages;
}

async function write_package_list(
  prefix_packages: string[],
  packages: string[],
  output_filename: string,
  filter_package_out_set: Set<string>,
) {
  let packages_will_build = [];
  let lines = [...prefix_packages];
  for (let pkg of packages) {
    if (filter_package_out_set.has(pkg)) {
      continue;
    }
    lines.push(pkg);
    packages_will_build.push(pkg);
  }
  await fs.writeFile(output_filename, lines.join("\n") + "\n");
  return packages_will_build;
}

function deps_map_for(
  deps_map: DepsMapMake,
  pkgname: string,
): string[] {
  return (deps_map[pkgname] ?? []).filter(
    (element): element is string => element != undefined,
  );
}

async function get_deps_map_make(
  step: RunLogger,
  stage: Msys2Stage,
): Promise<DepsMapMake> {
  const deps_json = JSON.parse(
    await fs.readFile(stageRepoPath(stage, GENERATED_DEPS_JSON), "utf-8"),
  ) as DepsJson;
  const deps_map_make_pkg: Record<string, string[]> = {};
  const dir_for_package: Record<string, string> = {};

  for (let pkg of deps_json.pkg_info) {
    let packages_for_subdir = pkg.pkgname.split(" ");
    for (let pkgname of packages_for_subdir) {
      let items: string[] = [];
      const map_deps = deps_map_for(deps_json.deps_map, pkgname);
      if (typeof pkg.makedepends == "string" && pkg.makedepends.trim() != "") {
        items = [
          ...pkg.makedepends.split(" "),
          ...map_deps,
        ];
      } else {
        items = map_deps;
      }
      items = items.map((element) => {
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

  const deps_map_make: DepsMapMake = {};
  for (let key of Object.keys(deps_map_make_pkg)) {
    let dir_name = dir_for_package[key];
    if (!(dir_name in deps_map_make)) {
      deps_map_make[dir_name] = [];
    }
    let values = deps_map_make_pkg[key];
    let values_set = new Set<string>([
      ...deps_map_make[dir_name],
      ...values.flatMap((x) => {
        const new_dir = dir_for_package[x];
        if (!new_dir) {
          step.logFile(`${key}, ${x}`);
          return [];
        }
        return [new_dir];
      }),
    ]);
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
        step.logFile(`Invalid ${pkg}`);
      }
    }
  }

  deps_map_make["base-devel"].push(...packages_deferred_to_tail);

  deps_map_make["base-devel"].push("gcc");

  return deps_map_make;
}

async function runGenerateFixedPackageLists(
  step: RunLogger,
  stage: Msys2Stage,
) {
  const fixed_package_lists: Array<
    [Msys2StageId, readonly string[]]
  > = [
    ["stage1-rt-hook", stage1_rt_hook_packages],
    ["stage1-core", stage1_core_packages],
    ["stage2-cross-clang", packages_cross_clang],
    ["stage2-cross-rust", packages_cross_rust],
    ["stage2-conflict", packages_conflict],
    ["stage3", []],
    ["stage3-mingw64", stage3_mingw64_build_packages],
  ];
  for (const [stageId, packages] of fixed_package_lists) {
    await fs.writeFile(
      stageRepoPath(stage, generatedTxtPath(stageId, "list")),
      packages.join("\n") + "\n",
    );
  }
  step.log(
    `fixed package lists update finished: ${fixed_package_lists.map(([id]) => id).join(", ")}`,
  );
}

export async function runGeneratePackageLists(
  step: RunLogger,
  stage: Msys2Stage,
) {
  await runGenerateFixedPackageLists(step, stage);

  let deps_map_make = await get_deps_map_make(step, stage);
  await fs.writeFile(
    stageRepoPath(stage, GENERATED_DEPS_MAP_MAKE_JSON),
    JSON.stringify(deps_map_make, null, 2),
  );
  step.log("deps_map_make update finished");
  // console.log(JSON.stringify(deps_map_make, null, 2))
  let deps_map_make_cloned = JSON.parse(JSON.stringify(deps_map_make));
  let packages = dump_deps(step, deps_map_make);
  let packages_to_include_base_devel = new Set<string>([]);
  if (Object.keys(deps_map_make).length == 0) {
    step.log("All packages are sorted out");
    packages_to_include_base_devel = new Set(
      calc_deps(step, deps_map_make_cloned, "base-devel"),
    );
  }
  let packages_base_devel = packages.filter((x) =>
    packages_to_include_base_devel.has(x),
  );

  const packages_will_build = await write_package_list(
    [],
    packages_base_devel,
    stageRepoPath(stage, generatedTxtPath("stage1", "list")),
    new Set([...packages_deferred_to_stage2, ...packages_excluded_from_stage_lists]),
  );

  let packages_will_build_set = new Set(packages_will_build);
  let packages_other = packages.filter((x) => !packages_will_build_set.has(x));

  // Build the stage2 toolchain and cargo support first so later packages can
  // use gcc, rust, and cargo-c from the live stage2 root.
  // texinfo need build twice as it's called perl in runtime for testing it self
  // libxml2 and libxslt depends on each other, so build libxml2 twice,
  // as libxml2 is already built before libxslt at stage1
  // gcc and rust are built first in stage2-list.txt; package-build-pipeline.ts runs
  // rebaseall after each rust package install on stage2.
  const packages_built_first = ["gcc", "rust", "cargo-c", "texinfo", "libxml2"];

  await write_package_list(
    packages_built_first,
    packages_other,
    stageRepoPath(stage, generatedTxtPath("stage2", "list")),
    new Set([...packages_built_first, ...packages_excluded_from_stage_lists]),
  );
}
