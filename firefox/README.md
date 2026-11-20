# Sabi Firefox (firefox.nikanesalamat.ir)

A full, current Firefox (linuxserver/firefox, KasmVNC/Selkies web desktop) on its own Lightsail instance in us-east-2.

- `Dockerfile` + `policies.json`: official image + Firefox policies (uBlock Origin pre-installed and removable, every AMO add-on installable, telemetry/studies/Pocket off, no auto-updater inside the container).
- `compose.yml`: hardened container (seccomp profile shared with the Chromium service, all caps dropped except a minimal set, no-new-privileges, memory/pids limits, fixed bridge `sabi-fx` 172.29.64.0/28, no published ports, named volume `fx-config` = persistent profile).
- `egress-firewall.sh`: DOCKER-USER chain `SABI-FX`: public internet only (80/443, DNS only to 1.1.1.1/8.8.8.8), private/link-local/metadata/own-IP blocked, container cannot open new connections to the host.
- `auth.py`, `login.html`, `set-password.py`: Persian login gate (scrypt hash, HMAC-signed HttpOnly/Secure cookie, rate limiting). Caddy `forward_auth` protects every request including the websocket.
- `Caddyfile`: TLS (Let's Encrypt) + gate + reverse proxy to 172.29.64.2:3000.
- `*.service`, `*.timer`, `update.sh`: systemd units; weekly pull of the newest image (Mon 04:30 UTC).

No secrets are stored here. Rotate the password: `sudo python3 /opt/sabi-fx/set-password.py` (prints the new one, logs everybody out).
Bootstrap on a fresh Ubuntu 24.04: install docker-ce, caddy, python3, set `kernel.apparmor_restrict_unprivileged_userns=0`, copy files to /opt/sabi-fx, create user `sabifx`, `.env` with `SABI_OWN_IP=<public ip>`, enable the units.

- Restart button: the gate injects `ui.js` into the Selkies page (floating «ری‌استارت فایرفاکس» button). POST `/__sabi/restart` (cookie + `X-Sabi-Action` header + same-origin check) drops `/opt/sabi-fx/run/restart-request`; `sabi-fx-restart.path` runs `restart-firefox.sh` (root) which does `docker restart sabi-firefox` and touches `restart-done`; `/__sabi/status` reports readiness.
