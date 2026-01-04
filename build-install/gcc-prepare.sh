
if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
    echo "Building gcc as stage 1(depends on cygwin)"
    rm -rf ${pkg_root_dir}/ports/gcc/base
    mkdir -p ${pkg_root_dir}/ports/gcc/base/
    cp ${pkg_root_dir}/dist-init/gcc-15.2.0-2-x86_64-stage0.pkg.tar.zst ${pkg_root_dir}/ports/gcc/base/
    cp ${pkg_root_dir}/dist-init/gcc-libs-15.2.0-2-x86_64-stage0.pkg.tar.zst ${pkg_root_dir}/ports/gcc/base/
    cp ${pkg_root_dir}/build-install/gcc-install.sh ${pkg_root_dir}/ports/gcc/base/
else
    echo "Building gcc as stage 2"
fi
