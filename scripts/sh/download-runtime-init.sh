#!/bin/bash
set -e

source scripts/sh/check-bootstrap.sh

if [[ -z "$MSYS_RUNTIME_PACKAGES_INIT" ]]; then
  echo "MSYS_RUNTIME_PACKAGES_INIT is not set" >&2
  exit 1
fi

mkdir -p dist-pkg
MSYS2_MIRROR_BASE="${MSYS2_MIRROR_BASE:-https://repo.msys2.org/msys}"
MSYS2_STAGING_MIRROR_BASE="${MSYS2_STAGING_MIRROR_BASE:-https://repo.msys2.org/staging}"

verify_dist_pkg() {
  local pkg_path="$1"
  local sig_path="${pkg_path}.sig"
  if [[ ! -f "$pkg_path" || ! -f "$sig_path" ]]; then
    return 1
  fi
  GNUPGHOME=/etc/pacman.d/gnupg gpg --verify "$sig_path" "$pkg_path" >/dev/null 2>&1
}

warn_staging_skip() {
  local file="$1"
  local reason="$2"
  echo "WARNING: ${file}: using package without signature verification (${reason})" >&2
}

curl_download() {
  curl -fL --remote-time --retry 3 --retry-delay 2 -o "$1" "$2"
}

download_pkg_and_sig() {
  local file="$1"
  local pkg_path="$2"
  local sig_path="$3"
  local primary_url="$4"
  local staging_url="$5"

  echo "===Download ${file} from '${primary_url}'==="
  if curl_download "$pkg_path" "$primary_url" \
    && curl_download "$sig_path" "${primary_url}.sig"; then
    _download_mirror=primary
    return 0
  fi
  rm -f "$pkg_path" "$sig_path"
  echo "===Primary mirror failed for ${file}, trying staging '${staging_url}'==="
  curl_download "$pkg_path" "$staging_url"
  curl_download "$sig_path" "${staging_url}.sig"
  _download_mirror=staging
}

# MSYS_RUNTIME_PACKAGES_INIT holds template paths ($MSYS_RUNTIME_PKGVER, etc.).
# check-bootstrap.sh sets those vars; eval expands them into real filenames.
runtime_packages=$(eval echo "$MSYS_RUNTIME_PACKAGES_INIT")
for path in $runtime_packages; do
  file="${path##*/}"
  pkg_path="dist-pkg/${file}"
  sig_path="${pkg_path}.sig"
  skip_path="${pkg_path}.skip"
  if [[ "$file" == *-any.pkg.tar.zst ]]; then
    repo_arch=x86_64
  elif [[ "$file" == *-x86_64.pkg.tar.zst ]]; then
    repo_arch=x86_64
  elif [[ "$file" == *-i686.pkg.tar.zst ]]; then
    repo_arch=i686
  else
    echo "Unknown arch suffix in ${file}" >&2
    exit 1
  fi
  url="${MSYS2_MIRROR_BASE}/${repo_arch}/${file}"
  staging_url="${MSYS2_STAGING_MIRROR_BASE}/${file}"
  if [[ -f "$skip_path" && -f "$pkg_path" ]]; then
    warn_staging_skip "$file" ".skip marker present"
    echo "===Skip ${file}: present (staging, signature check skipped)==="
    continue
  fi
  if verify_dist_pkg "$pkg_path"; then
    rm -f "$skip_path"
    echo "===Skip ${file}: present with valid signature==="
    continue
  fi
  if [[ -f "$pkg_path" && -f "$sig_path" ]] \
    && ! curl -fsI --retry 1 --retry-delay 1 "$url" >/dev/null 2>&1; then
    warn_staging_skip "$file" "primary mirror unavailable, reusing local copy"
    echo "===Skip ${file}: present (staging, signature check skipped)==="
    touch "$skip_path"
    continue
  fi
  download_pkg_and_sig "$file" "$pkg_path" "$sig_path" "$url" "$staging_url"
  if [[ "$_download_mirror" == staging ]]; then
    warn_staging_skip "$file" "downloaded from staging mirror"
    echo "===Skip signature verification for ${file}: staging mirror (SigLevel=Never)==="
    touch "$skip_path"
  elif ! GNUPGHOME=/etc/pacman.d/gnupg gpg --verify "$sig_path" "$pkg_path"; then
    echo "Signature verification failed for ${file}" >&2
    rm -f "$pkg_path" "$sig_path" "$skip_path"
    exit 1
  else
    rm -f "$skip_path"
  fi
done

echo "===Runtime init download finished: $(find dist-pkg -maxdepth 1 -name '*.pkg.tar.zst' | wc -l) package(s) in dist-pkg/==="
