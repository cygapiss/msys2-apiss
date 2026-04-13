:: Do not open in vscode terminimal, vscode may call msys64 bash, that may affect
:: the effect of :rebaseall_msys64_stage2_p

if not defined CI_TOOLS_ROOT (
  set CI_TOOLS_ROOT=D:\CI-Tools
)
echo "CI_TOOLS_ROOT is: %CI_TOOLS_ROOT%"

cd /d %~dp0
setlocal
set "PATH_OLD=%PATH%"

set MSYS=winsymlinks:native
set MSYSTEM=CYGWIN
set CHERE_INVOKING=1

set "MSYS_RUNTIME_PACKAGES_INIT="
set "MSYS_RUNTIME_PACKAGES_INIT=%MSYS_RUNTIME_PACKAGES_INIT% ./dist-pkg/libiconv-devel-$LIBICONV_PKGVER-1-x86_64.pkg.tar.zst"
set "MSYS_RUNTIME_PACKAGES_INIT=%MSYS_RUNTIME_PACKAGES_INIT% ./dist-pkg/libiconv-$LIBICONV_PKGVER-1-x86_64.pkg.tar.zst"

set "MSYS_RUNTIME_PACKAGES_INIT=%MSYS_RUNTIME_PACKAGES_INIT% ./dist-pkg/libltdl-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst"
set "MSYS_RUNTIME_PACKAGES_INIT=%MSYS_RUNTIME_PACKAGES_INIT% ./dist-pkg/libtool-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst"
set "MSYS_RUNTIME_PACKAGES_INIT=%MSYS_RUNTIME_PACKAGES_INIT% ./dist-pkg/tcl-8.6.12-3-x86_64.pkg.tar.zst"

::set "MSYS_STAGE2_BASIC_EXPORTS=export MSYS_BOOTSTRAP_STAGE=stage2; export MSYS_BUILD_PKGSUMS=enabled"
::set "MSYS_STAGE2_BASIC_EXPORTS=export MSYS_BOOTSTRAP_STAGE=stage2; export MSYS_BUILD_NO_EXTRACT=enabled"
set "MSYS_STAGE2_BASIC_EXPORTS=export MSYS_BOOTSTRAP_STAGE=stage2"

goto :build_stage_all_with_prepare

goto :build_stage_all_with_prepare
goto :build_stage_all_with_extract
goto :build_stage_all
goto :build_stage0_with_extract
goto :build_stage0
goto :build_stage1_with_extract
goto :build_stage1
goto :build_stage2_with_prepare
goto :build_stage2_with_extract
goto :build_stage2_rust_native
goto :build_stage2
goto :build_stage3

:build_stage_all_with_prepare
echo "Preparing msys64 for stage0 by install all packages msys repo"
node install-for-stage0.mjs > install-for-stage0.txt 2>&1
goto :build_stage_all_with_extract_direct

:build_stage_all_with_extract
goto :build_stage_all_with_extract_direct

:build_stage_all_with_extract_direct
call :init_msys64_stage0
call :extract_msys64
goto :build_stage_all_direct

:build_stage_all
call :init_msys64_stage0
goto :build_stage_all_direct

:build_stage_all_direct
echo "Building original and hook patched msys2-runtime"
call :install_msys2_original_runtime
powershell -NoProfile -Command "echo '' > build-stage-hook.txt; (Get-Item 'build-stage-hook.txt').CreationTime = Get-Date"
bash --login -c "source build-stage-hook.sh >build-stage-hook.txt 2>&1"
goto :build_stage0_direct

:build_stage0_with_extract
call :init_msys64_stage0
call :extract_msys64
goto :build_stage0_direct

:build_stage0
call :init_msys64_stage0
goto :build_stage0_direct

:build_stage0_direct
call :init_msys64_stage0
call :install_msys2_hook_runtime
powershell -NoProfile -Command "echo '' > build-stage0.txt; (Get-Item 'build-stage0.txt').CreationTime = Get-Date"
bash --login -c "source build-stage0.sh >build-stage0.txt 2>&1"
goto :build_stage1_direct

:build_stage1_with_extract
call :init_msys64_stage0
call :extract_msys64
call :install_msys2_hook_runtime
goto :build_stage1_direct

:build_stage1
call :init_msys64_stage0
call :install_msys2_hook_runtime
goto :build_stage1_direct

:build_stage1_direct
powershell -NoProfile -Command "echo '' > build-stage1.txt; (Get-Item 'build-stage1.txt').CreationTime = Get-Date"
bash --login -c "source build-stage1.sh >build-stage1.txt 2>&1"
goto :build_stage2_with_prepare

:build_stage2_with_prepare
call :init_msys64_stage2
echo "Preparing msys64 for stage2 by install packages built by stage1"
node install-for-stage2.mjs > install-for-stage2.txt 2>&1
goto :build_stage2_direct

:build_stage2_with_extract
call :init_msys64_stage2
call :extract_msys64
goto :build_stage2_direct

:build_stage2
call :init_msys64_stage2
goto :build_stage2_direct

:build_stage2_direct
goto :build_stage2_gcc

:build_stage2_gcc
echo "Building gcc bootstrap for stage2"
bash --login -c "%MSYS_STAGE2_BASIC_EXPORTS%; source build-check-bootstrap.sh; sh build-single.sh gcc >build-stage2-gcc.txt 2>&1"
goto :build_stage2_rust_cross

:build_stage2_rust_cross
echo "Building rust cross for stage2"
set "BUILD_RUST_CROSS_BOOOTSTRAP_ENVS=export MSYS_BOOTSTRAP_RUST=enabled; export MSYS_BOOTSTRAP_DISABLE_COPY_PACKAGES=enabled; export MSYS_BOOTSTRAP_PACKAGE_NAME_SUFFIX=cross; %MSYS_STAGE2_BASIC_EXPORTS%"
bash --login -c "%BUILD_RUST_CROSS_BOOOTSTRAP_ENVS%; source build-check-bootstrap.sh; sh build-single.sh rust >build-stage2-rust-cross.txt 2>&1"
goto :build_stage2_rust_native_direct

:build_stage2_rust_native
call :init_msys64_stage2
goto :build_stage2_rust_native_direct

:build_stage2_rust_native_direct
call :rebaseall_msys64_stage2_p
echo "Building rust native before rebaseall list for stage2"
bash --login -c "%MSYS_STAGE2_BASIC_EXPORTS%; source build-check-bootstrap.sh; sh build-single.sh rust >build-stage2-rust-native.txt 2>&1"
call :rebaseall_msys64_stage2_p
goto :build_stage_cargo

:build_stage_cargo
echo "Building the cargo by native"
bash --login -c "%MSYS_STAGE2_BASIC_EXPORTS%; source build-check-bootstrap.sh; sh build-single.sh cargo-c >build-stage2-cargo-native.txt 2>&1"
goto :build_stage2_rest

:build_stage2_rest
echo "Building the rest packages"
powershell -NoProfile -Command "echo '' > build-stage2.txt; (Get-Item 'build-stage2.txt').CreationTime = Get-Date"
bash --login -c "%MSYS_STAGE2_BASIC_EXPORTS%; source build-check-bootstrap.sh; sh build-stage2-list.sh >build-stage2.txt 2>&1"
bash --login -c "%MSYS_STAGE2_BASIC_EXPORTS%; source build-check-bootstrap.sh; sh build-stage2-list-extra.sh >build-stage2-list-extra.txt 2>&1"
goto :build_stage3

:build_stage3
echo "Preparing msys64 for stage3 by install packages built by stage1 and stage2"
call :init_msys64_stage3
node install-for-stage3.mjs > install-for-stage3.txt 2>&1
call :extract_msys64
node install-mingw-for-stage3.mjs > install-mingw-for-stage3.mjs.txt 2>&1

goto :build_finished

:build_finished
endlocal
pause
exit /B 0

:extract_msys64
set CI_TOOLS_DISABLE_PAUSE=true
pushd
call delete-msys64.bat
call extract.bat
popd
exit /B 0

:install_msys2_original_runtime
set "MSYS_RUNTIME_PACKAGES="
set "MSYS_RUNTIME_PACKAGES=%MSYS_RUNTIME_PACKAGES% ./dist-pkg/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_PKGREL-x86_64.pkg.tar.zst"
set "MSYS_RUNTIME_PACKAGES=%MSYS_RUNTIME_PACKAGES% ./dist-pkg/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_PKGREL-x86_64.pkg.tar.zst"
bash --login -c "source build-check-bootstrap.sh; pacman -U --noconfirm --overwrite \* %MSYS_RUNTIME_PACKAGES%"
bash --login -c "source build-check-bootstrap.sh; pacman -U --noconfirm --overwrite \* %MSYS_RUNTIME_PACKAGES_INIT%"
exit /B 0

:install_msys2_hook_runtime
:: msys2-runtime-$MSYS_RUNTIME_PKGVER-5 should be installed first as it's contains hook patch need to installed first.
set "MSYS_RUNTIME_PACKAGES="
set "MSYS_RUNTIME_PACKAGES=%MSYS_RUNTIME_PACKAGES% ./dist/init/msys2-runtime-$MSYS_RUNTIME_PKGVER-5-x86_64.pkg.tar.zst"
set "MSYS_RUNTIME_PACKAGES=%MSYS_RUNTIME_PACKAGES% ./dist/init/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-5-x86_64.pkg.tar.zst"
bash --login -c "source build-check-bootstrap.sh; pacman -U --noconfirm --overwrite \* %MSYS_RUNTIME_PACKAGES%"
bash --login -c "source build-check-bootstrap.sh; pacman -U --noconfirm --overwrite \* %MSYS_RUNTIME_PACKAGES_INIT%"
exit /B 0

:init_msys64_stage0
set "PATH=%CI_TOOLS_ROOT%\msys64-stage0;%CI_TOOLS_ROOT%\msys64-stage0\msys64\usr\bin;%PATH_OLD%"
@echo "The stage0 PATH is:%PATH%"
exit /B 0

:init_msys64_stage2
set "PATH=%CI_TOOLS_ROOT%\msys64-stage2;%CI_TOOLS_ROOT%\msys64-stage2\msys64\usr\bin;%PATH_OLD%"
@echo "The stage2 PATH is:%PATH%"
exit /B 0

:init_msys64_stage3
set "PATH=%CI_TOOLS_ROOT%\msys64-stage3;%CI_TOOLS_ROOT%\msys64-stage3\msys64\usr\bin;%PATH_OLD%"
@echo "The stage3 PATH is:%PATH%"
exit /B 0

:rebaseall_msys64_stage2_p
:: The rebaseall command (often from Cygwin's autorebase) doesn't store results in a typical user-facing file;
:: instead, it modifies the in-memory image of system DLLs and updates the Windows Registry
:: (specifically HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs) to point to new DLL locations,
:: effectively rebasing system libraries to free up address space,
:: with temporary files sometimes appearing in C:\Windows\System32 during the process.
echo "stage2: Do rebaseall -p for rust native"
setlocal
set MSYS=
set MSYSTEM=
set CHERE_INVOKING=
dash /usr/bin/rebaseall -p
bash --login -c "rm -rf /etc/rebase.db.x86_64"
endlocal
exit /B 0
