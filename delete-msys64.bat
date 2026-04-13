pushd "%~dp0"

if exist msys64-to-delete (rd /s /q msys64-to-delete)
if exist msys64 (rename msys64 msys64-to-delete)
if exist msys64 (
  echo "Delete msys64 failed"
)
if exist msys64-to-delete (rd /s /q msys64-to-delete)

popd

if defined CI_TOOLS_DISABLE_PAUSE ( goto :eof )
pause

:eof
