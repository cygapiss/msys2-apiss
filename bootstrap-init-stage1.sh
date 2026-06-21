
echo "Install new cmake meson scons and libtool"
pacman -U --noconfirm --overwrite \* ./dist/stage1-core/libltdl-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/stage1-core/libtool-$LIBTOOL_PKGVER-$LIBTOOL_PKGREL-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/stage1-core/cmake-$CMAKE_PKGVER-$CMAKE_PKGREL-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/stage1-core/meson-$MESON_PKGVER-$MESON_PKGREL-any.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist/stage1-core/scons-$SCONS_PKGVER-$SCONS_PKGREL-any.pkg.tar.zst

echo "Install new runtime and libiconv"
rm -rf ./tmp
mkdir -p ./tmp

tar xf ./dist/stage1-core/msys2-runtime-devel-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C ./tmp
tar xf ./dist/stage1-core/msys2-runtime-$MSYS_RUNTIME_PKGVER-$MSYS_RUNTIME_BOOTSTRAP_PKGREL-x86_64.pkg.tar.zst -C ./tmp
tar xf ./dist/stage1-core/libiconv-devel-$LIBICONV_PKGVER-$LIBICONV_PKGREL-x86_64.pkg.tar.zst -C ./tmp
tar xf ./dist/stage1-core/libiconv-$LIBICONV_PKGVER-$LIBICONV_PKGREL-x86_64.pkg.tar.zst -C ./tmp

rm -rf ./dist-tmp
cp -rf ./tmp ./dist-tmp

cp -arf ./tmp/usr/bin/*.dll /usr/bin/
rm -rf ./tmp/usr/bin
cp -arf ./tmp/usr/ /
rm -rf ./tmp
echo "Install new runtime and libiconv finished"

echo "Install new gcc and binutils"
tar xf ./dist/stage1-core/binutils-$BINUTILS_PKGVER-$BINUTILS_PKGREL-x86_64.pkg.tar.zst -C /
tar xf ./dist/stage1-core/gcc-libs-$GCC_PKGVER-$GCC_PKGREL-x86_64.pkg.tar.zst -C /
tar xf ./dist/stage1-core/gcc-$GCC_PKGVER-$GCC_PKGREL-x86_64.pkg.tar.zst -C /
rm -rf /usr/lib/gcc/x86_64-pc-cygwin/$GCC_PKGVER/msys-lto_plugin.dll

echo "Install new gcc and binutils finished"
