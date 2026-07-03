#!/bin/bash

if [ "$#" -eq 0 ]; then
  exit 0
fi

installed_packages=()
for pkg in "$@"; do
  if pacman -Q "$pkg" >/dev/null 2>&1; then
    installed_packages+=("$pkg")
  fi
done

if [ "${#installed_packages[@]}" -gt 0 ]; then
  pacman -Rdd --noconfirm "${installed_packages[@]}"
fi
