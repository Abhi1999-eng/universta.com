#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

for service in "${UNIVERSTA_SERVICES[@]}"; do
  systemctl is-active --quiet "${service}" ||
    fail "${service} is not active."
done

api_ready=false
for ((attempt = 1; attempt <= 12; attempt++)); do
  if api_health="$(
    curl --fail --silent --max-time 3 http://127.0.0.1:4000/health
  )" &&
    jq -e '.status == "ok" and .database == "up"' \
      <<< "${api_health}" >/dev/null; then
    api_ready=true
    break
  fi
  sleep 2
done
[[ "${api_ready}" == "true" ]] ||
  fail "API/database health did not become ready within 60 seconds."

for path in / /countries /subjects /courses /counselling; do
  web_ready=false
  for ((attempt = 1; attempt <= 12; attempt++)); do
    if curl --fail --silent --max-time 3 \
      --output /dev/null "http://127.0.0.1:3000${path}"; then
      web_ready=true
      break
    fi
    sleep 2
  done
  [[ "${web_ready}" == "true" ]] ||
    fail "Web health check did not become ready for ${path} within 60 seconds."
done

admin_ready=false
for ((attempt = 1; attempt <= 12; attempt++)); do
  if curl --fail --silent --max-time 3 \
    --output /dev/null http://127.0.0.1:3001/login; then
    admin_ready=true
    break
  fi
  sleep 2
done
[[ "${admin_ready}" == "true" ]] ||
  fail "Admin login did not become ready within 60 seconds."

log "API, database, Web, and Admin health checks passed."
