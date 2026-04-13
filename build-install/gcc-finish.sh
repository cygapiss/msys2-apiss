if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
    echo "Finish building of gcc as $MSYS_BOOTSTRAP_STAGE, reovert the msys2-runtime-hook and libiconv first"
    pushd ${pkg_root_dir}
    tar xf ./dist/init/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-5-x86_64.pkg.tar.zst -C / usr/lib
    tar xf ./dist-pkg/libiconv-devel-$LIBICONV_PKGVER-1-x86_64.pkg.tar.zst -C /
    popd
fi
