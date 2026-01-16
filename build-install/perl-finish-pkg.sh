pacman -U --noconfirm --overwrite \* ${pkg_root_dir}/dist-init/perl-5.40.3-1-x86_64.pkg.tar.zst
tar xf ${pkg_root_dir}/ports/perl/perl-tmp.tar -C /
cp -arf /usr/bin/cygperl5_40_3.dll /usr/lib/perl5/core_perl/CORE
