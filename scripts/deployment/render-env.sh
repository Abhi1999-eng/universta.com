#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_root

env_dir="${UNIVERSTA_ROOT}/shared/env"
install -d -o root -g universta -m 0750 "${env_dir}"

database_url="$(parameter database/url)"
jwt_access_secret="$(parameter auth/jwt-access-secret)"
jwt_refresh_secret="$(parameter auth/jwt-refresh-secret)"
admin_email="$(parameter admin/email)"
admin_password="$(parameter admin/password)"
web_origin="$(parameter runtime/web-origin)"
admin_origin="$(parameter runtime/admin-origin)"

umask 0027

api_pending="${env_dir}/api.env.pending"
web_pending="${env_dir}/web.env.pending"
admin_pending="${env_dir}/admin.env.pending"

# The API runs as a production environment. Besides the usual hardening, this is
# what makes the refresh cookie `Secure`, so it is only ever sent over the HTTPS
# origins below -- and it makes the demo-catalog seed guard refuse to run here.
{
  printf 'NODE_ENV=production\n'
  printf 'APP_ENV=production\n'
  printf 'DEPLOYMENT_ENV=demo\n'
  printf 'PORT=4000\n'
  printf 'DATABASE_URL=%s\n' "${database_url}"
  printf 'CORS_ORIGINS=%s,%s\n' "${web_origin}" "${admin_origin}"
  printf 'SWAGGER_ENABLED=false\n'
  printf 'JWT_ACCESS_SECRET=%s\n' "${jwt_access_secret}"
  printf 'JWT_REFRESH_SECRET=%s\n' "${jwt_refresh_secret}"
  printf 'JWT_ACCESS_TTL=15m\n'
  printf 'JWT_REFRESH_TTL=30d\n'
  printf 'AUTH_REFRESH_COOKIE_NAME=universta_admin_refresh\n'
  printf 'AUTH_MAX_FAILED_ATTEMPTS=5\n'
  printf 'AUTH_LOCK_MINUTES=15\n'
  printf 'SUPER_ADMIN_EMAIL=%s\n' "${admin_email}"
  printf 'SUPER_ADMIN_PASSWORD=%s\n' "${admin_password}"
  printf 'SUPER_ADMIN_FIRST_NAME=Demo\n'
  printf 'SUPER_ADMIN_LAST_NAME=Administrator\n'
  printf 'SEED_ADMIN_EMAIL=%s\n' "${admin_email}"
  printf 'SEED_ADMIN_PASSWORD=%s\n' "${admin_password}"
} > "${api_pending}"

{
  printf 'NODE_ENV=production\n'
  printf 'PORT=3000\n'
  printf 'HOSTNAME=127.0.0.1\n'
  # Loopback on purpose: this is the Next server talking to the API on the same
  # host, never a browser request, so it is not mixed content. Routing it back
  # out through the public HTTPS name would add a TLS handshake and a proxy hop
  # to every server-side fetch for no benefit.
  printf 'API_BASE_URL=http://127.0.0.1:4000\n'
  printf 'WEB_ORIGIN=%s\n' "${web_origin}"
} > "${web_pending}"

{
  printf 'NODE_ENV=production\n'
  printf 'PORT=3001\n'
  printf 'HOSTNAME=127.0.0.1\n'
  printf 'API_BASE_URL=http://127.0.0.1:4000\n'
  printf 'ADMIN_APP_ORIGIN=%s\n' "${admin_origin}"
  printf 'AUTH_REFRESH_COOKIE_NAME=universta_admin_refresh\n'
} > "${admin_pending}"

install -o root -g universta -m 0640 "${api_pending}" "${env_dir}/api.env"
install -o root -g universta -m 0640 "${web_pending}" "${env_dir}/web.env"
install -o root -g universta -m 0640 "${admin_pending}" "${env_dir}/admin.env"
rm -f "${api_pending}" "${web_pending}" "${admin_pending}"

unset database_url jwt_access_secret jwt_refresh_secret admin_email admin_password
log "Runtime environment files rendered from SSM Parameter Store."
