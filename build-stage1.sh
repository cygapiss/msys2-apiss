#!/bin/bash
mkdir -p build-cache/stage1
export MSYS_BOOTSTRAP_STAGE=stage1
# export MSYS_CLEAN_TYPE=enabled
# export MSYS_CLEAN_TYPE=only
export MSYS_BOOTSTRAP_EXIT_ON_ERROR=enabled

source build-check-bootstrap.sh

if [[ "$MSYS_CLEAN_TYPE" == "only" ]]; then
    echo "Do cleanup only, do not init"
else
    sh bootstrap-init-stage1.sh
fi

pushd build-install
sh perl-create-syms-for-pkg.sh
popd
sh build-stage1-list.sh

do_other() {
    ./build-stage1.sh >build-stage1.txt 2>&1

    Clean dll and exe: '.+'
    sh ./build-stage2.sh >build-stage2.txt 2>&1

    sh build-single.sh nano
    sh build-single.sh gnupg

    MSYS_CLEAN_TYPE=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh jsoncpp
    MSYS_BUILD_PKGSUMS=enabled MSYS_CLEAN_TYPE=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh jsoncpp
    MSYS_BUILD_PKGSUMS=enabled MSYS_CLEAN_TYPE=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gnupg >gnupg.txt 2>&1
    MSYS_BUILD_PKGSUMS=enabled MSYS_CLEAN_TYPE=enabled sh build-single.sh gnupg >gnupg.txt 2>&1
    MSYS_BUILD_PKGSUMS=enabled MSYS_CLEAN_TYPE=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gcc >gcc.txt 2>&1
    MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gcc >gcc.txt 2>&1
    # repack
    MSYS_BOOTSTRAP_STAGE=stage1 makepkg -R
    # repack with force
    MSYS_BOOTSTRAP_STAGE=stage1 makepkg -R -f

    # repack at stage 2
    MSYS_BOOTSTRAP_STAGE= makepkg -R -f

    pacman -Syu --noconfirm --needed
    pacman -Syu --noconfirm --needed
    pacman -S ca-certificates --noconfirm --needed
    update-ca-trust

    pacman -Qq >msys.txt
    updpkgsums
    Do not extract source
    makepkg  -e -f
    makepkg --nobuild --cleanbuild
    makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck
    makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck --skippgpcheck
}

