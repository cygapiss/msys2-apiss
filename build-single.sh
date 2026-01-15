pkg_root_dir=$PWD
new_dir=$1
pushd ./ports/${new_dir}

do_build() {
  exist_packages=`find . -maxdepth 1 -name "*.pkg.tar.zst"`
  echo "Do build for ${new_dir} at `cygpath -w ${PWD}` exist_packages:$exist_packages MSYS_BOOTSTRAP_STAGE:$MSYS_BOOTSTRAP_STAGE"

  if [[ "$MSYS_BUILD_WITH_CLEAN" == "enabled" ]]; then
    rm -rf ${new_dir}-tmp-full.tar
  fi

  if [[ "$MSYS_BUILD_PKGSUMS" == "enabled" ]]; then
    updpkgsums
  fi

  if [ -f "${pkg_root_dir}/build-install/${new_dir}-prepare.sh" ]; then
    echo "Prepare for ${new_dir}"
    new_dir=${new_dir} pkg_root_dir=${pkg_root_dir} \
    sh "${pkg_root_dir}/build-install/${new_dir}-prepare.sh"
  fi

  if [[ "$exist_packages" == "" ]]; then
    echo "There is no packages for ${new_dir}"
    rm -rf ${new_dir}-tmp-full.tar
  fi

  if [ -f ${new_dir}-tmp-full.tar ]; then
    echo "There is no need build for '${new_dir}'"
  else
    echo "Building with makepkg for '${new_dir}'"
    makepkg --cleanbuild --syncdeps --force --noconfirm --nocheck --skippgpcheck
    # makepkg -e --force --noconfirm --nocheck --skippgpcheck
    # makepkg --nobuild --cleanbuild
  fi

  retVal=$?
  if [ $retVal -ne 0 ]; then
      echo "Error for pkgbase: ${new_dir} with retcode:$retVal"
      find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG rm -f ARG
      # exit $retVal
  fi
  echo "Building '${new_dir}' finished"

  echo "All packages:"
  find . -maxdepth 1 -name "*.pkg.tar.zst"
  echo "Backup packages"
  find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG cp -arf ARG ../../dist/

  echo "Install packages:"
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
    new_dir=${new_dir} pkg_root_dir=${pkg_root_dir} \
    sh "${pkg_root_dir}/build-install/${new_dir}.sh"
  else
    tar xf ${new_dir}-tmp.tar -C /
  fi

  echo "Install '${new_dir}' finished"
}

if [[ "$MSYS_BOOTSTRAP_STAGE" == "cleanup" ]]; then
  echo "Do cleanup for ${new_dir} at `cygpath -w ${PWD}`"
  rm -rf ${new_dir}-tmp.tar
  rm -rf ${new_dir}-tmp-full.tar
  find . -maxdepth 1 -name "*.pkg.tar.zst" | xargs -I ARG rm -f ARG
else
  do_build
fi

popd
