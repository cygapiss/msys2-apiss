rm -rf /c/work/xemu/CYGWIN-packages/ports/gcc/src/build-MSYS/gcc
mkdir -p /c/work/xemu/CYGWIN-packages/ports/gcc/src/build-MSYS/gcc
pushd /c/work/xemu/CYGWIN-packages/ports/gcc/src/build-MSYS/gcc
CC="gcc" \
CFLAGS="-march=nocona -msahf -mtune=generic -O2     " \
LDFLAGS="-static-libstdc++ -static-libgcc -Wl,--stack,12582912" \
CPPFLAGS="" \
CXX="g++" \
CXXFLAGS="-march=nocona -msahf -mtune=generic -O2     " \
GMPLIBS="-lmpc -lmpfr -lgmp" \
GMPINC="" \
ISLLIBS="-lisl" \
ISLINC="" \
/c/work/xemu/CYGWIN-packages/ports/gcc/src/gcc-15.2.0/gcc/configure --srcdir=/c/work/xemu/CYGWIN-packages/ports/gcc/src/gcc-15.2.0/gcc --cache-file=./config.cache --with-system-zlib --prefix=/usr --libexecdir=/usr/lib --disable-bootstrap --enable-static --enable-shared --enable-shared-libgcc --enable-version-specific-runtime-libs --with-arch=nocona --with-tune=generic --disable-multilib --enable-__cxa_atexit --with-dwarf2 --enable-graphite --enable-threads=posix --enable-libatomic --enable-libgomp --disable-libitm --enable-libquadmath --enable-libquadmath-support --disable-libssp --disable-win32-registry --disable-symvers --with-gnu-ld --with-gnu-as --disable-isl-version-check --enable-checking=release --without-libiconv-prefix --without-libintl-prefix --with-system-zlib --enable-linker-build-id --enable-libstdcxx-filesystem-ts --enable-languages=c,c++,lto --program-transform-name=s,y,y, --disable-option-checking --disable-year2038 --build=x86_64-pc-cygwin --host=x86_64-pc-cygwin --target=x86_64-pc-cygwin


CC="gcc" \
CFLAGS="-march=nocona -msahf -mtune=generic -O2     " \
LDFLAGS="-static-libstdc++ -static-libgcc -Wl,--stack,12582912" \
CPPFLAGS="" \
CXX="g++" \
CXXFLAGS="-march=nocona -msahf -mtune=generic -O2     " \
GMPLIBS="-lmpc -lmpfr -lgmp" \
GMPINC="" \
ISLLIBS="-lisl" \
ISLINC="" \
/c/work/xemu/MSYS2-packages/gcc/src/gcc-15.2.0/gcc/configure --srcdir=/c/work/xemu/MSYS2-packages/gcc/src/gcc-15.2.0/gcc --cache-file=./config.cache --with-system-zlib --prefix=/usr --libexecdir=/usr/lib --disable-bootstrap --enable-static --enable-shared --enable-shared-libgcc --enable-version-specific-runtime-libs --with-arch=nocona --with-tune=generic --disable-multilib --enable-__cxa_atexit --with-dwarf2 --enable-graphite --enable-threads=posix --enable-libatomic --enable-libgomp --disable-libitm --enable-libquadmath --enable-libquadmath-support --disable-libssp --disable-win32-registry --disable-symvers --with-gnu-ld --with-gnu-as --disable-isl-version-check --enable-checking=release --without-libiconv-prefix --without-libintl-prefix --with-system-zlib --enable-linker-build-id --enable-libstdcxx-filesystem-ts --enable-languages=c,c++,lto --program-transform-name=s,y,y, --disable-option-checking --disable-year2038 --build=x86_64-pc-cygwin --host=x86_64-pc-cygwin --target=x86_64-pc-cygwin