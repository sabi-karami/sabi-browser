# Third-party notices

| Component | License | Where |
|---|---|---|
| [Cloudflare Kitesurf](https://github.com/cloudflare/kitesurf) | Upstream license (see their repo) | The browser engine. **Not vendored here** — deployed from the official GHCR image, pinned in `engine/IMAGE.json` and `engine/SOURCE.md` (release 2026.11.11, commit `01d2266…`). The 22 upstream license files were verified during extraction. |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 | MIT © Kazuhiko Arase | Minified inline in `app/ui.html` (QR rendering is fully client-side; session tokens never leave the page). |
| Chrome DevTools frontend | BSD (Chromium) | Served by the private engine only; pinned build per `engine/devtools_frontend.BUILD`. |

Everything else in this repository: MIT (see `LICENSE`).
