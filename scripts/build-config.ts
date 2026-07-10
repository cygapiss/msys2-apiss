export const DEFAULT_CI_TOOLS_ROOT = "D:/CI-Tools";

/**
 * Stage naming. One stage-id form throughout (hyphens, no msys64- prefix);
 * it is the same string as MSYS_BOOTSTRAP_STAGE, so no underscore/hyphen
 * conversion is needed anywhere.
 *
 * 1. Msys2StageId -- build-phase id used by runBuildPackageList,
 *    generated list/install basenames, and PKGBUILD checks. The four
 *    Msys2StageTreeId values (stage1, stage2, stage3, stage3-mingw64) plus
 *    substages that share an MSYS tree (stage1-rt-hook, stage1-core,
 *    stage2-cross-clang, stage2-cross-rust, stage2-conflict).
 *
 * 2. Generated list/install basenames -- scripts/generated/{id}-list.txt
 *    and {id}-install.txt via generatedTxtPath; {id} is the stage id used
 *    verbatim. Examples: stage1-rt-hook-list.txt, stage3-mingw64-list.txt.
 *
 * 3. CI stage tree directories (keep msys64- prefix) -- resolved only by
 *    initMsys2Stage in scripts/utils.ts (ciToolsBase()):
 *      ciToolsBase = process.env.CI_TOOLS_ROOT || DEFAULT_CI_TOOLS_ROOT
 *      stageRoot      = ${ciToolsBase}/msys64-${stageTreeId}
 *    Callers pass Msys2StageId; initMsys2Stage maps it via
 *    BUILD_PACKAGE_LIST_STAGE_CONFIG to the physical tree (stageTreeId) and
 *    merges bootstrapEnv with optional optionsEnv. Examples:
 *    D:/CI-Tools/msys64-stage1, D:/CI-Tools/msys64-stage3-mingw64. Tests
 *    use makeMsys2Stage, which uses a temp ciToolsBase with the same
 *    layout instead of ciToolsBase().
 *
 * 4. dist/ and build-cache/ (no msys64- prefix) -- scripts/sh/single.sh
 *    writes to dist/${MSYS_BOOTSTRAP_STAGE}/ and
 *    build-cache/${MSYS_BOOTSTRAP_STAGE}/, using the stage id verbatim.
 *
 * Keep msys64- elsewhere only for real on-disk names: inner root
 * MSYS64_DIR_NAME (msys64/), shared pacman cache MSYS64_CACHES_DIR_NAME
 * (msys64-caches/), and the CI stage trees above.
 *
 * 5. Pacman install lists (all for pacman -S):
 *    - msys64/msys.txt -- stage1 install prep (inside the base tree)
 *    - GENERATED_MSYS_MINGW64_TXT -- stage3-mingw64 install prep, from
 *      scripts/mingw-install-list.ts
 *    - stage3_mingw64_build_packages -- stage3-mingw64-list.txt via
 *      generate-package-lists.ts
 */

/** CI stage tree dirs (msys64-{id}); re-extract via delete-msys64.bat + extract.bat. */
export const MSYS2_STAGE_TREES = [
  "stage1",
  "stage2",
  "stage3",
  "stage3-mingw64",
] as const;

export type Msys2StageTreeId = (typeof MSYS2_STAGE_TREES)[number];

/** Build phases with their own generated *-list.txt / *-install.txt.
 *  Full Msys2StageTreeId values plus substages that share one MSYS tree. */
export type Msys2StageId =
  | Msys2StageTreeId
  | "stage1-rt-hook"
  | "stage1-core"
  | "stage2-cross-clang"
  | "stage2-cross-rust"
  | "stage2-conflict";

export const GENERATED_DIR = "scripts/generated";

export const SCRIPTS_LOGS_DIR = "scripts/logs";


export const MSYS2_BASE_TARBALL_RELEASE = ["2026", "06", "11"] as const;

const MSYS2_BASE_TARBALL_RELEASE_TAG = MSYS2_BASE_TARBALL_RELEASE.join("-");
const MSYS2_BASE_TARBALL_RELEASE_COMPACT = MSYS2_BASE_TARBALL_RELEASE.join("");

export const MSYS2_BASE_TARBALL =
  `msys2-base-x86_64-${MSYS2_BASE_TARBALL_RELEASE_COMPACT}.tar.zst`;

/** Cached msys64 tree after installMsys2Base (extract + bootstrap + -Syu). */
export const MSYS2_BASE_INSTALLED_TARBALL =
  `msys2-base-x86_64-${MSYS2_BASE_TARBALL_RELEASE_COMPACT}-installed.tar`;

export const MSYS2_BASE_TARBALL_URL =
  `https://github.com/msys2/msys2-installer/releases/download/${MSYS2_BASE_TARBALL_RELEASE_TAG}/${MSYS2_BASE_TARBALL}`;


export const MSYS64_DIR_NAME = "msys64";

export const MSYS64_CACHES_DIR_NAME = "msys64-caches";

/** Relative to an MSYS64 root (e.g. msys64/var/cache/pacman/pkg). */
export const PACMAN_PKG_CACHE_SUBDIR = "var/cache/pacman/pkg";

export const MSYS_BASH_ENV = {
  MSYS: "winsymlinks:native",
  MSYSTEM: "CYGWIN",
  CHERE_INVOKING: "1",
};

export const PKG_ARCHIVE_SUFFIX = ".pkg.tar.zst";

export const PKG_ARCHES = ["any", "x86_64", "i686"] as const;

export const GENERATED_MSYS_MINGW64_TXT = "scripts/generated/msys-mingw64.txt";

export const GENERATED_PKG_INFO_SH = "scripts/generated/pkg_info.sh";

export const GENERATED_DEPS_JSON = "scripts/generated/deps.json";

export const GENERATED_DEPS_MAP_MAKE_JSON = "scripts/generated/deps-map-make.json";

export const bootstrap_env_stage1_rt_hook = {
  MSYS_BUILD_PKGSUMS: "disabled",
  MSYS_BOOTSTRAP_STAGE: "stage1-rt-hook",
};

export const bootstrap_env_stage1_core = {
  MSYS_BOOTSTRAP_STAGE: "stage1-core",
};

export const bootstrap_env_stage1 = {
  MSYS_BOOTSTRAP_STAGE: "stage1",
};

export const bootstrap_env_stage2 = {
  MSYS_BOOTSTRAP_STAGE: "stage2",
  MSYS_BOOTSTRAP_PACMAN_INSTALL: "enabled",
};

export const bootstrap_env_stage2_cross_clang = {
  MSYS_BOOTSTRAP_STAGE: "stage2-cross-clang",
  MSYS_BOOTSTRAP_PACMAN_INSTALL: "enabled",
};

export const bootstrap_env_stage2_conflict = {
  MSYS_BOOTSTRAP_STAGE: "stage2-conflict",
};

export const bootstrap_env_stage2_cross_rust = {
  MSYS_BOOTSTRAP_STAGE: "stage2-cross-rust",
  MSYS_BOOTSTRAP_RUST: "enabled",
  MSYS_BOOTSTRAP_PACMAN_INSTALL: "enabled",
};

export const bootstrap_env_stage3 = {
  MSYS_BOOTSTRAP_STAGE: "stage3",
};

export const bootstrap_env_stage3_mingw64 = {
  MSYS_BOOTSTRAP_STAGE: "stage3-mingw64",
  MSYSTEM: "MINGW64",
  MSYS_BOOTSTRAP_PACMAN_INSTALL: "enabled",
};

export type BuildPackageListStageConfig = {
  stageTreeId: Msys2StageTreeId;
  bootstrapEnv: NodeJS.ProcessEnv;
  setupScriptPath?: string;
  finalizeScriptPath?: string;
};

export const BUILD_PACKAGE_LIST_STAGE_CONFIG: Record<
  Msys2StageId,
  BuildPackageListStageConfig
> = {
  "stage1-rt-hook": {
    stageTreeId: "stage1",
    bootstrapEnv: bootstrap_env_stage1_rt_hook,
  },
  "stage1-core": {
    stageTreeId: "stage1",
    bootstrapEnv: bootstrap_env_stage1_core,
  },
  "stage1": {
    stageTreeId: "stage1",
    bootstrapEnv: bootstrap_env_stage1,
    setupScriptPath: "scripts/sh/stage1-init.sh",
  },
  "stage2-cross-rust": {
    stageTreeId: "stage2",
    bootstrapEnv: bootstrap_env_stage2_cross_rust,
  },
  "stage2": {
    stageTreeId: "stage2",
    bootstrapEnv: bootstrap_env_stage2,
  },
  "stage2-conflict": {
    stageTreeId: "stage2",
    bootstrapEnv: bootstrap_env_stage2_conflict,
  },
  "stage2-cross-clang": {
    stageTreeId: "stage2",
    bootstrapEnv: bootstrap_env_stage2_cross_clang,
    setupScriptPath: "scripts/sh/cross-clang-setup.sh",
    finalizeScriptPath: "scripts/sh/cross-clang-finalize.sh",
  },
  "stage3": {
    stageTreeId: "stage3",
    bootstrapEnv: bootstrap_env_stage3,
  },
  "stage3-mingw64": {
    stageTreeId: "stage3-mingw64",
    bootstrapEnv: bootstrap_env_stage3_mingw64,
  },
};

export const BUILD_PACKAGE_LIST_STAGES = Object.keys(
  BUILD_PACKAGE_LIST_STAGE_CONFIG,
) as Msys2StageId[];

export function isMsys2StageId(
  value: string,
): value is Msys2StageId {
  return value in BUILD_PACKAGE_LIST_STAGE_CONFIG;
}

/** Built in stage2-cross-rust with MSYS_BOOTSTRAP_RUST. */
export const packages_cross_rust = [
  "rust",
];

/** Skip upstream pacman -S / pactree in generate-deps-json.ts and install-stages.ts. */
export const packages_skip_build = [
  "msys2-runtime-3.3",
  "msys2-runtime-3.3-devel",
  "msys2-runtime-3.4",
  "msys2-runtime-3.4-devel",
  "msys2-runtime-3.5",
  "msys2-runtime-3.5-devel",
];

export const packages_conflict = [
  // "ca-certificates",
  "cmake-bootstrap", // cmake-emacs-4.2.1-1 and cmake-bootstrap-4.2.1-1 are in conflict.
  "parallel", // parallel: /usr/bin/parallel exists in filesystem /usr/bin/parallel.exe is owned by moreutils 0.70-1
  "gnu-netcat", // gnu-netcat-0.7.1-3 and openbsd-netcat-1.234_1-1 are in conflict. Remove openbsd-netcat? [Y/n] "
  // uutils cp -a breaks Cygwin bootstrap (xattr spam, EEXIST on dir merge).
  // Use GNU coreutils during stage1 prep; uutils-coreutils is built at stage2-conflict.
  "uutils-coreutils",
];

/** Built in stage2-cross-clang; excluded from stage2-list.txt. */
export const packages_cross_clang = [
  // mingw-w64-cross-clang-headers-13.0.0.r1.gb45abfec4-1 and
  // mingw-w64-cross-headers-14.0.0.r147.g31bd54ab7-1 are in conflict.
  "mingw-w64-cross-clang-headers",
  // makedepends on "${_mingw_suff}-clang-headers", so for build it properly,
  //  it's still need to build after mingw-w64-cross-clang-headers
  "mingw-w64-cross-compiler-rt",
  "mingw-w64-cross-clang-crt",
  "mingw-w64-cross-clang",
];

export const packages_excluded_from_stage_lists = [
  ...packages_skip_build,
  ...packages_conflict,
  ...packages_cross_clang,
];

/**
 * Packages excluded from bootstrap pacman installs and dependency expansion.
 *
 * Packages in packages_skip_build are handled by this bootstrap repo, so
 * generate-deps-json.ts and installer prep must not pull the upstream package
 * with pacman -S/pactree. Packages in packages_cross_clang and
 * packages_conflict are built in dedicated pipeline steps. Cross rust is built
 * in stage2-cross-rust-list.txt; gcc and native rust are built from
 * stage2-list.txt with rebaseall after each rust package install.
 */
export const pacman_excluded_packages = new Set(packages_excluded_from_stage_lists);

// Fixed stage1 substage build lists. runGeneratePackageLists writes these to
// scripts/generated/stage1-rt-hook-list.txt and
// stage1-core-list.txt; the stage1-rt-hook-list-build and
// stage1-core-list-build pipeline steps read them back. Edit the order here, not in the generated files.
export const stage1_rt_hook_packages = [
  "msys2-runtime",
];

// stage1-core bootstrap build order (fixed; see BUILD.md).
// msys2-runtime and libtool are independent.
// libiconv depends on msys2-runtime and libtool.
// gcc depends on libiconv; binutils is independent of gcc.
// cmake, meson, scons follow the core toolchain.
export const stage1_core_packages = [
  "msys2-runtime",
  "libtool",
  "libiconv",
  "gcc",
  "binutils",
  "cmake",
  "meson",
  "scons",
];

/** ports-mingw directory names for stage3-mingw64-list.txt (one per line). */
export const stage3_mingw64_build_packages = [
  // "mingw-w64-libepoxy",
  "mingw-w64-mesa",
  // angleproject do not support for opengl, so use mesa zink/d3d12 is a better choice.
  // "mingw-w64-angleproject",
];

export const EXTRACT_BAT_FILENAME = "extract.bat";

export const DELETE_MSYS64_BAT_FILENAME = "delete-msys64.bat";
