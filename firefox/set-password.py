#!/usr/bin/env python3
"""Usage: set-password.py [password]  (generates one when omitted). Rotating it logs everyone out."""
import hashlib, json, os, secrets, sys
BASE = os.environ.get("SABI_FX_DIR", "/opt/sabi-fx")
alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
pw = sys.argv[1] if len(sys.argv) > 1 else "".join(secrets.choice(alphabet) for _ in range(20))
salt = secrets.token_bytes(16)
h = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
path = os.path.join(BASE, "auth.json")
old = {}
if os.path.exists(path): old = json.load(open(path))
json.dump({"salt": salt.hex(), "hash": h.hex(), "secret": old.get("secret") or secrets.token_hex(32)}, open(path, "w"))
os.chmod(path, 0o600)
print(pw)
