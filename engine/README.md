<div dir="rtl">

# موتور خصوصی (kitesurf-upstream)

این پوشه پیکربندی اجرای **Kitesurf رسمی و دست‌نخورده** به‌صورت خصوصی است. خود موتور اینجا کپی نشده — از ایمیج رسمی GHCR نصب می‌شود.

- `IMAGE.json` — دایجست‌های پین‌شدهٔ ایمیج رسمی (release **2026.11.11**)
- `SOURCE.md` — کامیت و هش آرشیو سورس بالادستی
- `wrangler.jsonc` — پیکربندی ورکر موتور (همان بالادستی؛ متغیرهای native eval و private network خاموش)
- `access-wrapper.mjs` — رَپری که قبل از رسیدن درخواست به موتور، **توکن امضاشدهٔ Cloudflare Access** را اعتبارسنجی می‌کند (issuer/audience/expiry/type:app با RS256). مقدار `USER` را با ایمیل خودت جایگزین کن.
- `devtools_frontend.BUILD` — بیلد پین‌شدهٔ DevTools frontend

مراحل کامل در [docs/REBUILD.md](../docs/REBUILD.md).

> ⚠️ موتور را هرگز بدون احراز هویت عمومی نکن؛ بازدیدکننده‌ها می‌توانند با هویت تو درخواست خروجی بفرستند و هزینهٔ Dynamic Workers مصرف کنند. مسیر درست همین است: موتور پشت Access، و فقط اپ `app/` عمومی.

</div>
