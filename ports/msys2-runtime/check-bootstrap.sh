
check_bootstrap() {
  if [[ -z "$MSYS_BOOTSTRAP_STAGE" ]]; then
    ldd_output="$(ldd /usr/bin/ldd 2>&1)"
    SUB="msys-2.0.dll"
    if [[ "$ldd_output" == *"$SUB"* ]]; then
        MSYS_BOOTSTRAP_STAGE="stage1-rt-origin"
    else
        MSYS_BOOTSTRAP_STAGE="stage3"
    fi
  fi
  export MSYS_BOOTSTRAP_STAGE
}

check_bootstrap
