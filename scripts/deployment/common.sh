#!/usr/bin/env bash

set -euo pipefail

UNIVERSTA_ROOT="${UNIVERSTA_ROOT:-/opt/universta}"
UNIVERSTA_REGION="${AWS_REGION:-us-east-1}"
UNIVERSTA_PARAMETER_ROOT="${UNIVERSTA_PARAMETER_ROOT:-/universta/demo}"
UNIVERSTA_SERVICES=(universta-api universta-web universta-admin)

log() {
  printf '[universta-deploy] %s\n' "$*"
}

fail() {
  printf '[universta-deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "This command must run as root."
  fi
}

validate_sha() {
  local sha="${1:-}"
  [[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || fail "Expected an exact 40-character lowercase Git commit SHA."
}

parameter() {
  local name="$1"
  aws ssm get-parameter \
    --region "${UNIVERSTA_REGION}" \
    --name "${UNIVERSTA_PARAMETER_ROOT}/${name}" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text
}

atomic_symlink() {
  local target="$1"
  local link="$2"
  local pending="${link}.pending"

  rm -f "${pending}"
  ln -s "${target}" "${pending}"
  mv -Tf "${pending}" "${link}"
}

service_state() {
  local service="$1"
  systemctl is-active "${service}" 2>/dev/null || true
}
