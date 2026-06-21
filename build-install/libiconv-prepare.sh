echo "Prepare building libiconv as $MSYS_BOOTSTRAP_STAGE"
if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1-core" ]]; then
    pushd ${pkg_root_dir}
    set -x
    # The libtool-bootstrap/msys2-runtime-bootstrap are built at stage1-core, so they can not be pre-installed, install it here.
    pacman -U --noconfirm --overwrite \* ./dist/stage1-core/libltdl-$LIBTOOL_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst
    pacman -U --noconfirm --overwrite \* ./dist/stage1-core/libtool-$LIBTOOL_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst
    tar xf ./dist/stage1-core/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C / usr/bin/cygwin1.dll
    tar xf ./dist/stage1-core/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C / usr/lib
    set +x
    popd
fi
