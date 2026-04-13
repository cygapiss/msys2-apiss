echo "Prepare building libiconv as $MSYS_BOOTSTRAP_STAGE"
if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
    pushd ${pkg_root_dir}
    set -x
    # The libtool-bootstrap/msys2-runtime-bootstrap are built at stage0, so they can not be pre-installed, install it here.
    pacman -U --noconfirm --overwrite \* ./dist/init/libltdl-$LIBTOOL_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst
    pacman -U --noconfirm --overwrite \* ./dist/init/libtool-$LIBTOOL_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst
    tar xf ./dist/init/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C / usr/bin/cygwin1.dll
    tar xf ./dist/init/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C / usr/lib
    set +x
    popd
fi
