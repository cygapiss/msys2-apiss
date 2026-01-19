if [[ "$MSYS_IN_PKGBUILD" == "enabled" ]]; then
    echo "Under MSYS_IN_PKGBUILD, building gcc as stage: $MSYS_BOOTSTRAP_STAGE pkg_root_dir:$pkg_root_dir"
    if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
        pushd ${pkg_root_dir}/dist-init/
        # Then gcc-libs linkage to cygwin msys2-runtime and libiconv
        # msys2-runtime
        tar xf ./msys2-runtime-3.6.6-3-x86_64.pkg.tar.zst -C /
        tar xf ./msys2-runtime-devel-3.6.6-3-x86_64.pkg.tar.zst -C / usr/lib

        # libiconv
        tar xf ./libiconv-1.18-3-x86_64.pkg.tar.zst -C /
        tar xf ./libiconv-devel-1.18-3-x86_64.pkg.tar.zst -C / usr/lib
        popd
    elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
        # Combine gcc-libs into stage1 byproduct, as it's not able
        # build gcc-libs
        rm -rf ${srcdir}/dest
        mkdir -p ${srcdiBr}/dest
        pushd ${pkg_root_dir}/dist-init/
        tar xf ./gcc-15.2.0-2-x86_64.pkg.tar.zst -C ${srcdir}/dest
        tar xf ./gcc-libs-15.2.0-2-x86_64.pkg.tar.zst -C ${srcdir}/dest
        popd

        pushd ${srcdir}/dest
        rm .BUILDINFO .MTREE .PKGINFO
        popd

        cp -arf ${DESTDIR}/* ${srcdir}/dest/
    fi
else
    echo "Prepare building gcc as stage: $MSYS_BOOTSTRAP_STAGE pkg_root_dir:$pkg_root_dir"
    if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
        pushd ${pkg_root_dir}/dist-init/
        # The gcc and gcc-libs first linkage to msys
        # Install the old existing libtool for msys2 
        pacman -U --noconfirm --overwrite \* ./libltdl-2.5.4-4-x86_64.pkg.tar.zst
        pacman -U --noconfirm --overwrite \* ./libtool-2.5.4-4-x86_64.pkg.tar.zst
        tar xf ./msys2-runtime-3.6.6-2-x86_64.pkg.tar.zst -C /
        tar xf ./msys2-runtime-devel-3.6.6-2-x86_64.pkg.tar.zst -C /
        tar xf ./libiconv-devel-1.18-2-x86_64.pkg.tar.zst -C /
        popd
    fi
fi
