"""Smoke-test Hetzner football-api (SSH) vs Cloudflare workers.dev. No cutover."""
from __future__ import annotations

import json
import urllib.request

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
CF = "https://football-api.nazzalkausar12.workers.dev"
UA = "Dart/3.11 (dart:io)"


def http_get(url: str, headers: dict | None = None, timeout: int = 60) -> tuple[int, str, dict]:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, body, dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), dict(e.headers)


def ssh_curl(path: str) -> tuple[int, str]:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    cmd = (
        f"curl -sS -m 90 -w '\\nHTTP_CODE:%{{http_code}}' "
        f"-H 'User-Agent: {UA}' 'http://127.0.0.1:8787{path}'"
    )
    _i, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    client.close()
    if "HTTP_CODE:" not in out:
        return 0, out + err
    body, code = out.rsplit("HTTP_CODE:", 1)
    return int(code.strip()), body


def summarize(label: str, status: int, body: str) -> dict:
    info: dict = {"label": label, "status": status, "bytes": len(body)}
    try:
        data = json.loads(body)
        if isinstance(data, dict):
            info["keys"] = sorted(data.keys())[:12]
            if "matches" in data and isinstance(data["matches"], list):
                info["matches"] = len(data["matches"])
            if "items" in data and isinstance(data["items"], list):
                info["items"] = len(data["items"])
            if "ok" in data:
                info["ok"] = data["ok"]
        elif isinstance(data, list):
            info["list_len"] = len(data)
    except Exception:
        info["preview"] = body[:120]
    return info


def main() -> None:
    paths = [
        "/health",
        "/v1/projections/matches/live",
        "/v1/projections/matches/by-date/2026-08-11",
        "/v1/search?q=madrid",
    ]
    results = []
    for path in paths:
        print(f"=== {path}", flush=True)
        # Cloudflare
        st, body, _ = http_get(CF + path, {"User-Agent": UA})
        cf_info = summarize("cf", st, body)
        print("CF", cf_info, flush=True)
        # Hetzner
        st2, body2 = ssh_curl(path)
        hz_info = summarize("hetzner", st2, body2)
        print("HZ", hz_info, flush=True)
        results.append({"path": path, "cf": cf_info, "hetzner": hz_info, "both_ok": st == 200 and st2 == 200})

    # orefinder still healthy
    st3, _, _ = http_get("https://orefinder.io/")
    print("orefinder", st3, flush=True)

    # VPS resource snapshot
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    _i, stdout, _e = client.exec_command("free -h; df -h / | tail -1; docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}'", timeout=60)
    print(stdout.read().decode("utf-8", "replace"), flush=True)
    client.close()

    ok = all(r["both_ok"] for r in results) and st3 == 200
    print("VERIFY_DUAL", "OK" if ok else "FAIL", flush=True)
    print(json.dumps(results, indent=2), flush=True)


if __name__ == "__main__":
    main()
