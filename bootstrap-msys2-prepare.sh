
# Building cmake
pushd ./ports/cmake
# updpkgsums
makepkg --cleanbuild --syncdeps --force --noconfirm
find -name "*.pkg.tar.zst" | xargs -I ARG mv -f ARG ../../dist-init/
popd

# Building libtool
pushd ./ports/libtool
makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck
find -name "*.pkg.tar.zst" | xargs -I ARG mv -f ARG ../../dist-init/
popd

# Building/install binutils
pushd ./ports/binutils
makepkg --cleanbuild --syncdeps --force --noconfirm
mv -f binutils-2.45.1-2-x86_64.pkg.tar.zst ../../dist-init/binutils-2.45.1-2-x86_64-stage0.pkg.tar.zst
popd

# Building meson
pushd ./ports/meson
makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck
find -name "*.pkg.tar.zst" | xargs -I ARG mv -f ARG ../../dist-init/
popd
