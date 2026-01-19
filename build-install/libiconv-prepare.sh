echo "Prepare building libiconv as $MSYS_BOOTSTRAP_STAGE"
if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
    pushd ${pkg_root_dir}/dist-init/
    pacman -U --noconfirm --overwrite \* ./libltdl-2.5.4-5-x86_64.pkg.tar.zst
    pacman -U --noconfirm --overwrite \* ./libtool-2.5.4-5-x86_64.pkg.tar.zst
    tar xf ./msys2-runtime-3.6.6-3-x86_64.pkg.tar.zst -C /
    tar xf ./msys2-runtime-devel-3.6.6-3-x86_64.pkg.tar.zst -C / usr/lib
    popd
fi
