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
  *)
    printf 'Action must be deploy, rollback, or status.\n' >&2
    exit 1
    ;;
esac

[[ "${instance_id}" =~ ^i-[0-9a-f]+$ ]] || {
  printf 'A valid EC2 instance ID is required.\n' >&2
  exit 1
}

printf -v remote_command 'bash -lc %q' "${remote_script}"
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
