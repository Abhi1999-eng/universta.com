#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_root

operation="${1:-}"
case "${operation}" in
  seed|report|cleanup) ;;
  *) fail "QA dataset operation must be seed, report, or cleanup." ;;
esac

release="$(readlink -f "${UNIVERSTA_ROOT}/current")"
case "${release}" in
  "${UNIVERSTA_ROOT}/releases/"[0-9a-f]*) ;;
  *) fail "Current release is not an immutable Universta release." ;;
esac

set -a
# shellcheck disable=SC1091
source "${UNIVERSTA_ROOT}/shared/env/api.env"
set +a

[[ "${DEPLOYMENT_ENV:-}" == "demo" ]] || fail "QA dataset commands are restricted to DEPLOYMENT_ENV=demo."
if [[ "${operation}" == "seed" ]]; then
  [[ -n "${QA_ADMIN_PASSWORD:-}" ]] || fail "QA_ADMIN_PASSWORD is required for seed."
  [[ -n "${QA_STUDENT_PASSWORD:-}" ]] || fail "QA_STUDENT_PASSWORD is required for seed."
fi

export QA_E2E_DATASET=true
export QA_DATASET_MARKER=FORGE_E2E_2026

runuser --preserve-environment -u universta -- \
  bash -lc "cd '${release}' && npm run qa:dataset -- '${operation}'"
