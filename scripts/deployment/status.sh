#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

current=""
previous=""
[[ -L "${UNIVERSTA_ROOT}/current" ]] && current="$(basename "$(readlink -f "${UNIVERSTA_ROOT}/current")")"
[[ -L "${UNIVERSTA_ROOT}/previous" ]] && previous="$(basename "$(readlink -f "${UNIVERSTA_ROOT}/previous")")"

api_health="unavailable"
if response="$(curl --fail --silent --max-time 5 http://127.0.0.1:4000/health 2>/dev/null)"; then
  api_health="$(jq -r '.status // "unknown"' <<< "${response}")"
fi

jq -n \
  --arg current "${current}" \
  --arg previous "${previous}" \
  --arg api "$(service_state universta-api)" \
  --arg web "$(service_state universta-web)" \
  --arg admin "$(service_state universta-admin)" \
  --arg nginx "$(service_state nginx)" \
  --arg mysql "$(service_state mysql)" \
  --arg apiHealth "${api_health}" \
  '{
    current: $current,
    previous: $previous,
    services: {
      api: $api,
      web: $web,
      admin: $admin,
      nginx: $nginx,
      mysql: $mysql
    },
    apiHealth: $apiHealth
  }'
