export pkg_root_dir=$PWD
new_dir=$1
pushd ./ports/${new_dir}

stage_name="$MSYS_BOOTSTRAP_STAGE"
if [[ "$stage_name" == "" ]]; then
  stage_name="stage2"
fi

do_build() {
  exist_packages=`find . -maxdepth 1 -name "*.pkg.tar.zst" | tr '\n' ' '`
  echo "Do build for ${new_dir} at `cygpath -w ${PWD}` exist_packages:'$exist_packages'"

  build_finished_file=$pkg_root_dir/build-cache/$stage_name/${new_dir}-${stage_name}-build-finished.build
  build_finished_stage2_file=$pkg_root_dir/build-cache/stage2/${new_dir}-stage2-build-finished.build
  if [[ "$stage_name" == "stage1" ]]; then
    if [ -f "${build_finished_stage2_file}" ]; then
      echo "stage2 build for '${new_dir}' is finished, then do not build it"
      build_finished_file=${build_finished_stage2_file}
    fi
  fi
  if [[ "$MSYS_BUILD_WITH_CLEAN" == "enabled" ]]; then
    rm -rf "$build_finished_file"
  fi
  echo "The build_finished_file for stage_name:$stage_name is $build_finished_file"

  if [[ "$MSYS_BUILD_PKGSUMS" == "enabled" ]]; then
    updpkgsums
  fi

  if [ -f "${pkg_root_dir}/build-install/${new_dir}-prepare.sh" ]; then
    echo "Prepare for ${new_dir}"
    new_dir=${new_dir} pkg_root_dir=${pkg_root_dir} \
    sh "${pkg_root_dir}/build-install/${new_dir}-prepare.sh"
  fi

  need_makepkg=1
  if [[ "$exist_packages" == "" ]]; then
    echo "There is no packages for '${new_dir}', build it"
  else
    if [ -f "$build_finished_file" ]; then
      echo "The '$build_finished_file' exist, there is no need build '${new_dir}'"
      need_makepkg=0
    fi
  fi

  if [[ "$need_makepkg" == "0" ]]; then
    echo "There is no need build for '${new_dir}'"
  else
    echo "Building with makepkg for '${new_dir}'"
    echo "Remove existing packages first"
    find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG rm -f ARG
    if [[ "$MSYS_BUILD_NOEXTRACT" == "enabled" ]]; then
      # Do not extract source
      echo "Building '${new_dir}' without extract "
      makepkg --noextract --force --noconfirm --nocheck --skippgpcheck
      # makepkg --nobuild --cleanbuild
    else
      # Extract source
      echo "Building '${new_dir}' with extract "
      makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck --skippgpcheck
    fi
  fi

  retVal=$?

  if [ -f "${pkg_root_dir}/build-install/${new_dir}-finish.sh" ]; then
    echo "Finish for ${new_dir}"
    new_dir=${new_dir} \
    sh "${pkg_root_dir}/build-install/${new_dir}-finish.sh"
  fi

  if [ $retVal -ne 0 ]; then
    echo "Error for pkgbase: ${new_dir} with retcode:$retVal"
    find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG rm -f ARG
    # exit $retVal
  else
    touch "$build_finished_file"
  fi
  echo "Building '${new_dir}' finished"

  echo "All packages:"
  find . -maxdepth 1 -name "*.pkg.tar.zst"
  echo "Backup packages"
  if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
    find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG cp -arf ARG ../../dist/
  elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
    find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG cp -arf ARG ../../dist-init/
  elif [[ "$MSYS_BOOTSTRAP_STAGE" == "" ]]; then
    find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG cp -arf ARG ../../dist-final/
  fi

  echo "Install packages:"
  if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
    rm -rf tmp
    mkdir -p tmp
    find -name "*.pkg.tar.zst" | xargs -I ARG tar -xf ARG -C tmp
    pushd tmp
    rm .BUILDINFO .MTREE .PKGINFO
    popd

    rm -rf ${new_dir}-tmp-full.tar
    tar -cf ${new_dir}-tmp-full.tar -C tmp .

    if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
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
    fi

    rm -rf ${new_dir}-tmp.tar
    tar -cf ${new_dir}-tmp.tar -C tmp .

    echo "Install to system for ${new_dir}"

    if [ -f "${pkg_root_dir}/build-install/${new_dir}.sh" ]; then
      new_dir=${new_dir} \
      sh "${pkg_root_dir}/build-install/${new_dir}.sh"
    else
      tar xf ${new_dir}-tmp.tar -C /
    fi
  elif [[ "$MSYS_BOOTSTRAP_STAGE" == "" ]]; then
    find -name "*.pkg.tar.zst" | xargs -I ARG pacman -U --noconfirm --overwrite \* ARG
  else
    echo "Do not install for ${MSYS_BOOTSTRAP_STAGE}"
  fi
  echo "Install '${new_dir}' finished"
}

if [[ "$MSYS_BOOTSTRAP_STAGE" == "cleanup" ]]; then
  echo "Do cleanup for ${new_dir} at `cygpath -w ${PWD}`"
  find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG rm -f ARG
else
  do_build
fi

popd
