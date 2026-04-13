
echo "Install new cmake meson scons and libtool"
pacman -U --noconfirm --overwrite \* ./dist/init/libltdl-$LIBTOOL_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/init/libtool-$LIBTOOL_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/init/cmake-$CMAKE_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/init/meson-$MESON_PKGVER-$MSYS2_BOOTSTRAP_VER-any.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/init/scons-$SCONS_PKGVER-$MSYS2_BOOTSTRAP_VER-any.pkg.tar.zst

echo "Install new runtime and libiconv"
rm -rf ./tmp
mkdir -p ./tmp

tar xf ./dist/init/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C ./tmp
tar xf ./dist/init/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C ./tmp
tar xf ./dist/init/libiconv-devel-$LIBICONV_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C ./tmp
tar xf ./dist/init/libiconv-$LIBICONV_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C ./tmp

rm -rf ./dist-tmp
cp -rf ./tmp ./dist-tmp

cp -arf ./tmp/usr/bin/*.dll /usr/bin/
rm -rf ./tmp/usr/bin
cp -arf ./tmp/usr/ /
rm -rf ./tmp
echo "Install new runtime and libiconv finished"

echo "Install new gcc and binutils"
tar xf ./dist/init/binutils-$BINUTILS_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C /
tar xf ./dist/init/gcc-libs-$GCC_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C /
tar xf ./dist/init/gcc-$GCC_PKGVER-$MSYS2_BOOTSTRAP_VER-x86_64.pkg.tar.zst -C /
rm -rf /usr/lib/gcc/x86_64-pc-cygwin/$GCC_PKGVER/msys-lto_plugin.dll

echo "Install new gcc and binutils finished"
