# Sabi Browser · مرورگر مجازی

Separate public HTTPS edition running Chromium on AWS Lightsail. It shares the original Sabi interface and its screenshot, view-only, control, QR, fullscreen, touch and expiry features, but never uses original Sabi sessions or services.

- Two concurrent isolated Chromium processes. New sessions expire after 12 minutes and can be extended up to 30 minutes total. Per-client and global session creation limits protect the public service.
- HTTPS public destinations only. Chromium is non-root and must successfully start its sandbox; there is no no-sandbox fallback. Chromium has an internal Docker network, with only a filtered HTTPS proxy for external websites. The proxy filters resolved addresses and connects to the validated IP. Host and instance metadata traffic are blocked. Browser DevTools is not a network endpoint.
- Each browser has a temporary profile, no download persistence, no browser permissions, and no account credentials. Treat control/view links as private and do not enter sensitive information in a shared session.
- Caddy terminates TLS. Use `sabi-virtual.nikanesalamat.ir` with an A record to the host and allow TCP 80/443 only. The Docker service does not publish ports. Run `egress-firewall.sh` after Docker starts and before starting containers; `compose.yml` must be run with this firewall, not by itself.
- Font: Vazirmatn, SIL OFL 1.1; see `OFL.txt`.
