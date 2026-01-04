pushd ./ports/msys2-runtime
# updpkgsums
makepkg --cleanbuild --syncdeps --force --noconfirm
find -name "*.pkg.tar.zst" | xargs -I ARG mv -f ARG ../../dist-init/
popd
