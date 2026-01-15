
if [[ "$MSYS_BOOTSTRAP_STAGE" == "" ]]; then
    echo "Do not install gcc"
else
    echo "Install gcc for ${MSYS_BOOTSTRAP_STAGE}"
    cp -arf ${pkg_root_dir}/dist/gcc-15.2.0-2-x86_64.pkg.tar.zst ${pkg_root_dir}/dist-init/gcc-15.2.0-2-x86_64-${MSYS_BOOTSTRAP_STAGE}.pkg.tar.zst
    cp -arf ${pkg_root_dir}/dist/gcc-libs-15.2.0-2-x86_64.pkg.tar.zst ${pkg_root_dir}/dist-init/gcc-libs-15.2.0-2-x86_64-${MSYS_BOOTSTRAP_STAGE}.pkg.tar.zst
fi
