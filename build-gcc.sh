CFLAGS=${CFLAGS/-pipe/}
CXXFLAGS=${CXXFLAGS/-pipe/}
echo $CXXFLAGS

export lt_cv_deplibs_check_method='pass_all'

export MSYSTEM=CYGWIN
export _arch=nocona
export _arch_conf=


tar xf /c/work/xemu/CYGWIN-packages/dist-init/msys2-runtime-devel-3.6.5-3-x86_64.pkg.tar.zst -C /

/c/work/xemu/CYGWIN-packages/ports/gcc/src/gcc-15.2.0/configure --build=x86_64-pc-cygwin --prefix=/usr --libexecdir=/usr/lib --disable-bootstrap --enable-static --enable-shared --enable-shared-libgcc --enable-version-specific-runtime-libs --with-arch=nocona --with-tune=generic --disable-multilib --enable-__cxa_atexit --with-dwarf2 --enable-languages=c,c++,lto --enable-graphite --enable-threads=posix --enable-libatomic --enable-libgomp --disable-libitm --enable-libquadmath --enable-libquadmath-support --disable-libssp --disable-win32-registry --disable-symvers --with-gnu-ld --with-gnu-as --disable-isl-version-check --enable-checking=release --without-libiconv-prefix --without-libintl-prefix --with-system-zlib --enable-linker-build-id --enable-libstdcxx-filesystem-ts


make all-build

make all-host

tar xf /c/work/xemu/CYGWIN-packages/dist/msys2-runtime-devel-3.6.5-5-x86_64.pkg.tar.zst -C /

make all-target
