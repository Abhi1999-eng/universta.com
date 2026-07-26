#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_root

requested_sha="${1:-}"
if [[ -n "${requested_sha}" ]]; then
  validate_sha "${requested_sha}"
  target="${UNIVERSTA_ROOT}/releases/${requested_sha}"
elif [[ -L "${UNIVERSTA_ROOT}/previous" ]]; then
  target="$(readlink -f "${UNIVERSTA_ROOT}/previous")"
else
  fail "No previous release is available."
fi

target="$(readlink -f "${target}")"
case "${target}" in
  "${UNIVERSTA_ROOT}/releases/"*) ;;
  *) fail "Rollback target is outside the release directory." ;;
esac
[[ -f "${target}/.release-ready" ]] || fail "Rollback target is not a ready release."

exec 9>"${UNIVERSTA_ROOT}/shared/deploy/deploy.lock"
flock -n 9 || fail "Another deployment or rollback is already running."

current="$(readlink -f "${UNIVERSTA_ROOT}/current")"
[[ "${target}" != "${current}" ]] || fail "Requested release is already current."

atomic_symlink "${target}" "${UNIVERSTA_ROOT}/current"
systemctl restart "${UNIVERSTA_SERVICES[@]}"

if ! "${target}/scripts/deployment/health-check.sh"; then
  atomic_symlink "${current}" "${UNIVERSTA_ROOT}/current"
  systemctl restart "${UNIVERSTA_SERVICES[@]}"
  fail "Rollback target failed health checks; current release was restored."
fi

atomic_symlink "${current}" "${UNIVERSTA_ROOT}/previous"
rolled_back_sha="$(basename "${target}")"
printf '%s|%s|rollback\n' "$(date -u +%FT%TZ)" "${rolled_back_sha}" \
  >> "${UNIVERSTA_ROOT}/shared/deployment-history.log"

log "Rollback completed successfully to ${rolled_back_sha}."
