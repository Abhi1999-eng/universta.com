#!/usr/bin/env bash

set -euo pipefail

sha="${1:-}"
output_dir="${2:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/universta-release}"

if [[ ! "${sha}" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Expected an exact 40-character lowercase Git commit SHA.\n' >&2
  exit 1
fi

if [[ -z "${output_dir}" || "${output_dir}" == "/" ]]; then
  printf 'A safe output directory is required.\n' >&2
  exit 1
fi

actual_sha="$(git rev-parse HEAD)"
if [[ "${actual_sha}" != "${sha}" ]]; then
  printf 'Checked-out SHA %s does not match requested release SHA %s.\n' "${actual_sha}" "${sha}" >&2
  exit 1
fi

for required in \
  apps/web/.next/BUILD_ID \
  apps/admin/.next/BUILD_ID \
  apps/api/dist/src/main.js; do
  [[ -f "${required}" ]] || {
    printf 'Missing required build output: %s\n' "${required}" >&2
    exit 1
  }
done

staging="${output_dir}/staging-${sha}"
archive="${output_dir}/universta-${sha}.tar.gz"
checksum="${archive}.sha256"

mkdir -p "${output_dir}"
case "${staging}" in
  "${output_dir}"/staging-*) rm -rf "${staging}" ;;
  *) printf 'Refusing unsafe staging cleanup: %s\n' "${staging}" >&2; exit 1 ;;
esac
mkdir -p "${staging}"

git archive --format=tar "${sha}" | tar -xf - -C "${staging}"
cp -a apps/web/.next "${staging}/apps/web/.next"
cp -a apps/admin/.next "${staging}/apps/admin/.next"
cp -a apps/api/dist "${staging}/apps/api/dist"

if [[ -d apps/api/src/generated/prisma ]]; then
  mkdir -p "${staging}/apps/api/src/generated"
  cp -a apps/api/src/generated/prisma "${staging}/apps/api/src/generated/prisma"
fi

rm -rf \
  "${staging}/apps/web/.next/cache" \
  "${staging}/apps/admin/.next/cache"

printf '%s\n' "${sha}" > "${staging}/DEPLOYMENT_SHA"
commit_time="$(git show -s --format=%ct "${sha}")"
if tar --version 2>/dev/null | grep -q 'GNU tar'; then
  tar \
    --sort=name \
    --mtime="@${commit_time}" \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    -czf "${archive}" \
    -C "${staging}" .
else
  COPYFILE_DISABLE=1 tar -czf "${archive}" -C "${staging}" .
fi

(
  cd "${output_dir}"
  sha256sum "$(basename "${archive}")" > "$(basename "${checksum}")"
)

printf 'archive=%s\nchecksum=%s\nsha=%s\n' "${archive}" "${checksum}" "${sha}"
