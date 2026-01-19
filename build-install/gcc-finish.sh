if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
    echo "Finish building of gcc as $MSYS_BOOTSTRAP_STAGE"
    tar xf ${pkg_root_dir}/dist-init/msys2-runtime-devel-3.6.6-2-x86_64.pkg.tar.zst -C / usr/lib
fi
