# Do not install python
echo "Do not install ${new_dir}"

tar xf ${new_dir}-tmp-full.tar -C /
tar xf ${pkg_root_dir}/dist-init/python-3.12.12-3-x86_64.pkg.tar.zst -C /
