# The perl have dll names that not prefixed with cyg
echo "Custom install ${new_dir}"

tar xf ${new_dir}-tmp-full.tar -C /
tar xf ${pkg_root_dir}/dist-init/perl-5.40.3-1-x86_64.pkg.tar.zst -C /
