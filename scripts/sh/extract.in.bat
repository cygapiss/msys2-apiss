setlocal
pushd "%~dp0"..
set __CI_TOOLS_DIR=%CD%
popd
set _MSYS64_CACHES=%__CI_TOOLS_DIR%\msys64-caches

pushd "%~dp0"

set "MSYS2_STAGE_EXTRACT_ARCHIVE=%~1"
if not defined MSYS2_STAGE_EXTRACT_ARCHIVE (
  set "MSYS2_STAGE_EXTRACT_ARCHIVE=@__MSYS2_STAGE_EXTRACT_ARCHIVE__@"
)

if not exist msys64 (
  rem Host tar xf (Windows tar on PATH), not msys64/usr/bin/tar.exe.
  echo tar xf %MSYS2_STAGE_EXTRACT_ARCHIVE% ...
  tar xf %MSYS2_STAGE_EXTRACT_ARCHIVE%
  if errorlevel 1 (
    echo tar xf %MSYS2_STAGE_EXTRACT_ARCHIVE% failed
    exit /B 1
  )
  echo tar xf %MSYS2_STAGE_EXTRACT_ARCHIVE% done
) else (
  echo tar xf %MSYS2_STAGE_EXTRACT_ARCHIVE% skipped: msys64 already exists
)

call :safe_unlink_dir msys64\home
mklink /D msys64\home %_MSYS64_CACHES%\msys64\home

call :safe_unlink_dir msys64\var\cache\pacman\pkg
mklink /D msys64\var\cache\pacman\pkg %_MSYS64_CACHES%\msys64\var\cache\pacman\pkg

popd

if defined CI_TOOLS_DISABLE_PAUSE (
  endlocal
  goto :eof
)

pause
endlocal
goto :eof

:safe_unlink_dir
if not exist "%~1" exit /B 0
rmdir "%~1" 2>nul
if exist "%~1" rd /s /q "%~1"
exit /B 0
