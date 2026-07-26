#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

for service in "${UNIVERSTA_SERVICES[@]}"; do
  systemctl is-active --quiet "${service}" ||
    fail "${service} is not active."
done

api_health="$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:4000/health)"
jq -e '.status == "ok" and .database == "up"' <<< "${api_health}" >/dev/null ||
  fail "API/database health response is not healthy."

for path in / /countries /subjects /courses /counselling; do
  curl --fail --silent --show-error --max-time 20 \
    --output /dev/null "http://127.0.0.1:3000${path}" ||
    fail "Web health check failed for ${path}."
done

curl --fail --silent --show-error --max-time 20 \
  --output /dev/null http://127.0.0.1:3001/login ||
  fail "Admin login health check failed."

log "API, database, Web, and Admin health checks passed."
