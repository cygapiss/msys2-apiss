export MSYS_BUILD_PKGSUMS=disabled
# export MSYS_CLEAN_TYPE=enabled
export MSYS_BOOTSTRAP_STAGE=
source build-check-bootstrap.sh

sh build-single.sh msys2-runtime

export MSYS_BUILD_PKGSUMS=disabled
# export MSYS_CLEAN_TYPE=enabled
export MSYS_BOOTSTRAP_STAGE=stage_origin_hook
source build-check-bootstrap.sh

sh build-single.sh msys2-runtime

do_build() {
  sh ./build-stage-hook.sh >build-stage-hook.txt 2>&1
}
