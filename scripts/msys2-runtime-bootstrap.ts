import { type RunContext } from "./run-context.ts";
import { runMsys2ScriptPath, type Msys2Stage } from "./utils.ts";

const runtimePackagesInit = [
  "./dist-pkg/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/perl-$PERL_PKGVER-$PERL_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/libiconv-devel-$LIBICONV_PKGVER-$LIBICONV_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/libiconv-$LIBICONV_PKGVER-$LIBICONV_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/libltdl-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/libtool-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/cmake-$CMAKE_PKGVER-$CMAKE_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/meson-$MESON_PKGVER-$MESON_PKGREL-any.pkg.tar.zst",
  "./dist-pkg/scons-$SCONS_PKGVER-$SCONS_PKGREL-any.pkg.tar.zst",
  "./dist-pkg/binutils-$BINUTILS_PKGVER-$BINUTILS_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/gcc-libs-$GCC_PKGVER-$GCC_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/gcc-$GCC_PKGVER-$GCC_PKGREL-x86_64.pkg.tar.zst",
  "./dist-pkg/tcl-$TCL_PKGVER-$TCL_PKGREL-x86_64.pkg.tar.zst",
].join(" ");

export async function downloadRuntimePackagesInit(
  step: RunContext,
  stage: Msys2Stage,
) {
  await runMsys2ScriptPath(step, stage, {
    script: "scripts/sh/download-runtime-init.sh",
    env: {
      ...stage.env,
      MSYS_RUNTIME_PACKAGES_INIT: runtimePackagesInit,
    },
  });
}

export async function installMsys2OriginalRuntime(
  step: RunContext,
  stage: Msys2Stage,
) {
  await runMsys2ScriptPath(step, stage, {
    script: "scripts/sh/install-runtime-init.sh",
    env: {
      ...stage.env,
      MSYS_RUNTIME_PACKAGES_INIT: runtimePackagesInit,
    },
  });
}

export async function installMsys2HookRuntime(
  step: RunContext,
  stage: Msys2Stage,
  hookDistDir = "./dist/stage1-rt-hook",
) {
  await runMsys2ScriptPath(step, stage, {
    script: "scripts/sh/install-runtime-hook.sh",
    scriptArgs: [hookDistDir],
    env: stage.env,
  });
}
