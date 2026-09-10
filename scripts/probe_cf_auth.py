"""Quick probe: can we read KV/R2 with current wrangler oauth?"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

cfg = Path(__import__("os").environ["APPDATA"]) / "xdg.config/.wrangler/config/default.toml"
token = None
exp = None
for line in cfg.read_text(encoding="utf-8").splitlines():
    if line.startswith("oauth_token"):
        token = line.split("=", 1)[1].strip().strip('"')
    if line.startswith("expiration_time"):
        exp = line.split("=", 1)[1].strip().strip('"')
print("exp", exp)
url = "https://api.cloudflare.com/client/v4/accounts/172e60bf5969fa2ef5e34f840c3b1045/storage/kv/namespaces/47d3dcca27284017a3d6a1be1d2cb119/keys?limit=10&prefix=slug%3A"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        print("kv_ok", data.get("success"), "n", len(data.get("result") or []))
except Exception as e:
    print("kv_fail", e)

url2 = "https://api.cloudflare.com/client/v4/accounts/172e60bf5969fa2ef5e34f840c3b1045/r2/buckets/football-api-objects/objects?per_page=5"
req2 = urllib.request.Request(url2, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req2, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        print("r2_ok", data.get("success"))
except Exception as e:
    print("r2_fail", e)
