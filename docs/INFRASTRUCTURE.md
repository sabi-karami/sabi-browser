# Infrastructure and operations

No secrets are stored in this repository (passwords, keys and tokens live outside Git).

## Hosts

| Edition | Host | IPv4 | Notes |
|---|---|---|---|
| Sabi Browser | Cloudflare Worker `kitesurf-shared` | proxied | IPv6 through Cloudflare; service binding to the private engine |
| Virtual browser | Lightsail `sabi-virtual`, us-east-2a, `small_3_0` (2 GB) | `77.113.7.210` | `/opt/sabi`, systemd `sabi-virtual`, Caddy |
| Firefox | Lightsail `sabi-firefox`, us-east-2a, `small_3_0` (2 GB + 2 GB swap) | `18.218.68.2` | `/opt/sabi-fx`, systemd `sabi-fx`, `sabi-fx-auth`, `sabi-fx-restart.path`, `sabi-fx-update.timer`, Caddy |

Both Lightsail hosts: Ubuntu 24.04, dual-stack (IPv6 enabled), IMDS disabled, firewall 80/443 only. DNS records `sabi-virtual` and `firefox` are A + AAAA, unproxied, in the `nikanesalamat.ir` zone. TLS is automatic (Caddy / Let's Encrypt).

## Maintenance access

SSH (22) is closed. To work on a host: temporarily open 22 in the Lightsail firewall, connect with Lightsail short-lived SSH access, make the change, then close 22 again. Lightsail user-data runs under `sh`; run long installers with `systemd-run` and poll their log.

## Firefox operations

- Change the password: open `/__sabi/password` (needs the current password; ends all sessions). Reset from the server: `sudo python3 /opt/sabi-fx/set-password.py` (prints a new random password).
- Restart the browser: button in the page (or `POST /__sabi/restart`). It runs `docker restart sabi-firefox`; the profile volume is kept.
- Update: weekly timer, or `sudo systemctl start sabi-fx-update`.
- Add-ons: install from addons.mozilla.org inside the browser; policies in `firefox/policies.json`.
- Egress rules: `firefox/egress-firewall.sh` (chain `SABI-FX`), applied by `sabi-fx.service` before the container starts.

## Limits and costs

- `small_3_0` is about $12/month per host (the account refused larger Lightsail bundles). Firefox on 2 GB is usable but heavy pages may be slow.
- Virtual browser: 2 concurrent sessions, 6 starts/hour per IP, 30/hour in total, one browser launch at a time.
- Container egress is IPv4-only by design.
