#!/usr/bin/env bash

set -euo pipefail

action="${1:-}"
sha="${2:-}"
bucket="${3:-}"
instance_id="${4:-}"
region="${5:-us-east-1}"

case "${action}" in
  deploy)
    [[ "${sha}" =~ ^[0-9a-f]{40}$ ]] || {
      printf 'Deploy requires an exact lowercase 40-character SHA.\n' >&2
      exit 1
    }
    [[ "${bucket}" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || {
      printf 'Deploy requires a valid artifact bucket.\n' >&2
      exit 1
    }
    remote_script="set -euo pipefail
# Recovery must happen before the artifact is downloaded or even its deploy
# scripts are extracted: a full root volume cannot create the temporary
# directory needed to run the normal deploy cleanup.
releases_root='/opt/universta/releases'
current_release=\$(readlink -f /opt/universta/current 2>/dev/null || true)
previous_release=\$(readlink -f /opt/universta/previous 2>/dev/null || true)
for protected in \"\${current_release}\" \"\${previous_release}\"; do
  case \"\${protected}\" in
    \"\${releases_root}\"/[0-9a-f]*)
      rm -rf \
        \"\${protected}/apps/web/.next/dev\" \
        \"\${protected}/apps/admin/.next/dev\"
      ;;
    '') ;;
    *) printf 'Refusing unexpected protected release path: %s\\n' \"\${protected}\" >&2; exit 1 ;;
  esac
done
if [[ -d \"\${releases_root}\" ]]; then
  for candidate in \"\${releases_root}\"/* \"\${releases_root}\"/.*.staging; do
    [[ -e \"\${candidate}\" ]] || continue
    [[ \"\${candidate}\" == \"\${current_release}\" || \"\${candidate}\" == \"\${previous_release}\" ]] && continue
    name=\$(basename \"\${candidate}\")
    if [[ \"\${name}\" =~ ^[0-9a-f]{40}\$ || \"\${name}\" =~ ^\\.[0-9a-f]{40}\\.staging\$ ]]; then
      rm -rf \"\${candidate}\"
    fi
  done
fi
temp_dir=\$(mktemp -d /tmp/universta-deploy.XXXXXX)
trap 'rm -rf \"\${temp_dir}\"' EXIT
artifact=\"\${temp_dir}/universta-${sha}.tar.gz\"
checksum=\"\${artifact}.sha256\"
aws s3 cp --region '${region}' --no-progress 's3://${bucket}/releases/${sha}/universta-${sha}.tar.gz' \"\${artifact}\"
aws s3 cp --region '${region}' --no-progress 's3://${bucket}/releases/${sha}/universta-${sha}.tar.gz.sha256' \"\${checksum}\"
tar -xzf \"\${artifact}\" -C \"\${temp_dir}\" ./scripts/deployment
bash \"\${temp_dir}/scripts/deployment/deploy.sh\" '${sha}' '${bucket}' \"\${artifact}\" \"\${checksum}\""
    ;;
  rollback)
    if [[ -n "${sha}" && ! "${sha}" =~ ^[0-9a-f]{40}$ ]]; then
      printf 'Rollback SHA must be empty or an exact lowercase 40-character SHA.\n' >&2
      exit 1
    fi
    remote_script="set -euo pipefail
bash /opt/universta/current/scripts/deployment/rollback.sh '${sha}'"
    ;;
  status)
    remote_script="set -euo pipefail
bash /opt/universta/current/scripts/deployment/status.sh"
    ;;
  qa-seed)
    qa_admin_password_b64="$(printf '%s' "${QA_FORGE_E2E_ADMIN_PASSWORD:-}" | base64 | tr -d '\n')"
    qa_password_b64="$(printf '%s' "${QA_FORGE_E2E_STUDENT_PASSWORD:-}" | base64 | tr -d '\n')"
    [[ -n "${qa_admin_password_b64}" && -n "${qa_password_b64}" ]] || {
      printf 'QA seed requires QA_FORGE_E2E_ADMIN_PASSWORD and QA_FORGE_E2E_STUDENT_PASSWORD.\n' >&2
      exit 1
    }
    remote_script="set -euo pipefail
QA_ADMIN_PASSWORD=\$(printf '%s' '${qa_admin_password_b64}' | base64 --decode)
QA_STUDENT_PASSWORD=\$(printf '%s' '${qa_password_b64}' | base64 --decode)
export QA_ADMIN_PASSWORD QA_STUDENT_PASSWORD
bash /opt/universta/current/scripts/deployment/qa-dataset.sh seed"
    ;;
  qa-report)
    remote_script="set -euo pipefail
bash /opt/universta/current/scripts/deployment/qa-dataset.sh report"
    ;;
  qa-cleanup)
    remote_script="set -euo pipefail
bash /opt/universta/current/scripts/deployment/qa-dataset.sh cleanup"
    ;;
  *)
    printf 'Action must be deploy, rollback, status, qa-seed, qa-report, or qa-cleanup.\n' >&2
    exit 1
    ;;
esac

[[ "${instance_id}" =~ ^i-[0-9a-f]+$ ]] || {
  printf 'A valid EC2 instance ID is required.\n' >&2
  exit 1
}

encoded_script="$(printf '%s' "${remote_script}" | base64 | tr -d '\n')"
remote_command="printf '%s' '${encoded_script}' | base64 --decode | bash"
parameters="$(jq -cn --arg command "${remote_command}" '{commands:[$command]}')"
command_id="$(
  aws ssm send-command \
    --region "${region}" \
    --instance-ids "${instance_id}" \
    --document-name AWS-RunShellScript \
    --comment "Universta ${action} ${sha}" \
    --parameters "${parameters}" \
    --timeout-seconds 3600 \
    --cloud-watch-output-config \
      'CloudWatchOutputEnabled=true,CloudWatchLogGroupName=/universta/demo/deploy' \
    --query 'Command.CommandId' \
    --output text
)"

printf 'SSM command: %s\n' "${command_id}"
command_status="Pending"
for _ in $(seq 1 720); do
  command_status="$(
    aws ssm get-command-invocation \
      --region "${region}" \
      --command-id "${command_id}" \
      --instance-id "${instance_id}" \
      --query 'Status' \
      --output text 2>/dev/null || true
  )"
  case "${command_status}" in
    Success|Failed|Cancelled|TimedOut) break ;;
  esac
  sleep 5
done

invocation="$(
  aws ssm get-command-invocation \
    --region "${region}" \
    --command-id "${command_id}" \
    --instance-id "${instance_id}" \
    --output json
)"

jq -r '.StandardOutputContent' <<< "${invocation}"
if [[ "${command_status}" != "Success" ]]; then
  jq -r '.StandardErrorContent' <<< "${invocation}" >&2
  printf 'SSM command finished with status %s.\n' "${command_status}" >&2
  exit 1
fi

printf 'SSM command completed successfully.\n'
