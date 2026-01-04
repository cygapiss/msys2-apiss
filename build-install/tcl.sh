# The tcl have a dll libtcl8.6.dll to install.
echo "Install tcl with tcl.sh for ${new_dir}"

tar xf ${new_dir}-tmp-full.tar -C /
tar xf ${pkg_root_dir}/dist-init/tcl-8.6.12-3-x86_64.pkg.tar.zst -C /
