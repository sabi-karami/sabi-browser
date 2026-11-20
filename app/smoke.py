#!/usr/bin/env python3
"""Live smoke test for Sabi Browser. Run: python3 smoke.py https://kitesurf-live.nikanesalamat.ir"""
import hashlib, json, sys, time, urllib.request, urllib.error

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "https://kitesurf-live.nikanesalamat.ir"
UA = {"User-Agent": "Mozilla/5.0 (smoke) Chrome/130.0"}

def req(path, data=None, method=None, extra=None):
    h = dict(UA); h.update(extra or {})
    return urllib.request.urlopen(urllib.request.Request(BASE + path, data=data, method=method, headers=h))

def expect(code, fn):
    try:
        fn(); raise AssertionError(f"expected HTTP {code}, got success")
    except urllib.error.HTTPError as e:
        assert e.code == code, f"expected {code}, got {e.code}"

s = json.loads(req("/api/start", data=json.dumps({"url": "https://example.com/"}).encode(),
    method="POST", extra={"Content-Type": "application/json", "Origin": BASE}).read())
token, view = s["token"], s["view"]
assert view == hashlib.sha256(("view|" + token).encode()).hexdigest(), "view derivation mismatch"
print("start OK")

frame = None
for _ in range(12):
    try:
        fr = req("/api/frame", extra={"Authorization": "Bearer " + token})
        frame = fr.read()
        if frame[:2] == b"\xff\xd8": break
    except urllib.error.HTTPError: pass
    time.sleep(1.2)
assert frame and frame[:2] == b"\xff\xd8", "no control frame"
print("control frame OK", len(frame), "bytes")

fv = req("/api/frame", extra={"Authorization": "Bearer " + view, "x-kitesurf-role": "view"})
assert fv.read()[:2] == b"\xff\xd8"; print("view frame OK")

ctl = {"Content-Type": "application/json", "Origin": BASE}
expect(403, lambda: req("/api/action", data=b'{"kind":"reload"}', method="POST",
    extra={**ctl, "Authorization": "Bearer " + view, "x-kitesurf-role": "view"}))
expect(410, lambda: req("/api/action", data=b'{"kind":"reload"}', method="POST",
    extra={**ctl, "Authorization": "Bearer " + view}))
print("view token correctly restricted")

e = json.loads(req("/api/extend", data=b"{}", method="POST",
    extra={**ctl, "Authorization": "Bearer " + token}).read())
print("extend OK, capped:", e["capped"])

assert req("/api/close", data=b"{}", method="POST",
    extra={**ctl, "Authorization": "Bearer " + token}).status == 204
expect(410, lambda: req("/api/frame", extra={"Authorization": "Bearer " + token}))
print("close OK — all green ✔")
