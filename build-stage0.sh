# gcc is linkage to msys*
# export MSYS_BUILD_PKGSUMS=enabled
# export MSYS_CLEAN_TYPE=enabled
export MSYS_BOOTSTRAP_STAGE=stage0
source build-check-bootstrap.sh

bulid_packages() {
  # libtool and msys2-runtime are indpendent, they do not dpends on each other.
  sh build-single.sh msys2-runtime
  sh build-single.sh libtool

  # libiconv depends on msys2-runtime and libtool
  sh build-single.sh libiconv
  # gcc depends on libiconv
  sh build-single.sh gcc

  # gcc and binutils are independet, they do not depends on each other.
  sh build-single.sh binutils

  sh build-single.sh cmake
  sh build-single.sh meson
  sh build-single.sh scons
}

bulid_packages

do_build() {


  sh ./build-stage0.sh >build-stage0.txt 2>&1

  MSYS_BOOTSTRAP_STAGE=stage0 makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck --skippgpcheck >../../gcc.txt

  export MSYS_BOOTSTRAP_STAGE=stage0
  export pkg_root_dir=$PWD
  export MSYS_IN_PKGBUILD=enabled
  sh ${pkg_root_dir}/build-install/gcc-prepare.sh
  pushd ports/gcc/src
  export srcdir=$PWD
  cd ${srcdir}/build-MSYS
  export PATH=${srcdir}/build-MSYS/x86_64-pc-cygwin/libgcc/shlib:$PATH
  rm -rf x86_64-pc-cygwin
  make
}

