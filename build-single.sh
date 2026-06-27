new_dir=$1

if [ -z "$new_dir" ]; then
  echo "Please provide the package name as the first argument"
  exit -1
fi

currnent_script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
if [ -z "$currnent_script_dir" ]; then
  currnent_script_dir=$PWD
fi
source "${currnent_script_dir}/ports/msys2-runtime/check-bootstrap.sh"

export pkg_root_dir=$currnent_script_dir

if [[ -z "$MSYS_BOOTSTRAP_STAGE" ]]; then
  echo "Unknown MSYS_BOOTSTRAP_STAGE: $MSYS_BOOTSTRAP_STAGE"
  exit -1
fi

record_packages_to_install() {
  local install_list="${pkg_root_dir}/scripts/generated/${MSYS_BOOTSTRAP_STAGE}-install.txt"
  mkdir -p "${pkg_root_dir}/scripts/generated"
  IFS=' ' read -r -a current_package_list <<< "$current_packages"
  for package_name in "${current_package_list[@]}"; do
    [[ -z "$package_name" ]] && continue
    if ! grep -qxF "$package_name" "$install_list" 2>/dev/null; then
      echo "$package_name" >> "$install_list"
    fi
  done
  return 0
}

do_build() {
  pkg_current_dir=$PWD
  stage_name="$MSYS_BOOTSTRAP_STAGE"
  pkgver_command_str="export MSYS_BOOTSTRAP_STAGE=$stage_name;source $pkg_current_dir/PKGBUILD; echo \$pkgver"
  pkgver=`sh -c "$pkgver_command_str"`
  pkgrel_command_str="export MSYS_BOOTSTRAP_STAGE=$stage_name;source $pkg_current_dir/PKGBUILD; echo \$pkgrel"
  pkgrel=`sh -c "$pkgrel_command_str"`
  package_cache_dir="$pkg_root_dir/build-cache/$MSYS_BOOTSTRAP_STAGE/$new_dir-$pkgver-$pkgrel"
  package_cache_dir_win=`cygpath -w $package_cache_dir`

  mkdir -p $package_cache_dir
  pushd $package_cache_dir
  current_packages=`find . -maxdepth 1 -name "*.pkg.tar.zst" | tr '\n' ' '`
  popd

  echo "Do build for ${new_dir} stage:$stage_name at `cygpath -w ${PWD}` package_cache_dir:$package_cache_dir current_packages:'$current_packages'"

  if [[ -n "$MSYS_CLEAN_TYPE" ]]; then
    # MSYS_CLEAN_TYPE is enabled or only, do clean existing packages first
    if [ -n "$current_packages" ]; then
      echo "There are existing packages, do clean first for ('${new_dir}', '$MSYS_BOOTSTRAP_STAGE'): '$current_packages'"
      rm -rf $package_cache_dir
      mkdir -p $package_cache_dir
      current_packages=""
    fi
    if [[ "$MSYS_CLEAN_TYPE" == "only" ]]; then
      echo "Only clean existing packages for '${new_dir}', do not build it"
      return
    fi
  fi

  if [ -f "${pkg_root_dir}/build-install/${new_dir}-prepare.sh" ]; then
    echo "Prepare for ${new_dir}"
    new_dir=${new_dir} pkg_root_dir=${pkg_root_dir} package_cache_dir=$package_cache_dir pkgver=$pkgver pkgrel=$pkgrel \
    sh "${pkg_root_dir}/build-install/${new_dir}-prepare.sh"
  fi

  if [[ "$MSYS_BUILD_PKGSUMS" == "enabled" ]]; then
    echo "Only update pkgsums for '${new_dir}', do not build it"
    updpkgsums
  fi

  need_makepkg=1
  if [ -n "$current_packages" ]; then
    echo "The packages in '$package_cache_dir_win' exist, there is no need build '${new_dir}'"
    need_makepkg=0
  else
    echo "The packages in '$package_cache_dir_win' do not exist, build '${new_dir}'"
    need_makepkg=1
  fi

  if [[ "$need_makepkg" == "0" ]]; then
    echo "There is no need build for '${new_dir}'"
    retVal=0
  else
    rm -rf *.pkg.tar.zst
    makepkg_common_flags="--force --noconfirm --nocheck --skippgpcheck"
    if [[ "$stage_name" == "stage1-rt-origin" || "$stage_name" == "stage3" ]]; then
      makepkg_common_flags="$makepkg_common_flags --syncdeps"
    fi
    echo "Building with makepkg for '${new_dir}' with flags: '$makepkg_common_flags'"
    if [[ "$MSYS_BUILD_NO_EXTRACT" == "enabled" ]]; then
      # Do not extract source
      echo "Building '${new_dir}' without extract."
      makepkg --noextract $makepkg_common_flags
    else
      # Extract source
      echo "Building '${new_dir}' with extract at $PWD."
      makepkg --cleanbuild $makepkg_common_flags
    fi
    retVal=$?
  fi

  if [ -f "${pkg_root_dir}/build-install/${new_dir}-finish.sh" ]; then
    echo "Finish for ${new_dir}"
    new_dir=${new_dir} pkg_root_dir=${pkg_root_dir} package_cache_dir=$package_cache_dir pkgver=$pkgver pkgrel=$pkgrel \
    sh "${pkg_root_dir}/build-install/${new_dir}-finish.sh"
  fi

  if [ $retVal -ne 0 ]; then
    echo "Error for pkgbase: ${new_dir} with retcode:$retVal"
    exit $retVal
  elif [[ "$need_makepkg" == "0" ]]; then
    echo "The packages in '$package_cache_dir' already present, no need cache it."
  else
    current_packages=`find . -maxdepth 1 -name "*.pkg.tar.zst" | tr '\n' ' '`
    echo "Cache packages for '${new_dir}' to '$package_cache_dir', packages:'$current_packages'"
    rm -rf $package_cache_dir
    mkdir -p $package_cache_dir
    mv $current_packages "$package_cache_dir/"
  fi
  echo "Building '${new_dir}' as '$current_packages' finished"

  echo "Copy packages for stage:'$stage_name'"
  pushd $package_cache_dir
  mkdir -p $pkg_root_dir/dist/$MSYS_BOOTSTRAP_STAGE
  if [ -z "$MSYS_BOOTSTRAP_DISABLE_COPY_PACKAGES" ]; then
    echo "Copying packages:'$current_packages' to '$pkg_root_dir/dist/$MSYS_BOOTSTRAP_STAGE/'"
    cp -af $current_packages $pkg_root_dir/dist/$MSYS_BOOTSTRAP_STAGE/
  fi
  popd

  echo "Install packages for stage:'$stage_name'"
  record_packages_to_install
  if [[ "$stage_name" == "stage1" ]]; then
    rm -rf tmp
    mkdir -p tmp
    local any_package_paths=""
    local non_any_package_count=0
    IFS=' ' read -r -a current_package_list <<< "$current_packages"
    for package_name in "${current_package_list[@]}"; do
      [[ -z "$package_name" ]] && continue
      package_path="$package_cache_dir/$package_name"
      if [[ "$package_name" == *-any.pkg.tar.zst ]]; then
        any_package_paths="${any_package_paths} ${package_path}"
        continue
      fi
      echo "Extract '$package_path' into $pkg_current_dir/tmp"
      tar -xf "$package_path" -C tmp
      non_any_package_count=$((non_any_package_count + 1))
    done

    if [[ "$any_package_paths" != "" ]]; then
      echo "Install any packages with pacman:${any_package_paths}"
      pacman -U --noconfirm --overwrite \* $any_package_paths
    fi

    if [[ "$non_any_package_count" == "0" ]]; then
      return
    fi

    pushd tmp
    rm .BUILDINFO .MTREE .PKGINFO
    popd

    rm -rf ${new_dir}-tmp-full.tar
    tar -cf ${new_dir}-tmp-full.tar -C tmp .

    pushd tmp
    find | grep .exe$

    dlls_to_remove=`find | grep .dll$ | grep -v "^./usr/bin" | tr '\n' ' '`
    if [[ "$dlls_to_remove" != "" ]]; then
      echo "Clean the list of dlls: '$dlls_to_remove'"
    fi

    echo "Clean dll and exe:"

    find | grep .exe$ | xargs -I ARG rm -f ARG
    find | grep .dll$ | grep -v "^./usr/bin" | xargs -I ARG rm -f ARG
    echo "Finished clean dll and exe"
    find | grep .dll$
    popd

    rm -rf ${new_dir}-tmp.tar
    tar -cf ${new_dir}-tmp.tar -C tmp .

    echo "Install to system for ${new_dir} at stage1, only dlls are installed"

    if [ -f "${pkg_root_dir}/build-install/${new_dir}-install.sh" ]; then
      new_dir=${new_dir} pkg_root_dir=${pkg_root_dir} package_cache_dir=$package_cache_dir pkgver=$pkgver pkgrel=$pkgrel \
      sh "${pkg_root_dir}/build-install/${new_dir}-install.sh"
    else
      # Dereference the symlink during Extraction
      tar -xhf ${new_dir}-tmp.tar -C /
    fi
  elif [[ "$stage_name" == "stage2" ]]; then
    pushd $package_cache_dir
    pacman -U --noconfirm --overwrite \* $current_packages
    popd
  else
    echo "Do not install for '${stage_name}'"
  fi
  echo "Install '${new_dir}' finished"
  echo ""
  echo ""
}

pushd ./ports/${new_dir}
do_build
popd
