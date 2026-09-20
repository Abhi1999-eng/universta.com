#!/usr/bin/env bash
#
# Run the Playwright acceptance suite locally, the way CI runs it.
#
#   scripts/run-e2e.sh                          # everything
#   scripts/run-e2e.sh study-abroad.spec.ts     # one spec
#   scripts/run-e2e.sh --list                   # what would run
#
# Two things make a local run fail in ways that look like broken application
# code, and this script exists mostly to keep them fixed.
#
# 1. `apps/api/.env` carries NODE_ENV and PORT. Sourcing the whole file, which
#    is the obvious way to reach the seeded admin credentials, exports
#    NODE_ENV=development into the `next build` that Playwright runs for the
#    admin and web apps. That build then fails prerendering /_global-error with
#    "Cannot read properties of null (reading 'useContext')" -- a broken shell
#    wearing the costume of a broken app. Only the three values actually needed
#    are lifted out below.
#
# 2. The browser binaries are versioned with @playwright/test. A cache left by
#    an older version makes every test fail at launch, which reads like the
#    whole suite regressing. The install below is a no-op once they match.
#
# Ports follow CI (web 3000, admin 3001, API 4000). When something already owns
# a port, set E2E_WEB_BASE_URL / E2E_ADMIN_BASE_URL / E2E_API_BASE_URL and the
# specs, the servers and the API's CORS list all follow -- they are derived
# from these, never repeated.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/apps/api/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "apps/api/.env is missing. See docs/LOCAL_SETUP.md." >&2
  exit 1
fi

# One value out of the env file, without exporting anything else in it.
from_env() {
  local value
  value="$(grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true)"
  # Strip one layer of surrounding quotes, if the file uses them.
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  printf '%s' "$value"
}

export E2E_WEB_BASE_URL="${E2E_WEB_BASE_URL:-http://localhost:3000}"
export E2E_ADMIN_BASE_URL="${E2E_ADMIN_BASE_URL:-http://localhost:3001}"
export E2E_API_BASE_URL="${E2E_API_BASE_URL:-http://127.0.0.1:4000}"

export E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-$(from_env SEED_ADMIN_EMAIL)}"
export E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-$(from_env SEED_ADMIN_PASSWORD)}"
export DATABASE_URL="${DATABASE_URL:-$(from_env DATABASE_URL)}"

if [ -z "$E2E_ADMIN_EMAIL" ] || [ -z "$E2E_ADMIN_PASSWORD" ]; then
  echo "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in apps/api/.env." >&2
  exit 1
fi

# The API rejects an origin it was not told about, and the assessment POST
# comes from the web app. On the default ports this matches what the env file
# already allows; on any other port it is the difference between a green run
# and a 403 that looks like a broken lead funnel.
export CORS_ORIGINS="${CORS_ORIGINS:-$E2E_WEB_BASE_URL,$E2E_ADMIN_BASE_URL}"

cd "$ROOT/apps/admin"
npx playwright install chromium >/dev/null 2>&1 || {
  echo "Could not install the Playwright browsers. Run: npx playwright install chromium" >&2
  exit 1
}

echo "web   $E2E_WEB_BASE_URL"
echo "admin $E2E_ADMIN_BASE_URL"
echo "api   $E2E_API_BASE_URL"
exec npx playwright test "$@"
