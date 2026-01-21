packages=(
  mingw-w64-cross-crt
  mingw-w64-cross-gcc
  mingw-w64-cross-headers
  mingw-w64-cross-mingw32-crt
  mingw-w64-cross-mingw32-gcc
  mingw-w64-cross-mingw32-headers
  mingw-w64-cross-mingw32-winpthreads 
  mingw-w64-cross-mingw32-winstorecompat 
  mingw-w64-cross-mingw64-crt 
  mingw-w64-cross-mingw64-gcc
  mingw-w64-cross-mingw64-headers
  mingw-w64-cross-mingw64-winpthreads 
  mingw-w64-cross-mingw64-winstorecompat 
  mingw-w64-cross-mingwarm64-crt
  mingw-w64-cross-mingwarm64-gcc 
  mingw-w64-cross-mingwarm64-headers
  mingw-w64-cross-mingwarm64-winpthreads 
  mingw-w64-cross-mingwarm64-winstorecompat 
  mingw-w64-cross-winpthreads 
  mingw-w64-cross-winpthreads  
  mingw-w64-cross-winstorecompat
  mingw-w64-cross-winstorecompat
)

pacman -R --noconfirm ${packages[@]}
