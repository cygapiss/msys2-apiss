:: Do not open in vscode terminimal, vscode may call msys64 bash, that may affect
:: rebaseall when MSYS/MSYSTEM are set in the parent shell.

:: Usage: build-all.bat [--only] [step]
::   --only  run one step only (step from flag value or positional arg)
::   step    optional label name (with or without build_ prefix)
::           default: build_stage1_install
::   help: build-all.bat help

@echo off
if not defined CI_TOOLS_ROOT (
  set CI_TOOLS_ROOT=D:\CI-Tools
)
echo "CI_TOOLS_ROOT is: %CI_TOOLS_ROOT%"

cd /d %~dp0
setlocal

set MSYS=winsymlinks:native
set MSYSTEM=CYGWIN
set CHERE_INVOKING=1
set "ONLY="
set "BUILD_STEP="
:parse_build_args
if "%~1"=="" goto :parse_build_args_done
if /i "%~1"=="help" goto :show_build_usage
if /i "%~1"=="-h" goto :show_build_usage
if /i "%~1"=="?" goto :show_build_usage
if /i "%~1"=="--only" goto :parse_build_only_flag
if not defined BUILD_STEP set "BUILD_STEP=%~1"
shift
goto :parse_build_args

:parse_build_only_flag
set "ONLY=1"
shift
if not "%~1"=="" if not defined BUILD_STEP set "BUILD_STEP=%~1"
if not "%~1"=="" shift
goto :parse_build_args

:parse_build_args_done
if defined ONLY if not defined BUILD_STEP goto :parse_build_only_missing
if not defined BUILD_STEP set "BUILD_STEP=build_stage1_install"
if /i not "%BUILD_STEP:~0,6%"=="build_" set "BUILD_STEP=build_%BUILD_STEP%"
set "BUILD_STEP=%BUILD_STEP:-=_%"
if defined ONLY echo Running only %BUILD_STEP%
echo Starting at :%BUILD_STEP%
goto :%BUILD_STEP%

:parse_build_only_missing
echo ERROR: --only requires a step name
exit /B 1

:extract_msys64
node scripts/cli.ts kill-stage-processes %~1
if errorlevel 1 exit /B 1
set CI_TOOLS_DISABLE_PAUSE=true
pushd "%CI_TOOLS_ROOT%\msys64-%~1"
echo Extracting msys64 in %CD% ...
call extract.bat
if errorlevel 1 (
  popd
  exit /B 1
)
echo Extracting msys64 in %CD% done
popd
exit /B 0

:show_build_usage
@echo off
echo Usage: %~nx0 [--only] [step]
echo   --only  run one step only
echo   step    build_stage1_install ^(default^)
echo         build_stage1_hook_with_extract
echo         build_stage1_init
echo         build_stage1_hook_direct
echo         build_stage1_core_with_extract
echo         build_stage1_core
echo         build_stage1_with_extract
echo         build_stage1
echo         build_stage1_direct
echo         build_stage2_with_prepare
echo         build_stage2_with_extract
echo         build_stage2
echo         build_stage2_direct
echo         build_stage2_rust_cross
echo         build_stage2_list
echo         build_stage2_conflict
echo         build_stage2_cross_clang
echo         build_stage3
echo         build_stage3_mingw64_with_extract
echo         build_stage3_mingw64
exit /B 0

:build_stage1_install
if exist dist (rd /s /q dist) else (echo "dist directory does not exist")
mkdir dist
echo "Preparing msys64 for stage1 by install all packages msys repo"
node scripts/cli.ts install-for-stage1
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage1_hook_with_extract

:build_stage1_hook_with_extract
call :extract_msys64 stage1
if defined ONLY goto :build_finished
goto :build_stage1_init

:build_stage1_init
echo "Initializing stage1 build lists"
node scripts/cli.ts build-list-init
if errorlevel 1 exit /B 1
node scripts/cli.ts download-runtime-init
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage1_hook_direct

:build_stage1_hook_direct
echo "Installing original msys2-runtime and building hook patched msys2-runtime"
node scripts/cli.ts install-msys2-original-runtime
if errorlevel 1 exit /B 1
node scripts/cli.ts build-package-list stage1-rt-hook
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage1_core

:build_stage1_core_with_extract
call :extract_msys64 stage1
if defined ONLY goto :build_finished
goto :build_stage1_core

:build_stage1_core
node scripts/cli.ts install-msys2-hook-runtime
if errorlevel 1 exit /B 1
node scripts/cli.ts build-package-list stage1-core
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage1_direct

:build_stage1_with_extract
call :extract_msys64 stage1
node scripts/cli.ts install-msys2-hook-runtime
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage1_direct

:build_stage1
node scripts/cli.ts install-msys2-hook-runtime
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage1_direct

:build_stage1_direct
node scripts/cli.ts build-package-list stage1
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage2_with_prepare

:build_stage2_with_prepare
echo "Preparing msys64 for stage2 by install packages built by stage1"
node scripts/cli.ts install-for-stage2
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage2_direct

:build_stage2_with_extract
call :extract_msys64 stage2
if defined ONLY goto :build_finished
goto :build_stage2_direct

:build_stage2
if defined ONLY goto :build_finished
goto :build_stage2_direct

:build_stage2_direct
if defined ONLY goto :build_finished
goto :build_stage2_rust_cross

:build_stage2_rust_cross
echo "Building rust cross for stage2"
node scripts/cli.ts build-package-list stage2-cross-rust
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage2_list

:build_stage2_list
echo "Building stage2 list packages"
node scripts/cli.ts build-package-list stage2
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage2_conflict

:build_stage2_conflict
echo "Building stage2 conflict packages"
node scripts/cli.ts build-package-list stage2-conflict
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage2_cross_clang

:build_stage2_cross_clang
echo "Building stage2 cross clang packages"
node scripts/cli.ts build-package-list stage2-cross-clang
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage3

:build_stage3
echo "Preparing msys64 for stage3 by install packages built by stage1 and stage2"
node scripts/cli.ts install-for-stage3
if errorlevel 1 exit /B 1
call :extract_msys64 stage3
node scripts/cli.ts install-for-stage3-mingw64
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished
goto :build_stage3_mingw64_with_extract

:build_stage3_mingw64_with_extract
echo "Extracting msys64 for stage3-mingw64"
call :extract_msys64 stage3-mingw64
if defined ONLY goto :build_finished
goto :build_stage3_mingw64

:build_stage3_mingw64
echo "Building stage3 mingw packages"
node scripts/cli.ts build-package-list stage3-mingw64
if errorlevel 1 exit /B 1
if defined ONLY goto :build_finished

goto :build_finished

:build_finished
echo "Building finished for %BUILD_STEP%, exiting with code 0"
endlocal
pause
exit /B 0
