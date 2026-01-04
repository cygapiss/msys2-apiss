mkdir -p ports/gcc/base/
cp -f ./dist-init/msys2-runtime-devel-3.6.5-5-x86_64.pkg.tar.zst ports/gcc/base/
cp -f ./dist-init/libiconv-devel-1.18-2-x86_64.pkg.tar.zst ports/gcc/base/

pushd ./ports/gcc
# updpkgsums
makepkg --cleanbuild --syncdeps --force --noconfirm
cp -arf gcc-libs-15.2.0-2-x86_64.pkg.tar.zst ../../dist-init/gcc-libs-15.2.0-2-x86_64-stage0.pkg.tar.zst
cp -arf gcc-15.2.0-2-x86_64.pkg.tar.zst ../../dist-init/gcc-15.2.0-2-x86_64-stage0.pkg.tar.zst
popd
