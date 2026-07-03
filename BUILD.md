# Bootstrapping msys-2.0.dll to cygwin1.dll

This repo bootstraps a patched `msys2-runtime` that replaces upstream
`msys-2.0.dll` with a Cygwin-compatible `cygwin1.dll` build. The full pipeline
is driven by [start.bat](start.bat), which runs `node scripts/start.ts`.

Use `start.bat --from <step>` to resume from any pipeline step. Run
`start.bat --help` for the step list (generated from `scripts/pipeline.ts`).

## Steps

### Config CI_TOOLS_ROOT properly

Set `CI_TOOLS_ROOT` if your CI tools are not under `D:/CI-Tools` (the default
`DEFAULT_CI_TOOLS_ROOT` in [scripts/build-config.ts](scripts/build-config.ts)):

```bat
set CI_TOOLS_ROOT=D:\CI-Tools
```

[start.bat](start.bat) sets the same default when the variable is unset.
[scripts/utils.ts](scripts/utils.ts) resolves stage paths via
`process.env.CI_TOOLS_ROOT || DEFAULT_CI_TOOLS_ROOT`; there is no separate
default to edit in `utils.ts`.

Install Node tooling once:

```bat
yarn install
```

### Run the full pipeline

`start.bat` installs stage1 MSYS packages into `msys64-stage1`, then runs
`generate-deps-json.ts` and `generate-package-lists.ts` to refresh
`scripts/generated/deps.json` and the stage package lists before
**`stage1-list-build`** (group 5).

See [What `start.bat` runs](#what-startbat-runs), [Resume with `--from`](#resume-with-from),
[`rebaseall` troubleshooting](#why-rebaseall--p-failed), and the fixed
[stage1-core-list.txt build order](#stage1-core-listtxt-build-order).

Open a normal Command Prompt or MSYS2-CYGWIN terminal, not the Cursor
integrated terminal. IDE terminals can put the wrong `bash`/`dash` on `PATH`
and break `rebaseall -p`.

From the repo root:

```bat
set CI_TOOLS_ROOT=D:\CI-Tools
start.bat
start.bat --help
start.bat --from stage2-cross-rust
```

Re-run dependency generation after port changes:

```bat
start.bat --from stage1-generate-deps-json
start.bat --from stage1-generate-package-lists --only
```

`stage1-generate-deps-json` refreshes `deps.json` (reads the msys package list
from `%CI_TOOLS_ROOT%/msys64-stage1/msys64/msys.txt`, written during
`stage1-install-prep` by `installMsys2Base`).
`stage1-generate-package-lists` writes the stage1/stage2 lists.

Outputs from **`stage1-generate-deps-json`** and
**`stage1-generate-package-lists`**:

- `scripts/generated/pkg_info.sh`
- `scripts/generated/deps.json`
- `scripts/generated/deps-map-make.json`
- `scripts/generated/stage1-list.txt`
- `scripts/generated/stage2-list.txt`

Written during **`stage1-install-prep`** (`installMsys2Base`, then
`installMsys2AllPackages()` in `install-stages.ts`):

- `%CI_TOOLS_ROOT%/msys64-stage1/msys64/msys.txt` -- msys repo package list;
  consumed by `stage1-generate-deps-json` and the install-prep pacman step

Written during **`stage3-mingw64-install`** (`install-stages.ts`):

- `scripts/generated/msys-mingw64.txt` (package names from
  `scripts/mingw-install-list.ts`)

Fixed-order bootstrap lists (written by `generate-package-lists.ts` from fixed
lists in `scripts/build-config.ts`; see
[stage1-core-list.txt build order](#stage1-core-listtxt-build-order)):

- `scripts/generated/stage1-core-list.txt`
- `scripts/generated/stage1-rt-hook-list.txt`

Per-stage package build and install lists (one pair per
`Msys2StageId`; bootstrap list files for stage1-core and
stage1-rt-hook are listed above):

- `scripts/generated/stage1-rt-hook-install.txt`
- `scripts/generated/stage1-core-install.txt`
- `scripts/generated/stage1-list.txt` / `-install.txt`
- `scripts/generated/stage2-cross-rust-list.txt` / `-install.txt`
- `scripts/generated/stage2-list.txt` / `-install.txt`
- `scripts/generated/stage2-conflict-list.txt` / `-install.txt`
- `scripts/generated/stage2-cross-clang-list.txt` / `-install.txt`
- `scripts/generated/stage3-list.txt` / `-install.txt` (empty placeholder;
  no `stage3-list-build` step; cygwin stage3 is install-prep + deps-check only)
- `scripts/generated/stage3-mingw64-list.txt` / `-install.txt`

Logs are written under `scripts/logs/` (one file per pipeline step id):

- `scripts/logs/stage1-install-prep.txt`
- `scripts/logs/stage1-extract.txt`
- `scripts/logs/stage1-generate-deps-json.txt`
- `scripts/logs/stage1-generate-package-lists.txt`
- `scripts/logs/stage1-rt-origin-download.txt`
- `scripts/logs/stage1-rt-origin-install.txt`
- `scripts/logs/stage1-rt-hook-list-build.txt`
- `scripts/logs/stage1-rt-hook-install.txt`
- `scripts/logs/stage1-core-list-build.txt`
- `scripts/logs/stage1-list-build.txt`
- `scripts/logs/stage2-install-prep.txt`
- `scripts/logs/stage2-extract.txt`
- `scripts/logs/stage2-deps-check.txt`
- `scripts/logs/stage2-cross-rust.txt`
- `scripts/logs/stage2-list-build.txt`
- `scripts/logs/stage2-conflict.txt`
- `scripts/logs/stage2-cross-clang.txt`
- `scripts/logs/stage3-install-prep.txt`
- `scripts/logs/stage3-extract.txt`
- `scripts/logs/stage3-deps-check.txt`
- `scripts/logs/stage3-mingw64-prep.txt`
- `scripts/logs/stage3-mingw64-install.txt`
- `scripts/logs/stage3-mingw64-list-build.txt`
- `scripts/logs/stage3-mingw64-list-install.txt`
- `scripts/logs/stage3-mingw64-archive.txt`
- `scripts/logs/stage3-mingw64-extract.txt`
- `scripts/logs/stage-all-finished.txt`

## What `start.bat` runs

Order of operations (group numbers match `start.bat --help`):

1. `stage1-install-prep` -- install MSYS base packages into `msys64-stage1`
   (`installMsys2Base`, then `installMsys2AllPackages()` in `install-stages.ts`
   using `msys64/msys.txt`)
2. `stage1-extract` -- extract `msys64-stage1` from archive (default after install prep)
3. `stage1-generate-deps-json` and `stage1-generate-package-lists` -- refresh
   `deps.json` and the stage package lists
4. Stage1 runtime builds: `stage1-rt-origin-download`,
   `stage1-rt-origin-install`, `stage1-rt-hook-list-build`,
   `stage1-rt-hook-install`, `stage1-core-list-build`
5. `stage1-list-build` -- runs `scripts/sh/stage1-init.sh` then builds the
   stage1 package list (`stage1-list.txt`)
6. `stage2-install-prep` -- install stage1-built packages into `msys64-stage2`
7. `stage2-extract` and `stage2-deps-check` -- extract `msys64-stage2` and
   check `/usr` cygwin DLL dependencies
8. `stage2-cross-rust` -- build cross `rust` (`stage2-cross-rust-list.txt`;
   `rebaseall -p` runs after each `rust` package in any list step)
9. Stage2 package lists: `stage2-list-build` (lists `gcc`, native `rust`,
   `cargo-c`, `texinfo`, and `libxml2` first in `stage2-list.txt`; see
   `generate-package-lists.ts` for why), `stage2-conflict`, `stage2-cross-clang`
   (runs `cross-clang-setup.sh` / `cross-clang-finalize.sh` via
   `runBuildPackageList`)
10. `stage3-install-prep` -- install stage1/stage2 packages into `msys64-stage3`
    and create the stage3 archive (next step is `stage3-deps-check`; extract is
    optional)
11. `stage3-extract` and `stage3-deps-check` (extract `msys64-stage3` and check
    `/usr` cygwin DLL dependencies), then `stage3-mingw64-prep` (extract
    `msys64-stage3-mingw64` from the stage3 archive), `stage3-mingw64-install`
    (write `scripts/generated/msys-mingw64.txt` and install the mingw-w64 pacman
    package set), `stage3-mingw64-list-build` (build `ports-mingw` packages into
    `dist/stage3-mingw64/`), `stage3-mingw64-list-install` (install built packages
    from the install list), and `stage3-mingw64-archive` (archive the mingw tree).
    `stage3-mingw64-extract` is optional (revert the mingw tree from archive).
12. `stage-all-finished`

Cross-clang packages (`packages_cross_clang`) are built in `stage2-cross-clang`
with a temporary toolchain swap (`scripts/sh/cross-clang-setup.sh` and
`cross-clang-finalize.sh`, run by `runBuildPackageList` from
`BUILD_PACKAGE_LIST_STAGE_CONFIG`); cross rust (`packages_cross_rust`, currently
just `rust`) is built in `stage2-cross-rust`; native `rust`, `gcc`, `cargo-c`,
`texinfo`, and `libxml2` are built from `stage2-list-build` (`stage2-list.txt`
lists them first; `package-build-pipeline.ts` runs `rebaseall -p` after each
`rust` package in any list step, including `stage2-cross-rust` and
`stage2-list-build`). Conflict packages (for example `uutils-coreutils`) are built in
`stage2-conflict` and not installed into the live msys64 or stage prep trees.

## stage1-core-list.txt build order

`scripts/generated/stage1-core-list.txt` is a **fixed-order** list written by
`generate-package-lists.ts` from `stage1_core_packages` in
`scripts/build-config.ts`. Step `stage1-core-list-build` runs it with
`MSYS_BOOTSTRAP_STAGE=stage1-core`; built packages go under `dist/stage1-core/`.

The order matches the old `scripts/sh/stage0.sh` bootstrap sequence (see commit
`ff3989846`). Do not reorder entries without updating the matching
`build-install/*-prepare.sh` scripts and `scripts/sh/stage1-init.sh`.

| # | Package | Dependency notes |
|---|---------|------------------|
| 1 | `msys2-runtime` | Independent of `libtool` |
| 2 | `libtool` | Independent of `msys2-runtime` |
| 3 | `libiconv` | Depends on runtime + libtool (`build-install/libiconv-prepare.sh` installs prior `dist/stage1-core` artifacts) |
| 4 | `gcc` | Depends on libiconv (`build-install/gcc-prepare.sh` extracts runtime + libiconv from `dist/stage1-core`) |
| 5 | `binutils` | Independent of `gcc` build order |
| 6 | `cmake` | After core toolchain |
| 7 | `meson` | After core toolchain |
| 8 | `scons` | After core toolchain |

Related fixed lists:

- `scripts/generated/stage1-rt-hook-list.txt` -- only `msys2-runtime` (hook-patched
  runtime for `stage1-rt-hook-list-build`)

Origin `msys2-runtime` packages are downloaded in `stage1-rt-origin-download`
into `dist-pkg/`, not built from a package list.

The `stage3-mingw64` ports list is fixed in `stage3_mingw64_build_packages` in
`scripts/build-config.ts` (currently `mingw-w64-libepoxy`) and written to
`scripts/generated/stage3-mingw64-list.txt` by `generate-package-lists.ts`. Edit
the array in `build-config.ts` to change which `ports-mingw` packages are built.

Log: `scripts/logs/stage1-core-list-build.txt`

## Resume with `--from`

```bat
start.bat --from stage1-install-prep
start.bat --from stage1-extract
start.bat --from stage1-generate-deps-json
start.bat --from stage2-install-prep
start.bat --from stage2-cross-rust
start.bat --from stage2-list-build
start.bat --from stage3-install-prep
start.bat --from stage3-mingw64-list-build
```

Group numbers also work and start at the first step in that group:

```bat
start.bat --from 4
start.bat --from 8
start.bat --from 11
```

Run `start.bat --help` for the full step list.

## Resume a package list mid-build

For package-list steps, append `,<port-dir>` to `--from`:

```bat
start.bat --from stage1-core-list-build,gcc --only
start.bat --from stage1-list-build,perl --only
start.bat --from stage2-list-build,rust --only
start.bat --from stage3-mingw64-list-build,mingw-w64-libepoxy --only
```

`<port-dir>` is the ports directory name (e.g. `gcc`, `perl`). Earlier packages
in that list are skipped. With `--only`, only that one package is built from the
list. Without `--only`, building continues through the rest of the list (and
later pipeline steps). For package-list steps, the install list is not cleared
when resuming with `,<port-dir>`.

`--no-extract` sets `MSYS_BUILD_NO_EXTRACT` on the build stage so `makepkg` runs
with `--noextract` (useful for re-running a build without re-extracting the
source).

## Manual resume points

Use these only if you need to run one command outside `start.bat`.

### Stage1 install prep only

```bat
start.bat --from stage1-install-prep
```

### Stage1 extract only

Requires `stage1-install-prep` to have finished.

```bat
start.bat --from stage1-extract
```

Or extract from `%CI_TOOLS_ROOT%\msys64-stage1` with `delete-msys64.bat` and
`extract.bat`.

### Stage1 generate only (deps + stage lists)

Requires `stage1-install-prep` and `stage1-extract` to have finished.

```bat
start.bat --from stage1-generate-deps-json
start.bat --from stage1-generate-package-lists --only
```

### Stage1 runtime builds and package list

Group 4 (runtime builds) and group 5 (stage1 list):

```bat
start.bat --from 4
start.bat --from stage1-rt-origin-download
start.bat --from stage1-rt-hook-list-build
start.bat --from stage1-core-list-build
start.bat --from stage1-list-build
```

Logs: `scripts/logs/stage1-rt-origin-download.txt`,
`scripts/logs/stage1-rt-hook-list-build.txt`,
`scripts/logs/stage1-core-list-build.txt`, `scripts/logs/stage1-list-build.txt`

### Stage2 prep only

```bat
start.bat --from stage2-install-prep
```

Check `scripts/logs/stage2-install-prep.txt` for pacman errors before continuing.

### Stage2 cross rust and package lists only

Run the individual stage2 build steps with `start.bat --from <step> --only`.
`stage2-cross-rust` builds cross `rust` (`rebaseall -p` runs after the `rust`
package). `stage2-list-build` builds `gcc`, native `rust`, `cargo-c`,
`texinfo`, and `libxml2` first (see `stage2-list.txt`), then the rest of the
list; `rebaseall -p -b 0x400000000` runs automatically after each `rust` package
in any list step (see [`rebaseall` troubleshooting](#why-rebaseall--p-failed)):

```bat
start.bat --from stage2-cross-rust --only
start.bat --from stage2-list-build,gcc --only
start.bat --from stage2-list-build,rust --only
start.bat --from stage2-list-build,cargo-c --only
start.bat --from stage2-list-build --only
start.bat --from stage2-conflict --only
start.bat --from stage2-cross-clang --only
```

Drop `--only` to continue through the rest of the pipeline after the chosen step.

### Stage3 prep only

```bat
start.bat --from stage3-install-prep
start.bat --from stage3-extract
start.bat --from stage3-deps-check
```

### Stage3 mingw only (prep + ports-mingw build + install)

Requires `stage3-install-prep` to have finished (creates the stage3 archive
under `%CI_TOOLS_ROOT%\msys64-stage3`). Run `stage3-deps-check` on the cygwin
tree before mingw prep. `stage3-mingw64-prep` extracts
`%CI_TOOLS_ROOT%\msys64-stage3-mingw64` from the stage3 archive;
`stage3-mingw64-install` writes `scripts/generated/msys-mingw64.txt` and installs
the mingw-w64 pacman package set; `stage3-mingw64-list-build` builds the
`ports-mingw` packages listed in `stage3_mingw64_build_packages`
(`scripts/build-config.ts`) into `dist/stage3-mingw64/`;
`stage3-mingw64-list-install` installs those built packages into the live mingw
tree; `stage3-mingw64-archive` archives the tree. `stage3-mingw64-extract` is
optional (revert the mingw tree from archive).

```bat
start.bat --from stage3-mingw64-prep
start.bat --from stage3-mingw64-install
start.bat --from stage3-mingw64-list-build
start.bat --from stage3-mingw64-list-build,mingw-w64-libepoxy --only
start.bat --from stage3-mingw64-list-install
start.bat --from stage3-mingw64-archive
start.bat --from stage3-mingw64-extract
```

## Why `rebaseall -p` failed

### `Invalid Baseaddress 0x70000000, must be > 0x200000000`

Root cause:

- `rebaseall` clears `MSYSTEM` so it scans all of `/usr/bin` and `/usr/lib`.
- With `MSYSTEM` cleared, `uname -s` is `MINGW64_NT-...`, so the default base
  stays at legacy `0x70000000`.
- Current 64-bit `rebase` rejects that base.

Fix: pass `-b 0x400000000` explicitly (the pipeline already does this in
`scripts/msys2-rebaseall.ts`).

### `Too many DLLs for available address space`

Root cause:

- Keeping `MSYSTEM=CYGWIN` makes `rebaseall` use the Cygwin package-list path.
  This bootstrap tree has no `/etc/setup`, so only a small addon-DLL list is
  rebased while `/etc/rebase.db.x86_64` still tracks the full tree from an
  earlier mingw-path run.
- Database-mode rebase then runs out of address space.

Fix:

- Clear `MSYSTEM` for the full `/usr/bin` + `/usr/lib` scan.
- Pass `-b 0x400000000`.
- Remove `/etc/rebase.db.x86_64` before and after `rebaseall -p`.

Other things that can still break rebase:

1. **Stage2 tree unhealthy** - pacman `dofork` errors during `stage2-install-prep`
   mean the Cygwin layer may already be broken.
2. **IDE terminal PATH** - prefer a plain Command Prompt, but the errors above
   are not caused by Cursor being on `PATH`.

## Rebaseall recovery steps

1. Close other MSYS/Cygwin/Git-Bash terminals and IDE terminals using MSYS.
2. Open a normal Command Prompt, not Cursor integrated terminal.
3. Make sure only stage2 MSYS tools are first on `PATH`:

   ```bat
   set CI_TOOLS_ROOT=D:\CI-Tools
   set PATH=%CI_TOOLS_ROOT%\msys64-stage2;%CI_TOOLS_ROOT%\msys64-stage2\msys64\usr\bin;%PATH%
   ```

4. Retry rebaseall by re-running the stage2 list build at the `rust` package
   (`runBuildPackageList` removes `/etc/rebase.db.x86_64` before and after and
   runs `rebaseall -p -b 0x400000000` with `MSYS`/`MSYSTEM` cleared, calling
   `dash` directly):

   ```bat
   start.bat --from stage2-list-build,rust --only
   ```

5. If pacman still reports `dofork` errors, rebuild stage2 from prep instead
   of continuing in the broken tree:

   ```bat
   start.bat --from stage2-install-prep
   ```

6. If rebase still fails, inspect which DLL still has the old base:

   ```bat
   "%CI_TOOLS_ROOT%\msys64-stage2\msys64\usr\bin\bash.exe" --login -c "rebase -i /usr/bin/*.dll"
   ```

   Look for entries still using `0x70000000` and rebase them above
   `0x200000000`.

## Update folder modification times

[scripts/update-folder-times.ts](scripts/update-folder-times.ts) walks a
directory tree recursively. For each folder, if it contains at least one direct
file, sets that folder `mtime` to the newest **direct file** `mtime` in that
folder only. Subfolder times are not used when updating a parent folder.
Directories with no direct files are left unchanged.

```bat
node scripts\update-folder-times.ts scripts\logs
node scripts\update-folder-times.ts D:\path\to\folder
```

Run `node scripts\update-folder-times.ts --help` for usage.
