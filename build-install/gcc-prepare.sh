if [[ "$MSYS_IN_PKGBUILD" == "enabled" ]]; then
    echo "Under MSYS_IN_PKGBUILD, building gcc as stage: $MSYS_BOOTSTRAP_STAGE pkg_root_dir:$pkg_root_dir"
    if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1-core" ]]; then
        pushd ${pkg_root_dir}/
        # Then gcc-libs linkage to cygwin msys2-runtime and libiconv
        # the msys2-runtime-bootstrap and libiconv-bootstrap are built by stage1-core, so they can not be pre-installed.
        # msys2-runtime
        tar xf ./dist/stage1-core/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C / usr/bin/cygwin1.dll
        tar xf ./dist/stage1-core/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C / usr/lib

        # libiconv
        tar xf ./dist/stage1-core/libiconv-$LIBICONV_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C /
        tar xf ./dist/stage1-core/libiconv-devel-$LIBICONV_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C / usr/lib
        popd
    elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
        # Combine gcc-libs into stage1 byproduct, as it's not able
        # build gcc-libs by the newly built gcc
        rm -rf ${srcdir}/dest
        mkdir -p ${srcdir}/dest
        pushd ${pkg_root_dir}
        tar xf ./dist/stage1-core/gcc-$GCC_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C ${srcdir}/dest
        tar xf ./dist/stage1-core/gcc-libs-$GCC_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C ${srcdir}/dest
        popd

        pushd ${srcdir}/dest
        rm .BUILDINFO .MTREE .PKGINFO
        popd

        cp -arf ${DESTDIR}/* ${srcdir}/dest/
    fi
else
    echo "Prepare building gcc as stage: $MSYS_BOOTSTRAP_STAGE pkg_root_dir:$pkg_root_dir, do nothing"
fi
