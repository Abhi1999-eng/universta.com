#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

web_origin="$(parameter runtime/web-origin)"
admin_origin="$(parameter runtime/admin-origin)"
api_origin="$(parameter runtime/api-origin)"

# Deployment smoke must stay independent of mutable catalog data. Admin users
# can legitimately archive/delete every Subject, Course, University, etc.; a
# deployment should not fail just because a previously seeded entity slug no
# longer exists. Exercise stable listing/system routes here and leave
# entity-detail coverage to seeded CI/E2E tests.
web_paths=(
  /
  /countries
  /subjects
  /courses
  /scholarships
  /study-abroad-consultants
  /success-stories
  /testimonials
  /events
  /counselling
)

for path in "${web_paths[@]}"; do
  curl --location --fail --silent --show-error --max-time 30 \
    --output /dev/null "${web_origin}${path}" ||
    fail "Public Web smoke failed for ${path}."
done

curl --location --fail --silent --show-error --max-time 30 \
  --output /dev/null "${admin_origin}/login" ||
  fail "Public Admin smoke failed."

api_health="$(curl --fail --silent --show-error --max-time 15 "${api_origin}/health")"
jq -e '.status == "ok" and .database == "up"' <<< "${api_health}" >/dev/null ||
  fail "Public API smoke failed."

log "Public Web, Admin, and API smoke checks passed."
