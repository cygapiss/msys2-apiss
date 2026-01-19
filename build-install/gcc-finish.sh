if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
    echo "Finish building of gcc as $MSYS_BOOTSTRAP_STAGE"
    pushd ${pkg_root_dir}/dist-init
    tar xf ./msys2-runtime-devel-3.6.6-2-x86_64.pkg.tar.zst -C / usr/lib
    tar xf ./libiconv-devel-1.18-2-x86_64.pkg.tar.zst -C / usr/lib
    popd
fi
