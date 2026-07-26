#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

web_origin="$(parameter runtime/web-origin)"
admin_origin="$(parameter runtime/admin-origin)"
api_origin="$(parameter runtime/api-origin)"

for path in / /countries /countries/canada /subjects /subjects/computer-science \
  /subjects/computer-science/specializations /courses /counselling; do
  curl --fail --silent --show-error --max-time 30 \
    --output /dev/null "${web_origin}${path}" ||
    fail "Public Web smoke failed for ${path}."
done

curl --fail --silent --show-error --max-time 30 \
  --output /dev/null "${admin_origin}/login" ||
  fail "Public Admin smoke failed."

api_health="$(curl --fail --silent --show-error --max-time 15 "${api_origin}/health")"
jq -e '.status == "ok" and .database == "up"' <<< "${api_health}" >/dev/null ||
  fail "Public API smoke failed."

log "Public Web, Admin, and API smoke checks passed."
