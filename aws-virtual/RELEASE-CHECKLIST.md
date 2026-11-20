# AWS virtual browser — runbook and release record

Status: deployed and published. Host: Lightsail instance `sabi-virtual`, region `us-east-2`, plan `small_3_0` (2 GB, about $12/month), Ubuntu 24.04, static IP, instance metadata disabled, public TCP 80/443 only. DNS: `sabi-virtual.nikanesalamat.ir` (A record, not proxied). The entry link on the original site was published after the checks below passed.

## Verified on the deployed host
- `python3 smoke.py`: UI, font, real Chromium JPEG frames, tab lifecycle, passive inspection, view-only permissions, extension and cleanup.
- The egress proxy answers 403 to CONNECT requests for metadata, loopback, private, the host's own address, this site's own domain, and non-443 ports; public HTTPS on 443 is allowed.
- `http://` and private or metadata destinations are rejected by `/api/start` with HTTP 400; cross-origin and missing-Origin starts get 403.
- Containers run read-only with all capabilities dropped, memory and PID limits, and the Chromium sandbox enabled.

## Host-specific requirements (both applied by `bootstrap.sh` / `chromium-seccomp.json`)
- Ubuntu 24.04 restricts unprivileged user namespaces through AppArmor; Chromium's sandbox needs `kernel.apparmor_restrict_unprivileged_userns=0` (persisted in `/etc/sysctl.d/99-sabi-chromium.conf`).
- The `chroot` syscall must be allowed unconditionally in the seccomp profile (the container has no capabilities, so a capability-conditioned rule never matches). Never disable the sandbox to work around launch failures.

## Operating notes
- Lightsail user data runs under `sh`, not `bash`; run `bootstrap.sh` explicitly (for example through SSH and `systemd-run`) rather than relying on user data.
- Keep SSH (22) closed. Open it only briefly for maintenance and close it again.
- Limits: 2 concurrent sessions, 6 session starts per client IP per hour, 30 per hour in total. Only one browser launch runs at a time, so a simultaneous second start can receive 429 for a few seconds.
- Stopping a Lightsail instance does not stop its plan charges; delete the instance and release the static IP to stop billing.
- To remove the entry link, revert the "مرورگر مجازی" anchor in `app/ui.html` and redeploy the original Worker.

## Clipboard and location
- Paste: `kind: paste` (up to 16,000 characters, inserted in 2,000-character chunks). The UI offers a paste button, accepts Ctrl+V on the page, and the text box sends through the same path. Action bodies are limited to 96 KB; other bodies stay at 4 KB.
- Copy out: `POST /api/copy` (controller only) returns the current selection (or the selected range of the focused text field) so the UI can place it on the visitor's clipboard.
- Location: the browser context uses `en-US` and `America/New_York`, matching the host's real address (Columbus, Ohio, AWS us-east-2). `GET /api/where` looks the host's exit address up through the egress proxy (ipinfo.io), caches it for six hours, and the header badge displays the real result. If the host ever moves, update the locale and time zone constants in `server.mjs`.
