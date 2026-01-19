# gcc is linkage to msys*
export MSYS_BUILD_PKGSUMS=enabled
export MSYS_BUILD_WITH_CLEAN=enabled
export MSYS_BOOTSTRAP_STAGE=stage0

sh build-single.sh cmake
sh build-single.sh libtool
sh build-single.sh meson
sh build-single.sh scons
sh build-single.sh gcc

do_build() {

  sh build-single.sh msys2-runtime
  sh build-single.sh libiconv
  sh build-single.sh binutils

  sh ./build-stage0.sh >build-stage0.txt 2>&1
}

