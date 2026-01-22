@echo off

goto :cargo

bash --login -c "rm -rf /etc/rebase.db.x86_64"
bash --login -c "rm -rf /var/lib/pacman/db.lck"

bash --login -c "pacman -S --noconfirm --overwrite \* mingw-w64-x86_64-python mingw-w64-x86_64-llvm mingw-w64-x86_64-clang"

echo "Building gcc bootstrap"
touch build-cache\stage2\gcc-stage2-build-finished.build
bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh gcc >build-stage2-gcc.txt 2>&1"

echo "Building rust by cross"
touch build-cache\stage2\rust-stage2-build-finished.build
cp -arf dist-rust/rust-1.92.0-3-x86_64-cross.pkg.tar.zst ports/rust/rust-1.92.0-3-x86_64.pkg.tar.zst
bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled MSYS_BOOTSTRAP_RUST=enabled sh build-single.sh rust >build-stage2-rust0.txt 2>&1"
cp -arf ports/rust/rust-1.92.0-3-x86_64.pkg.tar.zst dist-rust/rust-1.92.0-3-x86_64-cross.pkg.tar.zst

:: The rebaseall command (often from Cygwin's autorebase) doesn't store results in a typical user-facing file; 
:: instead, it modifies the in-memory image of system DLLs and updates the Windows Registry
:: (specifically HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs) to point to new DLL locations,
:: effectively rebasing system libraries to free up address space,
:: with temporary files sometimes appearing in C:\Windows\System32 during the process. 

echo "Do rebaseall"
set MSYS=
set MSYSTEM=
set CHERE_INVOKING=
dash /usr/bin/rebaseall -p
bash --login -c "rm -rf /etc/rebase.db.x86_64"
set MSYS=winsymlinks:native
set MSYSTEM=CYGWIN
set CHERE_INVOKING=1

echo "Building the rust by native"
if exist dist-rust/rust-1.92.0-3-x86_64.pkg.tar.zst (
  cp -arf dist-rust/rust-1.92.0-3-x86_64.pkg.tar.zst ports/rust/rust-1.92.0-3-x86_64.pkg.tar.zst
) else (
  rm -rf build-cache\stage2\rust-stage2-build-finished.build
)
bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh rust >build-stage2-rust2.txt 2>&1"
cp -arf ports/rust/rust-1.92.0-3-x86_64.pkg.tar.zst dist-rust/rust-1.92.0-3-x86_64.pkg.tar.zst

:: goto :eof
:: bash --login -c "rm -rf /etc/rebase.db.x86_64"

:cargo

set MSYS=winsymlinks:native
set MSYSTEM=CYGWIN
set CHERE_INVOKING=1
pushd dist-final
bash --login -c "pacman -U --noconfirm --overwrite \* ./rust-1.92.0-3-x86_64.pkg.tar.zst ./gcc-libs-15.2.0-2-x86_64.pkg.tar.zst ./gcc-15.2.0-2-x86_64.pkg.tar.zst"
popd

::bash --login -c "MSYS_BUILD_WITH_CLEAN=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh cargo-c"
::bash --login -c "MSYS_BUILD_NOEXTRACT=enabled MSYS_BUILD_PKGSUMS=enabled sh build-single.sh cargo-c"
echo "Building the cargo by native"
bash --login -c "MSYS_BUILD_PKGSUMS=enabled sh build-single.sh cargo-c"

echo "Building the rest packages"
bash --login -c "sh msys-stage2-list.sh >build-stage2.txt 2>&1"

