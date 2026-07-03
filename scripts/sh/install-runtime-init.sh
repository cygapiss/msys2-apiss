#!/bin/bash
set -e

source scripts/sh/check-bootstrap.sh

sed -i 's/^LocalFileSigLevel.*$/LocalFileSigLevel = Never/' /etc/pacman.conf

if [[ -z "$MSYS_RUNTIME_PACKAGES_INIT" ]]; then
  echo "MSYS_RUNTIME_PACKAGES_INIT is not set" >&2
  exit 1
fi

# MSYS_RUNTIME_PACKAGES_INIT holds template paths ($MSYS_RUNTIME_PKGVER, etc.).
# check-bootstrap.sh sets those vars; eval expands them into real filenames.
runtime_packages=$(eval echo "$MSYS_RUNTIME_PACKAGES_INIT")
pacman -U --noconfirm --overwrite \* $runtime_packages
