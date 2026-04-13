if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
    echo "Restore perl package but keep the perl-devel-bootstrap package"
    pacman -U --noconfirm --overwrite \* ${pkg_root_dir}/dist-pkg/perl-$PERL_PKGVER-$PERL_PKGREL-x86_64.pkg.tar.zst
    tar xf ${pkg_root_dir}/ports/perl/perl-tmp.tar -C /
    cp -arf /usr/bin/cygperl5_42_2.dll /usr/lib/perl5/core_perl/CORE
fi
