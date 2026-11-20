# Upstream Cloudflare Kitesurf

- Production: https://kitesurf.nikanesalamat.ir/?inspect=1, Worker `kitesurf-upstream`.
- Official image release 2026.11.11, git `01d22668179931e9d0ba086fbaba96ebb7e7630a`; official pinned inspector.
- Hostname Access app `847fb173-e132-4707-a874-b9849ea6ae69`; only authorized owner account via Cloudflare SSO. No OTP IdP. Native eval and private networks disabled; workers.dev and previews off.
- 2026-11-20: Access audit confirmed that the owner was allowed at 11:29:12Z while the original Worker rejected the request. Updated validation accepts a correctly signed Access application token from the header or app cookie, with expected issuer/audience, expiration, user and signature checks. Unit tests passed. Deployed at 11:31:24Z (version `9d6042e1-28f1-4bf3-bb98-f10a73f88166`). HTTP (including inspector assets and an invalid cookie) still redirected to Access. Unauthenticated WebSocket did not upgrade. Authenticated browser retry not yet confirmed.

## Passwordless shared tab

- User-facing URL: https://sabi-browser.nikanesalamat.ir/ on Worker `kitesurf-shared`; no Cloudflare Access, email, password, or code at this hostname. The original primary Worker and its Access policy were not changed.
- Private upstream Kitesurf engine is used through a Cloudflare Service Binding. Raw CDP routes are not exposed. Shared clients see the same Kitesurf target via a single Durable Object-managed connection.
- Session link uses a random capability in the URL fragment; the browser sends it in the Authorization header. It is not included in logs, and images/credentials are not persisted by the shared layer. No capabilities saved in the project volume.
- Lifetime at most 12 minutes; close invalidates it on every client. Public startup quota: at most three simultaneous sessions, twenty starts per rolling hour, five starts per rolling hour per observed IP bucket. Pages, cookies and inputs are not restored after termination.
- Verified on live: passwordless UI; two clients sharing and controlling one screen; changed pixels on a second site; rejects private literal URL, cross-origin start, unsupported commands, requests without a session capability; after close both clients lose access.

### Polish update (2026-11-20)

Deployed to `kitesurf-shared` (etag `c848e51cb7d0…`), live-verified (HTML byte-match, start/frame/close/410 smoke, subdomain still disabled). Changes:

- **UI head**: meta description, Open Graph tags, inline SVG data-URI favicon.
- **New workspace controls**: frame **download** button (`#shot`, saves current JPEG) and **fullscreen** toggle (`#full`, hidden when unsupported; `.viewport:fullscreen` uses object-fit: contain).
- **Landing**: 3-step guide row (enter URL / copy session link / view & control from any device).
- **Timer**: turns red (`#timer.low`) when ≤60s remain.
- **Latency**: client frame poll 650→550 ms; DO frame capture interval 575→450 ms.
- **Worker**: CSP `img-src blob: data:` (allows favicon data URI).
- Fresh previews: `shared/polish-desktop.png` (1440×900 dark), `shared/polish-mobile.png` (390×844 light), smoke frame `shared/polish-smoke.jpg`, deploy record `shared/polish-deploy.json`.

### Feature update (2026-11-20, second pass)

Deployed to `kitesurf-shared` (final etag `98737f44d117…`), live-verified (HTML byte-match; full smoke: start, frame, viewers 1→2, extend chain to cap, origin-less extend 403, close 204, extend-after-close 410; subdomain still disabled). New capabilities:

- **QR session link**: inline `qrcode-generator` 1.4.4 (MIT, Kazuhiko Arase; minified with terser, matrix verified against original and decoded with zxing-cpp). Rendered client-side on a canvas; the capability token never leaves the page.
- **Share button**: `navigator.share` when available (hidden otherwise).
- **Session extension**: `/api/extend` (origin-checked POST + Bearer) adds 5 min per call, capped at 30 min from boot (`EXTEND`, `MAXLIFE`); lease stores `born`; alarm re-armed; quota DO gets a `/renew` route so active-session accounting follows the extended expiry. UI button next to the timer; disables at cap.
- **Viewer count**: clients send a random `x-kitesurf-client` id with frame polls; the DO tracks ids seen in the last 15 s and returns `x-kitesurf-viewers`; UI shows “N دستگاه متصل” when N>1.
- **Theme toggle**: auto/light/dark cycle in the header, persisted in localStorage (`ks-theme`); dark palette duplicated under `:root[data-theme=dark]` and the media query gated with `:not([data-theme=light])`.
- **Quick-start chips** (Google, Wikipedia-fa, YouTube, GitHub) on the landing card.
- **Fix**: workspace height budget 260→332 px so the window’s bottom bar fits short viewports.
- Artifacts: `shared/qr-lib.js`, `shared/qr-lib.min.js`, `shared/qr-test.json`, `shared/features-deploy.json`, previews `shared/features-desktop.png` (dark), `shared/features-mobile.png` (light), `shared/features-workspace.png` (dark workspace).

### View-only links + touch scroll (2026-11-20, third pass)

Deployed to `kitesurf-shared` (etag `8cf772f5c4a5…`), live-verified with 10 checks (HTML byte-match; control frame/action; view frame OK; view action 403; view-token-as-control 410; view extend 403; close 204; view frame after close 410; server view token equals client derivation; subdomain still disabled).

- **View-only guest link**: `/#v<64hex>`. On start the worker returns `{token, view}` where `view = sha256('view|'+token)`; the DO name is now `sha256('session|'+view)`, so the control role derives the view hash first and the view role maps directly. A viewer presenting the view token as control resolves to a non-existent DO (410); the worker also gates the `view` role (`x-kitesurf-role: view`) to `/api/frame` only (403 otherwise). Control clients compute the view link locally with WebCrypto — tokens never leave the browser. UI: eye button copies the view link, QR dialog has control/view tabs, view mode hides all control affordances (`.workspace.view .ctl`), shows a “فقط تماشا” badge, and disables pointer/keyboard/paste senders. Note: sessions that were alive during this deploy were dropped by the DO-naming change (12-minute lifetime, acceptable).
- **Touch scroll**: on touch pointers, dragging the screen sends batched wheel deltas (scaled to frame pixels) instead of mouse drags, and a tap sends a click — mobile pages now scroll naturally. Mouse behaviour (drag-select etc.) unchanged; wheel batching refactored into `queueWheel`.
- Artifacts: `shared/viewonly-deploy.json`, preview `shared/viewonly-workspace.png` (dark, view mode).

### Domain move (2026-11-20)

- App now served at https://sabi-browser.nikanesalamat.ir/ (worker domain id `205f60d6beb601680b7c416a31bf71f351dca4a8`); `HOST` constant updated and redeployed (etag `f77afdac5db1…`), smoke-tested on the new origin.
- Old hostname `kitesurf-live.nikanesalamat.ir` fully removed (workers custom domain + DNS); confirmed dead.
- Engine hostname `kitesurf.nikanesalamat.ir` kept: it is in use as the owner-only, Access-protected DevTools entry and is documented in the repo.

## Virtual browser and Firefox editions (2026-11-20)

### Virtual browser (Chromium on AWS Lightsail)
- AWS account `954903081714`, Lightsail instance `sabi-virtual` (us-east-2a, `small_3_0`, Ubuntu 24.04), static IP `77.113.7.210` (IPinfo: Columbus, Ohio, US). IMDS disabled; public ports 80/443 only; SSH is opened briefly for maintenance and closed again.
- Docker compose (`browser` + `egress` proxy) behind Caddy (Let's Encrypt). Host fixes: `kernel.apparmor_restrict_unprivileged_userns=0` (persisted), seccomp profile allows `chroot` unconditionally.
- Smoke test and security probes passed (http://, metadata IP, private IP, own domain rejected).
- Clipboard: `kind:'paste'` action (≤16000 chars), controller-only `POST /api/copy`; verified Persian round trip. US presentation: context `locale en-US`, `timezoneId America/New_York`, `GET /api/where`, header IP badge and an `ipinfo.io` chip. The HeadlessChrome user agent is intentionally untouched.

### Firefox edition
- Instance `sabi-firefox` (us-east-2a, `small_3_0` + 2 GB swap; `medium_3_0` was refused by the account), static IP `18.218.68.2`, DNS `firefox.nikanesalamat.ir` (A + AAAA, unproxied).
- Image `linuxserver/firefox:latest` (Selkies web desktop) + `policies.json`; Firefox 160.0.1 at deploy time. uBlock Origin pre-installed (removable); any AMO add-on installable; persistent profile in volume `fx-config`.
- Hardened container (custom seccomp, caps dropped, no-new-privileges, limits), dedicated bridge `sabi-fx`, egress allowed only to the public internet (80/443, DNS to 1.1.1.1/8.8.8.8); private ranges, metadata and the host itself blocked.
- Persian login gate (`auth.py`): scrypt hash, signed HttpOnly cookie, rate limiting; self-service password change at `/__sabi/password`; floating restart button injected into the page (`ui.js`) which makes a root-side path unit run `docker restart`.
- Weekly updater timer (Mon 04:30 UTC) pulls the newest image and recreates the container if it changed.
- Main site header now links to both editions.

### IPv6
- Lightsail instances are dual-stack; AAAA records added for `sabi-virtual` and `firefox`; the main site already had IPv6 through Cloudflare. Container egress stays IPv4-only so the US IP presentation is unchanged.

### Brand spelling
- The Persian spelling is «صابی»; corrected in the UI, the Firefox pages and the docs.

## ۲۰ نوامبر ۲۰۲۶ — طراحی «رصدخانه» (Observatory)

- **صابی ابری** (`kitesurf-shared`): رابط کاملاً بازطراحی شد؛ اسطرلاب متحرک، آسمان ستاره‌ای تعاملی، تم تیره/روشن، پنج رنگ تأکید، پالت فرمان (`Ctrl/⌘+K` یا `/`)، سایت‌های اخیر، تاریخ و ساعت شمسی، نوار سه دروازه و کارت‌های معرفی. فونت عنوان: Aref Ruqaa (مسیر `/fonts/aref-ruqaa.woff2`).
- **مرورگر مجازی** (`sabi-virtual`): همان لایهٔ طراحی روی رابط موجود؛ `server.mjs` مسیر فونت جدید را سرو می‌کند و `Dockerfile` فایل فونت را کپی می‌کند. تست دود (`smoke.py`) پس از استقرار موفق بود.
- **فایرفاکس** (`sabi-firefox`): صفحه‌های ورود و تغییر رمز بازطراحی شدند (نمایشگر قدرت رمز، نمایش/پنهان‌کردن رمز، پیوند نسخه‌ها)؛ دکمهٔ ری‌استارت با همان هویت رنگی؛ `auth.py` مسیر `/__sabi/aref-ruqaa.woff2` را سرو می‌کند. پشتیبان فایل‌های قبلی روی سرور: `/opt/sabi-fx/backup-pre-design`.
- منبع طراحی: `app/design/` (CSS و قطعه‌های HTML/JS و `build.py`). پورت SSH فقط برای نگهداری باز و دوباره بسته شد.
