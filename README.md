# msys2-apiss

> **Project status:** Early phase. The API Set compatibility work described
> below is planned but **not working yet**. Expect incomplete tooling, missing
> bootstrap paths, and upstream package trees that still behave like stock
> MSYS2/MINGW builds.

MSYS2 and MinGW package recipes intended to use the Windows API Set schema on
modern Windows and ship compatibility libraries for older releases.

This repository is derived from upstream [MSYS2-packages](https://github.com/msys2/MSYS2-packages)
and [MINGW-packages](https://github.com/msys2/MINGW-packages). It keeps the
familiar `ports/` and `ports-mingw/` layout while the runtime, toolchain, and
package changes needed for cross-release support are still being developed.

## Goals

- Maintain buildable MSYS2 (`ports/`) and MinGW-w64 (`ports-mingw/`) package
  trees from a single repository.
- Provide TypeScript tooling under `scripts/` for patch application, checks,
  and future build orchestration.

## Compatibility model

The intended design bridges newer Windows APIs and older systems in two ways:

**Windows 11 and newer:** use the system-provided API Set schema. The OS loader
resolves `api-ms-win-*` imports to the built-in DLLs that implement each API
set on that release.

**Windows 10 and older:** ship `api-ms-win-*` compatibility stub DLLs alongside
applications when an API exists on Windows 11 through the API Set schema but
is missing on the target older release. Each stub forwards to
`apiss.dll`, which implements the newer API surface so the same
binaries can run without relying on OS forwarding that those versions do not
provide.

## Repository layout

```txt
.
|-- ports/              MSYS2 package recipes (PKGBUILD, patches, sources)
|-- ports-mingw/        MinGW-w64 package recipes
|-- patches/            Local git-format patches (not tracked; see below)
|-- scripts/            TypeScript utilities and future build entry points
|-- test/               Node test runner tests and fixtures
|-- build-cache/        Cached package outputs from bootstrap builds (ignored)
|-- dist/               Built package artifacts (ignored)
`-- package.json        Node/Yarn project metadata and scripts
```

Package-specific notes remain in `ports/README.md` and `ports-mingw/README.md`.

## Prerequisites

### For TypeScript tooling

- [Node.js](https://nodejs.org/) 22 or newer (native TypeScript execution)
- [Yarn](https://yarnpkg.com/) 4 (`corepack enable` if needed)

### For building packages

- An MSYS2/Cygwin environment configured for this project (see
  [Development environment](#development-environment))
- `base-devel` for MSYS packages:

  ```bash
  pacman -S --needed base-devel
  ```

- Build tools for MinGW packages as described in `ports-mingw/README.md`

### For applying patches

- Windows Git (`git.exe` from Git for Windows)

## Getting started

Clone the repository and install JavaScript dependencies:

```bash
git clone https://github.com/msys2-apiss/msys2-apiss.git
cd msys2-apiss
yarn install
```

Run the TypeScript checks and tests:

```bash
yarn check
yarn test
```

Build script bundles with Vite (validation/output only):

```bash
yarn build
```

## Applying local patches

Place git-format patch files in `patches/` (this directory is gitignored). Use
`scripts/apply-ports-patch.ts` to apply them under `ports/` or `ports-mingw/`
with `git am`, using the commit message embedded in each patch.

Apply all patches in `patches/` (sorted by filename):

```bash
node scripts/apply-ports-patch.ts
```

Apply a single patch file:

```bash
node scripts/apply-ports-patch.ts patches/0001-example.patch
```

Apply every `*.patch` file in a directory:

```bash
node scripts/apply-ports-patch.ts patches/my-series/
```

Target `ports-mingw/` instead of `ports/`:

```bash
node scripts/apply-ports-patch.ts --ports-dir ports-mingw patches/
```

Check that patches apply without committing:

```bash
node scripts/apply-ports-patch.ts --dry-run patches/
```

Requirements:

- Clean tracked working tree (untracked files are allowed unless a patch
  touches the same path)
- No `git am` operation in progress

## Building individual packages

### MSYS packages (`ports/`)

From an MSYS shell with build tools installed:

```bash
cd ports/${package-name}
makepkg
pacman -U ${package-name}*.pkg.tar.zst
```

See `ports/README.md` for more detail.

### MinGW packages (`ports-mingw/`)

From an MSYS shell with MinGW build tools installed:

```bash
cd ports-mingw/${package-name}
MINGW_ARCH=mingw64 makepkg-mingw -sLf
pacman -U ${package-name}*.pkg.tar.zst
```

See `ports-mingw/README.md` for more detail.

## Development environment

POSIX commands (`bash`, `makepkg`, `pacman`, and similar) must run inside the
project MSYS2/Cygwin environment, not WSL or an arbitrary Windows `bash`.

When invoking Bash from PowerShell or Command Prompt, prepend the project MSYS
root and `usr/bin` to `PATH`, set `MSYS=winsymlinks:native`, `MSYSTEM=CYGWIN`,
and `CHERE_INVOKING=1`, then call the configured `bash.exe --login -i`.

Do not run bare `cmd` when MSYS `usr/bin` is on `PATH`; use `cmd.exe` or
`%COMSPEC%` if Command Prompt is required.

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/apply-ports-patch.ts` | Apply git-format patches under `ports/` or `ports-mingw/` |
| `scripts/update-folder-times.ts` | Set each folder mtime from its newest direct file |

Additional TypeScript build orchestration is planned under `scripts/`; see
`.cursor/plans/typescript-scripts-migration.md` for the migration outline.

## Testing

Tests use the Node.js built-in test runner:

```bash
yarn test
```

This runs `tsc --noEmit` first, then executes `test/*.test.ts`. Global setup
lives in `test/global-setup.ts`.

## License

The TypeScript tooling and repository metadata in this project are licensed
under the [MIT License](LICENSE).

Individual package recipes under `ports/` and `ports-mingw/` may carry their
own upstream licenses. MSYS2 package scripts upstream are commonly under the
BSD 3-Clause license; see `ports/LICENSE` and `ports-mingw/LICENSE`.

## Links

- Repository: <https://github.com/msys2-apiss/msys2-apiss>
- Issues: <https://github.com/msys2-apiss/msys2-apiss/issues>
- Upstream MSYS2: <https://www.msys2.org/>
- Upstream MSYS2 packages: <https://github.com/msys2/MSYS2-packages>
- Upstream MinGW packages: <https://github.com/msys2/MINGW-packages>
