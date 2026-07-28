#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_root

sha="${1:-}"
bucket="${2:-}"
validate_sha "${sha}"
[[ -n "${bucket}" ]] || fail "Artifact bucket is required."

for command in aws curl flock jq mysql nginx node npm runuser sha256sum systemctl tar; do
  command -v "${command}" >/dev/null || fail "Missing host dependency: ${command}"
done

[[ "$(node --version)" =~ ^v2[4-9]\. ]] || fail "Node.js 24 or newer is required."
[[ "$(mysql --protocol=socket -uroot -NBe 'SELECT @@bind_address')" == "127.0.0.1" ]] ||
  fail "MySQL must listen only on 127.0.0.1."

systemctl is-active --quiet mysql || fail "MySQL is not active."
systemctl is-active --quiet nginx || fail "Nginx is not active."

for name in \
  database/password \
  database/url \
  auth/jwt-access-secret \
  auth/jwt-refresh-secret \
  admin/email \
  admin/password \
  runtime/web-origin \
  runtime/admin-origin \
  runtime/api-origin; do
  parameter "${name}" >/dev/null
done

aws s3api head-object \
  --region "${UNIVERSTA_REGION}" \
  --bucket "${bucket}" \
  --key "releases/${sha}/universta-${sha}.tar.gz" >/dev/null
aws s3api head-object \
  --region "${UNIVERSTA_REGION}" \
  --bucket "${bucket}" \
  --key "releases/${sha}/universta-${sha}.tar.gz.sha256" >/dev/null

log "Preflight passed for ${sha}."
