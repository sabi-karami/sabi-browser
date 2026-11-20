#!/usr/bin/env python3
"""Deploy the Sabi Browser worker (shared-tab app) to Cloudflare.

Usage:
  export CLOUDFLARE_API_TOKEN=...   # Workers Scripts:Edit
  export CF_ACCOUNT_ID=...
  python3 deploy.py [--first-time]  # --first-time adds the Durable Object migration

The worker needs a service binding ENGINE -> kitesurf-upstream/KitesurfEngine
(see ../engine) and serves ui.html imported as a text module.
"""
import json, os, sys, uuid, urllib.request

ACCT = os.environ["CF_ACCOUNT_ID"]
TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
SCRIPT = "kitesurf-shared"

meta = json.load(open("metadata.json"))
if "--first-time" in sys.argv:
    meta["migrations"] = [{"tag": "shared-tab-v1", "new_sqlite_classes": ["SharedTab"]}]

ui = open("ui.html", "rb").read()
wk = open("worker.mjs", "rb").read()
boundary = uuid.uuid4().hex

def part(name, filename, ctype, body):
    head = (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; '
            f'filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n').encode()
    return head + body + b"\r\n"

body = b"".join([
    part("metadata", "metadata.json", "application/json", json.dumps(meta).encode()),
    part("worker.mjs", "worker.mjs", "application/javascript+module", wk),
    part("ui.html", "ui.html", "text/plain", ui),
]) + f"--{boundary}--\r\n".encode()

req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{SCRIPT}",
    data=body, method="PUT",
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}",
             "Authorization": f"Bearer {TOKEN}"})
r = json.loads(urllib.request.urlopen(req).read())
print("success:", r.get("success"), "| etag:", (r.get("result") or {}).get("etag"))

# keep workers.dev + previews OFF (the app must only answer on its custom domain)
req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/scripts/{SCRIPT}/subdomain",
    data=json.dumps({"enabled": False, "previews_enabled": False}).encode(), method="POST",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"})
print("subdomain:", json.loads(urllib.request.urlopen(req).read()).get("result"))
