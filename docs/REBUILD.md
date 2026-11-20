<div dir="rtl">

# 🧭 راهنمای بازسازی کامل — از صفر تا دقیقاً همین استقرار

این سند طوری نوشته شده که بتوانی (یا هر کسی/هر ابزاری) **کل Sabi Browser را از هیچ، به همین نقطه** برساند: همین دو ورکر، همین تنظیمات، همین رفتار.

## پیش‌نیازها

- حساب Cloudflare با Workers Paid (موتور به Dynamic Worker Loaders نیاز دارد) و یک Zone (اینجا: `nikanesalamat.ir`)
- یک تیم Cloudflare Zero Trust (اینجا: `sahebkarami.cloudflareaccess.com`)
- توکن API با مجوزهای: Workers Scripts:Edit، Workers Routes/Domains، Access: Apps and Policies:Edit
- ابزار: `python3` (استقرار این مخزن فقط با `urllib` انجام می‌شود؛ wrangler لازم نیست ولی می‌شود استفاده کرد)

## نقشهٔ منابع (وضعیت هدف)

| منبع | نام/مقدار |
|---|---|
| ورکر موتور | `kitesurf-upstream` — دامنهٔ `kitesurf.nikanesalamat.ir` |
| ورکر اپ | `kitesurf-shared` — دامنهٔ `kitesurf-live.nikanesalamat.ir` |
| Durable Object | کلاس `SharedTab`، binding `SESSIONS`، migration tag `shared-tab-v1` (SQLite) |
| Service Binding | `ENGINE` → `kitesurf-upstream` / entrypoint `KitesurfEngine` / env `production` |
| Access App | hostname `kitesurf.nikanesalamat.ir`، نشست ۱ ساعته، policy: فقط ایمیل مالک (IdP: Cloudflare SSO) |
| workers.dev | برای **هر دو** ورکر خاموش (`enabled:false, previews_enabled:false`) |

## گام ۱ — موتور رسمی

1. ایمیج رسمی را از GHCR بگیر و لایه‌ها را با دایجست‌های `engine/IMAGE.json` تطبیق بده (release 2026.11.11، سورس‌کامیت در `engine/SOURCE.md`).
2. ماژول‌های dist ورکر و دارایی‌های `public/` (شامل کپی same-origin از DevTools در `/inspector`، بیلد پین‌شده در `engine/devtools_frontend.BUILD`) را از لایه‌ها استخراج کن — قواعد prune بالادستی را نگه دار.
3. `engine/wrangler.jsonc` را به‌کار ببر؛ این متغیرها باید **خالی** بمانند: `KITESURF_NATIVE_EVAL`، `KITESURF_ALLOW_PRIVATE_NETWORK`.
4. `engine/access-wrapper.mjs` را به‌عنوان ماژول اصلیِ جلوی موتور بگذار (مقدار `USER` = ایمیل خودت) تا هر درخواست HTTP/WS بدون کوکی/هدر معتبرِ Access رد شود. موتور `KitesurfEngine` را به‌عنوان entrypoint صادر می‌کند — service binding اپ به همین وصل می‌شود.
5. در Zero Trust یک Access App از نوع self-hosted روی هاست موتور بساز؛ policy فقط ایمیل مالک؛ مقدار AUD را داخل `access-wrapper.mjs` بگذار.
6. دامنهٔ سفارشی را به ورکر وصل کن و workers.dev و previews را خاموش کن.

## گام ۲ — اپ Sabi (این مخزن، پوشهٔ `app/`)

```bash
cd app
export CLOUDFLARE_API_TOKEN=... CF_ACCOUNT_ID=...
python3 deploy.py --first-time    # migration فقط بار اول
```

سپس دامنهٔ `kitesurf-live.<zone>` را به ورکر وصل کن (PUT به `/accounts/{acct}/workers/domains` با `{"environment":"production","hostname":...,"service":"kitesurf-shared","zone_id":...}`) و مطمئن شو workers.dev خاموش است (اسکریپت deploy خودش خاموش می‌کند).

### ثابت‌های رفتاری (داخل `worker.mjs`)

| ثابت | مقدار | معنی |
|---|---|---|
| `LIFE` | 12min | عمر پایهٔ نشست |
| `EXTEND` / `MAXLIFE` | 5min / 30min | هر تمدید / سقف از لحظهٔ شروع |
| `LIMIT` | 3 | نشست همزمان |
| starts/hour | 20 کل، 5 به‌ازای IP | پنجرهٔ لغزان یک‌ساعته (`WINDOW`) |
| `WIDTH×HEIGHT` | 1280×720 | viewport |
| فریم | JPEG q68، کش DO هر 450ms، پول کلاینت 550ms | |
| اکشن | صف ۱۲تایی، ۱۴ در ثانیه | |
| هدرهای فریم | `x-kitesurf-{width,height,revision,location,expires,viewers}` | |

### مدل توکن (مهم برای سازگاری)

```
token  (کنترل)   = 64hex تصادفی — فقط نزد کلاینت
view   (تماشا)   = sha256("view|" + token)
DO name          = sha256("session|" + view)
نقش تماشا        = هدر x-kitesurf-role: view ← فقط /api/frame
قالب لینک        = /#<token>  و  /#v<view>
```

کلاینت لینک تماشا را خودش با WebCrypto می‌سازد؛ سرور هم همین را در پاسخ `/api/start` برمی‌گرداند. اگر این مشتق‌سازی را عوض کنی، لینک‌های قدیمی می‌شکنند.

### هدرهای امنیتی صفحهٔ اصلی

CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` + `X-Frame-Options: DENY` + Permissions-Policy سخت‌گیرانه. API ها فقط روی هاست اصلی جواب می‌دهند؛ POSTها same-origin چک می‌شوند (`Origin` + `sec-fetch-site`).

## گام ۳ — راستی‌آزمایی

```bash
python3 app/smoke.py https://kitesurf-live.<zone>
```

چک‌لیست دستی:
- [ ] صفحهٔ اصلی بدون ورود باز می‌شود؛ `kitesurf.<zone>` به صفحهٔ Access می‌رود
- [ ] دو دستگاه با یک لینک، یک تب را می‌بینند و هر دو کنترل دارند
- [ ] لینک `#v…` فقط تصویر می‌دهد؛ action/extend/close با آن 403/410
- [ ] تمدید تا ۳۰ دقیقه و بعدش `capped:true`
- [ ] بعد از close همهٔ کلاینت‌ها 410 می‌گیرند
- [ ] `*.workers.dev` هر دو ورکر 404/خاموش

## نکته‌های عملیاتی

- محدودیت‌های خود موتور: ۱۰ دقیقه idle، سقف ۶۰ دقیقه برای هر اتصال CDP.
- تغییر نام‌گذاری DO (مدل توکن) نشست‌های زندهٔ همان لحظه را می‌اندازد — در ساعت کم‌ترافیک استقرار بده.
- `docs/DEPLOYMENT-HISTORY.md` سیر کامل تصمیم‌ها و نسخه‌ها را دارد؛ برای «چرا این‌طوری است؟» اول آن را بخوان.

</div>
