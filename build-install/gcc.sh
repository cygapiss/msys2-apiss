
if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
    echo "Install gcc for stage1"
    cp -arf ${pkg_root_dir}/dist/gcc-15.2.0-2-x86_64.pkg.tar.zst ${pkg_root_dir}/dist-init/gcc-15.2.0-2-x86_64-stage1.pkg.tar.zst
else
    echo "Do not install gcc"
fi
