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
  # ISS-025. `npm --workspace apps/api run start:prod` runs the API with its
  # OS-level cwd inside apps/api, not the release root -- confirmed live via
  # /proc/<pid>/cwd, despite systemd's WorkingDirectory being the release
  # root. MediaService writes uploads to `${cwd}/uploads/media`, so the
  # symlink belongs at apps/api/uploads, not uploads/ at the release root
  # (a first attempt at this fix put it at the wrong level and still 500'd).
  # The release is made read-only a few lines down (chmod -R go-w); symlinking
  # to shared, writable storage before that lockdown fixes it the same way
  # .next/cache already is above.
  ln -s "${UNIVERSTA_ROOT}/shared/uploads" "${staging}/apps/api/uploads"
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
set +e
runuser --preserve-environment -u universta -- \
  bash -lc "cd '${release}' && npm --workspace apps/api run db:migrate:recover-country-derived"
migration_recovery_status=$?
set -e
if [[ "${migration_recovery_status}" -eq 10 ]]; then
  log "Recovering the verified partial Country derived-data migration."
  runuser --preserve-environment -u universta -- \
    bash -lc "cd '${release}' && npm --workspace apps/api exec -- prisma migrate resolve --applied 20260823090000_country_derived_configuration"
elif [[ "${migration_recovery_status}" -ne 0 ]]; then
  fail "Country derived-data migration recovery check failed."
fi
set +e
runuser --preserve-environment -u universta -- \
  bash -lc "cd '${release}' && npm run db:migrate:deploy"
migration_status=$?
set -e
if [[ "${migration_status}" -ne 0 ]]; then
  # A fresh database with a non-unicode default collation fails at the same
  # known migration only after the first deploy attempt. Retry exactly once
  # and only after the recovery guard confirms that exact partial state.
  set +e
  runuser --preserve-environment -u universta -- \
    bash -lc "cd '${release}' && npm --workspace apps/api run db:migrate:recover-country-derived"
  migration_recovery_status=$?
  set -e
  if [[ "${migration_recovery_status}" -ne 10 ]]; then
    fail "Prisma migration failed and no safe Country derived-data recovery applied."
  fi
  log "Recovering the verified partial Country derived-data migration."
  runuser --preserve-environment -u universta -- \
    bash -lc "cd '${release}' && npm --workspace apps/api exec -- prisma migrate resolve --applied 20260823090000_country_derived_configuration"
  runuser --preserve-environment -u universta -- \
    bash -lc "cd '${release}' && npm run db:migrate:deploy"
fi
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
