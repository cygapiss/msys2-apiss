# gcc is linkage to msys*
export MSYS_BUILD_PKGSUMS=enabled
export MSYS_BUILD_WITH_CLEAN=enabled
export MSYS_BOOTSTRAP_STAGE=stage0

sh build-single.sh gcc
