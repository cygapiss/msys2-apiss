setlocal
pushd "%~dp0"

if not exist msys64 (
  if not exist msys64-to-delete (
    echo delete msys64 skipped: msys64 and msys64-to-delete do not exist
    goto :delete_finish
  )
)

if exist msys64-to-delete (
  echo delete msys64-to-delete ...
  call :safe_unlink_dir msys64-to-delete\var\cache\pacman\pkg
  call :safe_unlink_dir msys64-to-delete\home
  rd /s /q msys64-to-delete
  if errorlevel 1 (
    echo delete msys64-to-delete failed
    exit /B 1
  )
  echo delete msys64-to-delete done
)
if exist msys64 (
  echo rename msys64 msys64-to-delete ...
  rename msys64 msys64-to-delete
)
if exist msys64 (
  echo rename msys64 msys64-to-delete failed
  exit /B 1
)
if exist msys64-to-delete (
  echo delete msys64-to-delete ...
  call :safe_unlink_dir msys64-to-delete\var\cache\pacman\pkg
  call :safe_unlink_dir msys64-to-delete\home
  rd /s /q msys64-to-delete
  if errorlevel 1 (
    echo delete msys64-to-delete failed
    exit /B 1
  )
  echo delete msys64-to-delete done
)

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

:safe_unlink_dir
if not exist "%~1" exit /B 0
rmdir "%~1" 2>nul
if exist "%~1" rd /s /q "%~1"
exit /B 0
