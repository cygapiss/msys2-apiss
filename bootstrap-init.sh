rm -rf /usr/lib/*.origin
pacman -U --noconfirm --overwrite \* ./dist-init/msys2-runtime-devel-3.6.5-3-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/msys2-runtime-3.6.5-3-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/gcc-15.2.0-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/gcc-15.2.0-1-x86_64.pkg.tar.zst

# Override exist tools
pacman -U --noconfirm --overwrite \* ./dist-init/gettext-devel-0.22.5-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/gmp-devel-6.3.0-2-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/isl-devel-0.27-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/libiconv-devel-1.18-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/libzstd-devel-1.5.7-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/zstd-1.5.7-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/mpc-devel-1.3.1-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/mpfr-devel-4.2.2-1-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/zlib-devel-1.3.1-1-x86_64.pkg.tar.zst

pacman -U --noconfirm --overwrite \* ./dist-init/gawk-5.3.2-1-x86_64.pkg.tar.zst

echo "Install new cmake meson and libtool"
pacman -U --noconfirm --overwrite \* ./dist-init/libltdl-2.5.4-5-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/libtool-2.5.4-5-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/cmake-4.2.1-2-x86_64.pkg.tar.zst
pacman -U --noconfirm --overwrite \* ./dist-init/meson-1.10.0-2-any.pkg.tar.zst

echo "Install new runtime"
rm -rf ./tmp
mkdir -p ./tmp

tar xf ./dist-init/msys2-runtime-devel-3.6.5-7-x86_64.pkg.tar.zst -C ./tmp
tar xf ./dist-init/msys2-runtime-3.6.5-7-x86_64.pkg.tar.zst -C ./tmp
rm -rf ./dist-tmp
cp -rf ./tmp ./dist-tmp

cp -arf ./tmp/usr/bin/*.dll /usr/bin/
rm -rf ./tmp/usr/bin
cp -arf ./tmp/usr/ /
rm -rf ./tmp
echo "Install new runtime finished"

echo "Install new gcc and binutils"
tar xf ./dist-init/binutils-2.45.1-2-x86_64-stage0.pkg.tar.zst -C /
tar xf ./dist-init/gcc-libs-15.2.0-2-x86_64-stage0.pkg.tar.zst -C /
tar xf ./dist-init/gcc-15.2.0-2-x86_64-stage0.pkg.tar.zst -C /
rm -rf /usr/lib/gcc/x86_64-pc-cygwin/15.2.0/msys-lto_plugin.dll

echo "Install new gcc and binutils finished"
