export MSYS_BOOTSTRAP_STAGE=stage2
source $PWD/build-check-bootstrap.sh
sh build-single.sh $*
