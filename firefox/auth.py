#!/usr/bin/env python3
"""Sabi Firefox gate: Persian login page + signed-cookie verification for Caddy forward_auth."""
import base64, hashlib, hmac, html, json, os, secrets, time, threading, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

BASE = os.environ.get("SABI_FX_DIR", "/opt/sabi-fx")
CONF = os.path.join(BASE, "auth.json")
COOKIE = "sabi_fx"
TTL = 7 * 24 * 3600
MAX_FAILS, WINDOW = 5, 600
fails, lock = {}, threading.Lock()
UPSTREAM = "http://172.29.64.2:3000"
RUN = os.path.join(BASE, "run")
REQ = os.path.join(RUN, "restart-request")
ORIGIN = "https://firefox.nikanesalamat.ir"
state = {"started": 0.0}

def conf():
    with open(CONF) as f: return json.load(f)

def check_password(pw, c):
    h = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(c["salt"]), n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(h.hex(), c["hash"])

def sign(exp, c):
    key = bytes.fromhex(c["secret"]) + bytes.fromhex(c["hash"])
    return hmac.new(key, str(exp).encode(), hashlib.sha256).hexdigest()

def valid_cookie(header):
    try:
        for part in (header or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == COOKIE:
                exp, _, sig = v.partition(".")
                if int(exp) > time.time() and hmac.compare_digest(sig, sign(int(exp), conf())):
                    return True
    except Exception:
        pass
    return False

FONT = open(os.path.join(BASE, "vazirmatn.woff2"), "rb").read()
FONT2 = open(os.path.join(BASE, "estedad.woff2"), "rb").read()
PAGE = open(os.path.join(BASE, "login.html"), encoding="utf-8").read()
UIJS = open(os.path.join(BASE, "ui.js"), "rb").read()
PWPAGE = open(os.path.join(BASE, "password.html"), encoding="utf-8").read()

class H(BaseHTTPRequestHandler):
    server_version = "sabi-gate"
    sys_version = ""
    def log_message(self, *a): pass
    def ip(self):
        return (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
    def send(self, code, body=b"", ctype="text/html; charset=utf-8", extra=()):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in extra: self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD": self.wfile.write(body)
    def page(self, code=200, error="", ok="", tpl=None):
        err = f'<p class="err" role="alert">{html.escape(error)}</p>' if error else ""
        if ok: err = f'<p class="ok" role="status">{html.escape(ok)}</p>'
        body = (tpl or PAGE).replace("<!--ERR-->", err).encode()
        self.send(code, body, extra=[
            ("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"),
            ("X-Frame-Options", "DENY"), ("X-Content-Type-Options", "nosniff"), ("Referrer-Policy", "no-referrer"),
            ("Strict-Transport-Security", "max-age=31536000")])
    def do_HEAD(self): self.do_GET()
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/__sabi/verify":
            if valid_cookie(self.headers.get("Cookie")): return self.send(204)
            return self.send(302, b"", extra=[("Location", "/__sabi/login")])
        if p == "/__sabi/ui.js":
            return self.send(200, UIJS, "application/javascript; charset=utf-8")
        if p == "/__sabi/index":
            if not valid_cookie(self.headers.get("Cookie")):
                return self.send(302, b"", extra=[("Location", "/__sabi/login")])
            try:
                with urllib.request.urlopen(UPSTREAM + "/", timeout=8) as r: body = r.read().decode("utf-8", "replace")
            except Exception:
                return self.send(503, "<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=3><body dir=rtl style='font-family:sans-serif;background:#15122b;color:#fff;display:grid;place-items:center;height:100vh'>فایرفاکس در حال راه‌اندازی است…".encode())
            tag = '<script src="/__sabi/ui.js" defer></script>'
            body = body.replace("</body>", tag + "</body>", 1) if "</body>" in body else body + tag
            return self.send(200, body.encode())
        if p == "/__sabi/status":
            if not valid_cookie(self.headers.get("Cookie")): return self.send(401, b"{}", "application/json")
            ok = False
            try: done = os.path.getmtime(os.path.join(RUN, "restart-done"))
            except OSError: done = 0
            idle = state["started"] == 0 or (done >= state["started"] and time.time() - done > 4)
            if not os.path.exists(REQ) and idle:
                try:
                    with urllib.request.urlopen(UPSTREAM + "/", timeout=3) as r: ok = r.status == 200
                except Exception: ok = False
            return self.send(200, json.dumps({"ready": ok}).encode(), "application/json")
        if p == "/__sabi/login": return self.page()
        if p == "/__sabi/password": return self.page(tpl=PWPAGE)
        if p == "/__sabi/vazirmatn.woff2":
            return self.send(200, FONT, "font/woff2", [("Cache-Control", "public, max-age=31536000, immutable")])
        if p == "/__sabi/estedad.woff2":
            return self.send(200, FONT2, "font/woff2", [("Cache-Control", "public, max-age=31536000, immutable")])
        if p == "/__sabi/logout":
            return self.send(302, b"", extra=[("Location", "/__sabi/login"),
                ("Set-Cookie", f"{COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax")])
        self.send(404, b"not found", "text/plain")
    def do_POST(self):
        if self.path.split("?")[0] == "/__sabi/password": return self.change_password()
        if self.path.split("?")[0] == "/__sabi/restart": return self.restart()
        if self.path.split("?")[0] != "/__sabi/login": return self.send(404, b"not found", "text/plain")
        n = min(int(self.headers.get("Content-Length") or 0), 2048)
        pw = (parse_qs(self.rfile.read(n).decode(errors="ignore")).get("password") or [""])[0]
        ip, now = self.ip(), time.time()
        with lock:
            for k in list(fails):
                fails[k] = [t for t in fails[k] if now - t < WINDOW]
                if not fails[k]: del fails[k]
            total = sum(len(v) for v in fails.values())
            if len(fails.get(ip, [])) >= MAX_FAILS or total >= 40:
                return self.page(429, "تعداد تلاش‌های ناموفق زیاد بود. چند دقیقه بعد دوباره امتحان کنید.")
        c = conf()
        if check_password(pw, c):
            with lock: fails.pop(ip, None)
            exp = int(now + TTL)
            return self.send(303, b"", extra=[("Location", "/"),
                ("Set-Cookie", f"{COOKIE}={exp}.{sign(exp, c)}; Max-Age={TTL}; Path=/; Secure; HttpOnly; SameSite=Lax")])
        with lock: fails.setdefault(ip, []).append(now)
        time.sleep(0.6)
        self.page(401, "رمز عبور درست نیست.")

def change_password(self):
    n = min(int(self.headers.get("Content-Length") or 0), 4096)
    f = parse_qs(self.rfile.read(n).decode(errors="ignore"))
    cur, new, rep = [(f.get(k) or [""])[0] for k in ("current", "new", "confirm")]
    ip, now = self.ip(), time.time()
    with lock:
        for k in list(fails):
            fails[k] = [t for t in fails[k] if now - t < WINDOW]
            if not fails[k]: del fails[k]
        if len(fails.get(ip, [])) >= MAX_FAILS or sum(len(v) for v in fails.values()) >= 40:
            return self.page(429, "تعداد تلاش‌های ناموفق زیاد بود. چند دقیقه بعد دوباره امتحان کنید.", tpl=PWPAGE)
    c = conf()
    if not check_password(cur, c):
        with lock: fails.setdefault(ip, []).append(now)
        time.sleep(0.6)
        return self.page(401, "رمز فعلی درست نیست.", tpl=PWPAGE)
    if new != rep: return self.page(400, "رمز جدید و تکرار آن یکسان نیستند.", tpl=PWPAGE)
    if not 10 <= len(new) <= 128: return self.page(400, "رمز جدید باید بین ۱۰ تا ۱۲۸ نویسه باشد.", tpl=PWPAGE)
    if new == cur: return self.page(400, "رمز جدید باید با رمز فعلی فرق داشته باشد.", tpl=PWPAGE)
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(new.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    data = json.dumps({"salt": salt.hex(), "hash": h.hex(), "secret": c["secret"]})
    with lock:
        with open(CONF, "r+") as fh:
            fh.seek(0); fh.truncate(); fh.write(data); fh.flush(); os.fsync(fh.fileno())
        fails.pop(ip, None)
    self.page(200, ok="رمز با موفقیت تغییر کرد. همهٔ نشست‌های قبلی خارج شدند؛ با رمز جدید وارد شوید.", tpl=PWPAGE)

H.change_password = change_password

def restart(self):
    js = [("Content-Type", "application/json")]
    if not valid_cookie(self.headers.get("Cookie")): return self.send(401, b'{"error":"auth"}', "application/json")
    org = self.headers.get("Origin")
    if self.headers.get("X-Sabi-Action") != "restart" or (org and org != ORIGIN):
        return self.send(403, b'{"error":"forbidden"}', "application/json")
    with lock:
        if time.time() - state["started"] < 20:
            return self.send(429, b'{"error":"busy"}', "application/json")
        state["started"] = time.time()
    try:
        with open(REQ, "w") as f: f.write(str(int(time.time())))
    except Exception:
        return self.send(500, b'{"error":"failed"}', "application/json")
    self.send(202, b'{"restarting":true}', "application/json")

H.restart = restart

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 9100), H).serve_forever()
