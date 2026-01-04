#!/bin/bash
sh bootstrap-init.sh
export MSYS_BOOTSTRAP_STAGE=stage1
sh msys-base-devel-list.sh

# sh build-single.sh nano
# sh build-single.sh gnupg
