#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

require_root

web_origin="$(parameter runtime/web-origin)"
admin_origin="$(parameter runtime/admin-origin)"
api_origin="$(parameter runtime/api-origin)"
web_host="${web_origin#*://}"
web_host="${web_host%%/*}"
admin_host="${admin_origin#*://}"
admin_host="${admin_host%%/*}"
api_host="${api_origin#*://}"
api_host="${api_host%%/*}"

install -d -o universta -g universta -m 0755 \
  "${UNIVERSTA_ROOT}/shared/logs" \
  "${UNIVERSTA_ROOT}/shared/cache/web" \
  "${UNIVERSTA_ROOT}/shared/cache/admin"
touch \
  "${UNIVERSTA_ROOT}/shared/logs/api.log" \
  "${UNIVERSTA_ROOT}/shared/logs/web.log" \
  "${UNIVERSTA_ROOT}/shared/logs/admin.log"
chown universta:universta "${UNIVERSTA_ROOT}/shared/logs/"*.log
chmod 0640 "${UNIVERSTA_ROOT}/shared/logs/"*.log

cat > /etc/systemd/system/universta-api.service <<'UNIT'
[Unit]
Description=Universta API
After=network-online.target mysql.service
Wants=network-online.target
Requires=mysql.service

[Service]
Type=simple
User=universta
Group=universta
WorkingDirectory=/opt/universta/current
EnvironmentFile=/opt/universta/shared/env/api.env
ExecStart=/usr/bin/npm --workspace apps/api run start:prod
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
StandardOutput=append:/opt/universta/shared/logs/api.log
StandardError=append:/opt/universta/shared/logs/api.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/universta-web.service <<'UNIT'
[Unit]
Description=Universta public Web
After=network-online.target universta-api.service
Wants=network-online.target

[Service]
Type=simple
User=universta
Group=universta
WorkingDirectory=/opt/universta/current
EnvironmentFile=/opt/universta/shared/env/web.env
ExecStart=/usr/bin/npm --workspace apps/web run start -- --hostname 127.0.0.1 --port 3000
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
StandardOutput=append:/opt/universta/shared/logs/web.log
StandardError=append:/opt/universta/shared/logs/web.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/universta-admin.service <<'UNIT'
[Unit]
Description=Universta Admin
After=network-online.target universta-api.service
Wants=network-online.target

[Service]
Type=simple
User=universta
Group=universta
WorkingDirectory=/opt/universta/current
EnvironmentFile=/opt/universta/shared/env/admin.env
ExecStart=/usr/bin/npm --workspace apps/admin run start -- --hostname 127.0.0.1 --port 3001
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
StandardOutput=append:/opt/universta/shared/logs/admin.log
StandardError=append:/opt/universta/shared/logs/admin.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/nginx/sites-available/universta <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${web_host} _;
    server_tokens off;
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${admin_host};
    server_tokens off;
    client_max_body_size 2m;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${api_host};
    server_tokens off;
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/universta /etc/nginx/sites-enabled/universta

cat > /etc/logrotate.d/universta <<'LOGROTATE'
/opt/universta/shared/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    su universta universta
}
LOGROTATE

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'JSON'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/universta/shared/logs/api.log",
            "log_group_name": "/universta/demo/api",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/opt/universta/shared/logs/web.log",
            "log_group_name": "/universta/demo/web",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/opt/universta/shared/logs/admin.log",
            "log_group_name": "/universta/demo/admin",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/universta/demo/nginx",
            "log_stream_name": "{instance_id}-access"
          },
          {
            "file_path": "/var/log/nginx/error.log",
            "log_group_name": "/universta/demo/nginx",
            "log_stream_name": "{instance_id}-error"
          }
        ]
      }
    }
  },
  "metrics": {
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}"
    },
    "metrics_collected": {
      "disk": {
        "measurement": ["used_percent"],
        "metrics_collection_interval": 60,
        "resources": ["/"]
      },
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      }
    }
  }
}
JSON

nginx -t

# The site file written above is HTTP-only, and it is rewritten on every
# deploy. TLS lives outside this repo: certbot owns the certificate and adds
# the `listen 443` blocks itself. So regenerating the file silently strips
# HTTPS and the deploy then fails its own smoke test with the site reachable
# only over plain HTTP -- which is exactly how it failed once.
#
# Re-apply the certificate that is already on the host. `certbot install` only
# edits nginx: it makes no ACME request, so nothing is re-issued and no rate
# limit is touched. On a host with no certificate yet this is skipped and the
# site stays HTTP-only, which is the correct starting state for one.
if command -v certbot >/dev/null 2>&1 &&
  certbot certificates 2>/dev/null | grep -q "Certificate Name: ${web_host}$"; then
  certbot install --nginx --redirect --non-interactive \
    --cert-name "${web_host}" >/dev/null
  nginx -t
  log "Re-applied the existing TLS certificate to the regenerated nginx site."
else
  log "No certbot certificate for ${web_host}; leaving nginx on HTTP only."
fi

systemctl daemon-reload
systemctl enable "${UNIVERSTA_SERVICES[@]}" nginx
systemctl reload nginx
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json >/dev/null

log "Systemd, Nginx, log rotation, and CloudWatch Agent configured."
