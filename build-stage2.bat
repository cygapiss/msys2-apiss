:: sh build-single.sh rust

set MSYS=winsymlinks:native
set MSYSTEM=CYGWIN
set CHERE_INVOKING=1

bash --login -c "rm -rf /etc/rebase.db.x86_64"
bash --login -c "rm -rf /var/lib/pacman/db.lck"

bash --login -c "MSYS_BUILD_WITH_CLEAN=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh gcc >build-stage2-gcc.txt 2>&1"

bash --login -c "MSYS_BUILD_WITH_CLEAN=enabled MSYS_BUILD_PKGSUMS=enabled MSYS_BOOTSTRAP_RUST=enabled sh build-single.sh rust >build-stage2-rust0.txt 2>&1"

bash --login -c "rm -rf /etc/rebase.db.x86_64"
dash /usr/bin/rebaseall -p

bash --login -c "MSYS_BUILD_WITH_CLEAN=enabled MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh rust >build-stage2-rust2.txt 2>&1"
:: goto :eof
bash --login -c "rm -rf /etc/rebase.db.x86_64"
bash --login -c "MSYS_BUILD_WITH_CLEAN=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh cargo-c"

bash --login -c "sh msys-stage2-list.sh >build-stage2.txt 2>&1"

