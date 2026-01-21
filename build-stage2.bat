:: sh build-single.sh rust


bash --login -c "rm -rf /etc/rebase.db.x86_64"
:: bash --login -c "rm -rf /var/lib/pacman/db.lck"

::bash --login -c "pacman -S --noconfirm --overwrite \* mingw-w64-x86_64-python mingw-w64-x86_64-llvm mingw-w64-x86_64-clang"

touch build-cache\stage2\gcc-stage2-build-finished.build
bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh gcc >build-stage2-gcc.txt 2>&1"

touch build-cache\stage2\rust-stage2-build-finished.build
cp -arf dist-rust/rust-1.92.0-3-x86_64.pkg.tar.zst ports/rust
bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled MSYS_BOOTSTRAP_RUST=enabled sh build-single.sh rust >build-stage2-rust0.txt 2>&1"
cp -arf ports/rust/rust-1.92.0-3-x86_64.pkg.tar.zst dist-rust/

:: The rebaseall command (often from Cygwin's autorebase) doesn't store results in a typical user-facing file; 
:: instead, it modifies the in-memory image of system DLLs and updates the Windows Registry
:: (specifically HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs) to point to new DLL locations,
:: effectively rebasing system libraries to free up address space,
:: with temporary files sometimes appearing in C:\Windows\System32 during the process. 

set MSYS=
set MSYSTEM=
set CHERE_INVOKING=
dash /usr/bin/rebaseall -p
bash --login -c "rm -rf /etc/rebase.db.x86_64"
set MSYS=winsymlinks:native
set MSYSTEM=CYGWIN
set CHERE_INVOKING=1

rm build-cache\stage2\rust-stage2-build-finished.build
bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh rust >build-stage2-rust2.txt 2>&1"

:: goto :eof
:: bash --login -c "rm -rf /etc/rebase.db.x86_64"

:cargo
::bash --login -c "MSYS_BUILD_WITH_CLEAN=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh cargo-c"
::bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh cargo-c"
bash --login -c "MSYS_BUILD_PKGSUMS=enabled sh build-single.sh cargo-c"

::bash --login -c "sh msys-stage2-list.sh >build-stage2.txt 2>&1"

