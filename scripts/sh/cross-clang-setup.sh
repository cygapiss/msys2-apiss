#!/bin/bash

source scripts/sh/check-bootstrap.sh

sh scripts/sh/pacman-uninstall-if-installed.sh \
  mingw-w64-cross-headers \
  mingw-w64-cross-crt \
  mingw-w64-cross-clang-headers \
  mingw-w64-cross-clang-crt \
  mingw-w64-cross-clang
