#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_root

sha="${1:-}"
bucket="${2:-}"
supplied_archive="${3:-}"
supplied_checksum="${4:-}"

validate_sha "${sha}"
[[ -n "${bucket}" ]] || fail "Artifact bucket is required."

install -d -o root -g universta -m 0750 "${UNIVERSTA_ROOT}/shared/deploy"
exec 9>"${UNIVERSTA_ROOT}/shared/deploy/deploy.lock"
flock -n 9 || fail "Another deployment or rollback is already running."

"${SCRIPT_DIR}/preflight.sh" "${sha}" "${bucket}"

work_dir="$(mktemp -d "${UNIVERSTA_ROOT}/shared/deploy/release-${sha}.XXXXXX")"
cleanup() {
  case "${work_dir}" in
    "${UNIVERSTA_ROOT}/shared/deploy/"*) rm -rf "${work_dir}" ;;
  esac
}
trap cleanup EXIT

archive="${work_dir}/universta-${sha}.tar.gz"
checksum="${archive}.sha256"

if [[ -n "${supplied_archive}" && -n "${supplied_checksum}" ]]; then
  cp "${supplied_archive}" "${archive}"
  cp "${supplied_checksum}" "${checksum}"
else
  aws s3 cp \
    --region "${UNIVERSTA_REGION}" \
    --no-progress \
    "s3://${bucket}/releases/${sha}/universta-${sha}.tar.gz" \
    "${archive}"
  aws s3 cp \
    --region "${UNIVERSTA_REGION}" \
    --no-progress \
    "s3://${bucket}/releases/${sha}/universta-${sha}.tar.gz.sha256" \
    "${checksum}"
fi

(
  cd "${work_dir}"
  sha256sum --check "$(basename "${checksum}")"
)

release="${UNIVERSTA_ROOT}/releases/${sha}"
staging="${UNIVERSTA_ROOT}/releases/.${sha}.staging"

if [[ -d "${release}" && ! -f "${release}/.release-ready" ]]; then
  case "${release}" in
    "${UNIVERSTA_ROOT}/releases/"*) rm -rf "${release}" ;;
    *) fail "Refusing unsafe incomplete release cleanup." ;;
  esac
fi

if [[ ! -f "${release}/.release-ready" ]]; then
  case "${staging}" in
    "${UNIVERSTA_ROOT}/releases/."*.staging) rm -rf "${staging}" ;;
    *) fail "Refusing unsafe staging cleanup." ;;
  esac

  install -d -o universta -g universta -m 0755 "${staging}"
  tar -xzf "${archive}" -C "${staging}"
  [[ "$(tr -d '\n' < "${staging}/DEPLOYMENT_SHA")" == "${sha}" ]] ||
    fail "Release manifest SHA does not match ${sha}."

  chown -R universta:universta "${staging}"
  runuser -u universta -- \
    bash -lc "cd '${staging}' && npm ci --include=dev --no-audit --no-fund"
  runuser -u universta -- \
    bash -lc "cd '${staging}' && npm run db:generate"

  [[ -f "${staging}/apps/web/.next/BUILD_ID" ]] ||
    fail "Web production build output is missing."
  [[ -f "${staging}/apps/admin/.next/BUILD_ID" ]] ||
    fail "Admin production build output is missing."
  [[ -f "${staging}/apps/api/dist/src/main.js" ]] ||
    fail "API production build output is missing."

  rm -rf "${staging}/apps/web/.next/cache" "${staging}/apps/admin/.next/cache"
  ln -s "${UNIVERSTA_ROOT}/shared/cache/web" "${staging}/apps/web/.next/cache"
  ln -s "${UNIVERSTA_ROOT}/shared/cache/admin" "${staging}/apps/admin/.next/cache"
  # ISS-025. The API's WorkingDirectory (this release) is made read-only a few
  # lines down (chmod -R go-w), and MediaService writes uploads to
  # `${cwd}/uploads/media` -- every upload therefore hit EACCES/EROFS and
  # crashed with an unhandled 500, 100% of the time, in every deployed
  # release to date. Symlinking to shared, writable storage before the
  # lockdown fixes it the same way .next/cache already is above.
  ln -s "${UNIVERSTA_ROOT}/shared/uploads" "${staging}/uploads"
  touch "${staging}/.release-ready"
  chown -R root:universta "${staging}"
  chmod -R go-w "${staging}"
  mv "${staging}" "${release}"
fi

"${SCRIPT_DIR}/render-env.sh"

set -a
# shellcheck disable=SC1091
source "${UNIVERSTA_ROOT}/shared/env/api.env"
set +a
runuser --preserve-environment -u universta -- \
  bash -lc "cd '${release}' && npm run db:migrate:deploy"
runuser --preserve-environment -u universta -- \
  bash -lc "cd '${release}' && npm run db:seed"
set +a

"${SCRIPT_DIR}/configure-host.sh"

old_current=""
old_current_was_successful=false
if [[ -L "${UNIVERSTA_ROOT}/current" ]]; then
  old_current="$(readlink -f "${UNIVERSTA_ROOT}/current")"
  if release_was_successful "$(basename "${old_current}")"; then
    old_current_was_successful=true
  fi
fi

atomic_symlink "${release}" "${UNIVERSTA_ROOT}/current"
systemctl daemon-reload
systemctl restart universta-api
systemctl restart universta-web universta-admin
systemctl reload nginx

if ! "${SCRIPT_DIR}/health-check.sh"; then
  if [[ "${old_current_was_successful}" == "true" && -d "${old_current}" ]]; then
    log "Health failed; restoring previous application release."
    atomic_symlink "${old_current}" "${UNIVERSTA_ROOT}/current"
    systemctl restart "${UNIVERSTA_SERVICES[@]}"
    "${old_current}/scripts/deployment/health-check.sh" || true
  else
    log "Health failed and no previously successful release is available."
  fi
  fail "Deployment health checks failed for ${sha}."
fi

if [[ "${old_current_was_successful}" == "true" && "${old_current}" != "${release}" ]]; then
  atomic_symlink "${old_current}" "${UNIVERSTA_ROOT}/previous"
fi

"${SCRIPT_DIR}/smoke.sh"
printf '%s|%s|success\n' "$(date -u +%FT%TZ)" "${sha}" \
  >> "${UNIVERSTA_ROOT}/shared/deployment-history.log"
chmod 0640 "${UNIVERSTA_ROOT}/shared/deployment-history.log"

log "Deployment completed successfully for ${sha}."
