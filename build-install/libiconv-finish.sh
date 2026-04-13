if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
    echo "Finish building of libiconv as $MSYS_BOOTSTRAP_STAGE, recover the packages msys2-libtool and msys2-runtime."
    pushd ${pkg_root_dir}
    pacman -U --noconfirm --overwrite \* ./dist-pkg/libltdl-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst
    pacman -U --noconfirm --overwrite \* ./dist-pkg/libtool-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst
    tar xf ./dist/init/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-5-x86_64.pkg.tar.zst -C / usr/lib
    popd
fi
