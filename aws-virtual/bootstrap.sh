#!/bin/bash
set -Eeuo pipefail
exec > >(tee -a /var/log/sabi-bootstrap.log) 2>&1
export DEBIAN_FRONTEND=noninteractive
install -d -m 0755 /etc/apt/keyrings /opt/sabi
apt-get update -qq
apt-get install -y -qq ca-certificates curl iptables caddy
# Ubuntu 24.04 restricts unprivileged user namespaces via AppArmor, which breaks the
# Chromium namespace sandbox (zygote chroot). Relax only this restriction, persistently.
printf 'kernel.apparmor_restrict_unprivileged_userns=0\n' > /etc/sysctl.d/99-sabi-chromium.conf
sysctl -p /etc/sysctl.d/99-sabi-chromium.conf
systemctl disable --now caddy
curl -fsSL --retry 3 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
cd /opt/sabi
# The launcher has downloaded and hash-checked the exact committed application files.
test -s server.mjs && test -s chromium-seccomp.json
chmod 700 egress-firewall.sh
cat >/etc/systemd/system/sabi-virtual.service <<'EOF'
[Unit]
Description=Sabi isolated Chromium service
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/sabi
EnvironmentFile=-/opt/sabi/.env
ExecStartPre=/opt/sabi/egress-firewall.sh
ExecStart=/usr/bin/docker compose up -d --no-build
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=180
[Install]
WantedBy=multi-user.target
EOF
install -m 0644 Caddyfile /etc/caddy/Caddyfile
# Do not let Caddy accept public requests until the separate browser is ready.
docker compose config -q
docker compose build browser
docker compose pull egress
systemctl daemon-reload
systemctl enable --now sabi-virtual
curl --fail --silent --show-error --retry 6 --retry-connrefused -H 'Host: sabi-virtual.nikanesalamat.ir' http://172.29.63.2:8080/health
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable --now caddy
