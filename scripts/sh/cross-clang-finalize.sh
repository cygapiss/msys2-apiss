#!/bin/bash

source scripts/sh/check-bootstrap.sh

pacman_install_local_packages_by_search_list() {
  local install_list_path=$1
  local dist_dir_name=$2
  shift 2

  if [ "$#" -eq 0 ]; then
    return 0
  fi

  local install_list="${pkg_root_dir}/${install_list_path}"
  local dist_dir="${pkg_root_dir}/dist/${dist_dir_name}"
  local package_paths=()
  local pkg prefix found basename package_path line

  if [ ! -f "$install_list" ]; then
    echo "Missing install list: ${install_list}"
    exit 1
  fi

  for pkg in "$@"; do
    prefix="${pkg}-"
    found=0
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line#"${line%%[![:space:]]*}"}"
      line="${line%"${line##*[![:space:]]}"}"
      [ -z "$line" ] && continue
      [[ "$line" == \#* ]] && continue
      basename="${line#./}"
      if [[ "$basename" == "${prefix}"* ]]; then
        package_path="${dist_dir}/${basename}"
        if [ ! -e "$package_path" ]; then
          echo "Missing package for ${pkg}: ${package_path}"
          exit 1
        fi
        package_paths+=("$package_path")
        found=1
      fi
    done < "$install_list"
    if [ "$found" -eq 0 ]; then
      echo "Missing package for ${pkg} in ${install_list}"
      exit 1
    fi
  done

  pacman -U --noconfirm --overwrite \* "${package_paths[@]}"
}

sh scripts/sh/pacman-uninstall-if-installed.sh \
  mingw-w64-cross-clang \
  mingw-w64-cross-clang-crt \
  mingw-w64-cross-clang-headers

install_list_path=scripts/generated/stage1-install.txt
dist_dir_name=stage1
install_packages=(
  mingw-w64-cross-headers
  mingw-w64-cross-crt
)

pacman_install_local_packages_by_search_list \
  "$install_list_path" \
  "$dist_dir_name" \
  "${install_packages[@]}"
