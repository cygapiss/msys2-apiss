#!/bin/bash

export MSYS_BOOTSTRAP_STAGE=stage1
# export MSYS_BOOTSTRAP_STAGE=cleanup
if [[ "$MSYS_BOOTSTRAP_STAGE" == "cleanup" ]]; then
    echo "Do cleanup, do not init"
else
    sh bootstrap-init-stage1.sh
fi

sh msys-base-devel-list.sh

do_other() {
    sh ./build-base-devel.sh >out.txt 2>&1

    Clean dll and exe: '.+'
    sh ./build-all.sh >build-all.txt 2>&1

    pacman -Sl msys  >msys.txt

    sh build-single.sh nano
    sh build-single.sh gnupg

    MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh jsoncpp
    MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh jsoncpp
    MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gnupg >gnupg.txt 2>&1
    MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled sh build-single.sh gnupg >gnupg.txt 2>&1
    MSYS_BUILD_PKGSUMS=enabled MSYS_BUILD_WITH_CLEAN=enabled MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gcc >gcc.txt 2>&1
    MSYS_BOOTSTRAP_STAGE=stage1 sh build-single.sh gcc >gcc.txt 2>&1
    MSYS_BOOTSTRAP_STAGE=stage1 makepkg -R
    repack with force
    MSYS_BOOTSTRAP_STAGE=stage1 makepkg -R -f

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

