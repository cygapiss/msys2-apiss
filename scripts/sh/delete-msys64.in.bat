setlocal
pushd "%~dp0"

if not exist msys64 (
  echo delete msys64 skipped: msys64 does not exist
  goto :delete_finish
)

call :kill_under "%CD%\msys64"
call :delete_tree msys64
if errorlevel 1 goto :delete_fail
echo delete msys64 done

:delete_finish
popd

if defined CI_TOOLS_DISABLE_PAUSE (
  endlocal
  goto :eof
)
pause
endlocal
goto :eof

:delete_fail
popd
if defined CI_TOOLS_DISABLE_PAUSE (
  endlocal & exit /B 1
)
pause
endlocal & exit /B 1

:delete_tree
if not exist "%~1" exit /B 0
echo delete %~1 ...
call :safe_unlink_dir %~1\var\cache\pacman\pkg
call :safe_unlink_dir %~1\home
rd /s /q "%~1"
if exist "%~1" (
  echo delete %~1 failed, retry after kill
  call :kill_under "%CD%\%~1"
  rd /s /q "%~1"
  if exist "%~1" exit /B 1
)
echo delete %~1 done
exit /B 0

:kill_under
setlocal
if "%~1"=="" (set "KILL_ROOT=%CD%") else (set "KILL_ROOT=%~f1")
echo kill processes under %KILL_ROOT% ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root = $env:KILL_ROOT; if (-not $root) { exit 0 }; $prefix = if ($root.EndsWith('\')) { $root } else { $root + '\' }; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Write-Host ('Killing PID ' + $_.ProcessId + ': ' + $_.ExecutablePath); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
endlocal
exit /B 0

:safe_unlink_dir
if not exist "%~1" exit /B 0
rmdir "%~1" 2>nul
if exist "%~1" rd /s /q "%~1"
exit /B 0
