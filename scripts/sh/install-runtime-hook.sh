#!/bin/bash
set -e

source scripts/sh/check-bootstrap.sh

hook_dist_dir="${1:-./dist/stage1-rt-hook}"
pacman -U --noconfirm --overwrite \* \
  "${hook_dist_dir}/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_HOOK_PKGREL-x86_64.pkg.tar.zst" \
  "${hook_dist_dir}/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_HOOK_PKGREL-x86_64.pkg.tar.zst"
