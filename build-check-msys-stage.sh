

_patches=(
  # patches from https://github.com/msys2/msys2-runtime
  0001-Fix-msys-library-name-in-import-libraries.patch
  0002-Rename-dll-from-cygwin-to-msys.patch
  0003-Add-functionality-for-converting-UNIX-paths-in-argum.patch
  0004-Add-functionality-for-changing-OS-name-via-MSYSTEM-e.patch
  0005-Move-root-to-usr.-Change-sorting-mount-points.-By-de.patch
  0006-Instead-of-creating-Cygwin-symlinks-use-deep-copy-by.patch
  0007-Automatically-rewrite-TERM-msys-to-TERM-cygwin.patch
  0008-Do-not-convert-environment-for-strace.patch
  0009-strace.cc-Don-t-set-MSYS-noglob.patch
  0010-Add-debugging-for-strace-make_command_line.patch
  0011-strace-quiet-be-really-quiet.patch
  0012-path_conv-special-case-root-directory-to-have-traili.patch
  0013-When-converting-to-a-Unix-path-avoid-double-trailing.patch
  0014-msys2_path_conv-pass-PC_NOFULL-to-path_conv.patch
  0015-path-conversion-Introduce-ability-to-switch-off-conv.patch
  0016-dcrt0.cc-Untangle-allow_glob-from-winshell.patch
  0017-dcrt0.cc-globify-Don-t-quote-literal-strings-differe.patch
  0018-Add-debugging-for-build_argv.patch
  0019-environ.cc-New-facility-environment-variable-MSYS2_E.patch
  0020-Introduce-the-enable_pcon-value-for-MSYS.patch
  0021-popen-call-usr-bin-sh-instead-of-bin-sh.patch
  0022-Expose-full-command-lines-to-other-Win32-processes-b.patch
  0023-Add-a-helper-to-obtain-a-function-s-address-in-kerne.patch
  0024-Emulate-GenerateConsoleCtrlEvent-upon-Ctrl-C.patch
  0025-kill-kill-Win32-processes-more-gently.patch
  0026-Cygwin-make-option-for-native-inner-link-handling.patch
  0027-docs-skip-building-texinfo-and-PDF-files.patch
  0028-install-libs-depend-on-the-toollibs.patch
  0029-POSIX-ify-the-SHELL-variable.patch
  0030-Handle-ORIGINAL_PATH-just-like-PATH.patch
  0031-uname-allow-setting-the-system-name-to-CYGWIN.patch
  0032-Pass-environment-variables-with-empty-values.patch
  0033-Optionally-disallow-empty-environment-values-again.patch
  0034-build_env-respect-the-MSYS-environment-variable.patch
  0035-Revert-Cygwin-Enable-dynamicbase-on-the-Cygwin-DLL-b.patch
  0036-Avoid-sharing-cygheaps-across-Cygwin-versions.patch
  0037-uname-report-msys2-runtime-commit-hash-too.patch
  0038-Cygwin-Adjust-CWD-magic-to-accommodate-for-the-lates.patch
  0039-Cygwin-Fix-segfault-when-XSAVE-area-sizes-are-unalig.patch
  0040-Revert-strace.cc-Don-t-set-MSYS-noglob.patch
  0041-Revert-Rename-dll-from-cygwin-to-msys.patch
  0042-Revert-uname-allow-setting-the-system-name-to-CYGWIN.patch
  0043-Revert-Add-functionality-for-changing-OS-name-via-MS.patch
  0044-Add-functionality-for-changing-OS-name-via-MSYSTEM-e.patch
  0045-Add-support-for-MSYS-environment-variable-instead-of.patch
  0046-strace.cc-Don-t-set-CYGWIN-noglob.patch
  0047-Convert-to-use-msys-style-named-pipe.patch
  0048-Rename-dll-from-cygwin-to-msys.patch
  0049-hookapi.c-Support-for-both-cygwin-and-msys2-for-boot.patch
  0050-Revert-Add-support-for-MSYS-environment-variable-ins.patch
  0051-Support-for-both-MSYS-and-CYGWIN-environment-variabl.patch
)

check_bootstrap() {
  if [[ -z "$MSYS_BOOTSTRAP_STAGE" ]]; then
    ldd_output="$(ldd /usr/bin/ldd 2>&1)"
    SUB="msys-2.0.dll"
    if [[ "$ldd_output" == *"$SUB"* ]]; then
        MSYS_BOOTSTRAP_STAGE=stage_origin
    else
        MSYS_BOOTSTRAP_STAGE=stage3
    fi
  fi
  export MSYS_BOOTSTRAP_STAGE
}

check_bootstrap

# Function: exclude_list (list_to_filter, items_to_exclude)
exclude_list() {
  local -n arr=$1      # Reference to the main array
  local -n exclude=$2  # Reference to the exclusion array
  local -A ex_map      # Associative array for O(1) lookup
  local result=()

  # Build lookup map from the exclusion list
  for item in "${exclude[@]}"; do ex_map["$item"]=1; done

  # Filter the main array
  for item in "${arr[@]}"; do
      [[ -z "${ex_map[$item]}" ]] && result+=("$item")
  done

  # Output filtered list (or re-assign to original array if desired)
  echo "${result[@]}"
}

# The original msys2-runtime patches that built as msys-2.0.dll
_patches_exclude_stage0=(
  0049-hookapi.c-Support-for-both-cygwin-and-msys2-for-boot.patch
  0050-Revert-Add-support-for-MSYS-environment-variable-ins.patch
  0051-Support-for-both-MSYS-and-CYGWIN-environment-variabl.patch
)

# The original msys2-runtime patches with hookapi patch that built as msys-2.0.dll
_patches_exclude_stage1=(
  0050-Revert-Add-support-for-MSYS-environment-variable-ins.patch
  0051-Support-for-both-MSYS-and-CYGWIN-environment-variabl.patch
)

# The new msys2-runtime that built as cygwin1.dll
_patches_exclude_stage2_stage3=(
  0048-Rename-dll-from-cygwin-to-msys.patch
  0049-hookapi.c-Support-for-both-cygwin-and-msys2-for-boot.patch
  0050-Revert-Add-support-for-MSYS-environment-variable-ins.patch
  0051-Support-for-both-MSYS-and-CYGWIN-environment-variabl.patch
)

pkgrel=3

_build_as_cygwin_dll=false
if [[ "$MSYS_BOOTSTRAP_STAGE" == "stage_origin" ]]; then
  pkgrel=$pkgrel
elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage_origin_hook" ]]; then
  pkgrel=5
elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage0" ]]; then
  pkgrel=6
  _build_as_cygwin_dll=true
elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage1" ]]; then
  pkgrel=7
  _build_as_cygwin_dll=true
elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage2" ]]; then
  pkgrel=8
  _build_as_cygwin_dll=true
elif [[ "$MSYS_BOOTSTRAP_STAGE" == "stage3" ]]; then
  pkgrel=9
  _build_as_cygwin_dll=true
else
 echo "Invalid MSYS_BOOTSTRAP_STAGE: '$MSYS_BOOTSTRAP_STAGE'" >&2
 exit -1
fi

for patch_filename in "${_patches[@]}"; do
  echo "${patch_filename}"
done

echo "The MSYS_BOOTSTRAP_STAGE is '$MSYS_BOOTSTRAP_STAGE'"
echo "The pkgrel is '$pkgrel'"
echo "_build_as_cygwin_dll is '$_build_as_cygwin_dll'"
