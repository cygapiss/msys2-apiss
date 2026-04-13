if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
    echo "Install perl-bootstrap package."
    pacman -U --noconfirm --overwrite \* ${pkg_root_dir}/dist/stage1/perl-$PERL_PKGVER-$PERL_PKGREL-x86_64.pkg.tar.zst
fi
