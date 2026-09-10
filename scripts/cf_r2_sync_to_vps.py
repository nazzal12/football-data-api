"""
Sync R2 football-api-objects into the VPS football-api objects volume.
Uses wrangler OAuth. Defaults to prefixes media/ and obj:match_list/ if set,
or PREFIXES env (comma-separated). Empty PREFIXES= means all keys.
"""
from __future__ import annotations

import json
import os
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import paramiko

ACCOUNT_ID = "172e60bf5969fa2ef5e34f840c3b1045"
BUCKET = "football-api-objects"
HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
# Media logos + list projections first (enough for staging smoke). Full obj: sync optional.
PREFIXES = [
    p
    for p in os.environ.get("R2_PREFIXES", "media/,obj:match_list/").split(",")
    if p.strip()
]
CONCURRENCY = 6
MAX_OBJECTS = int(os.environ.get("R2_MAX_OBJECTS", "0"))  # 0 = no cap


def load_token() -> str:
    for env in ("CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"):
        if os.environ.get(env):
            return os.environ[env]
    cfg = Path(os.environ["APPDATA"]) / "xdg.config/.wrangler/config/default.toml"
    for line in cfg.read_text(encoding="utf-8").splitlines():
        if line.startswith("oauth_token"):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("no token")


def cf_json(token: str, path: str, retries: int = 6) -> dict:
    url = f"https://api.cloudflare.com/client/v4{path}"
    last: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            last = RuntimeError(f"{e.code} {body[:200]}")
            if e.code in (401,):
                token = load_token()
            if e.code in (429, 502, 503, 504, 401):
                time.sleep(min(45, 2**attempt))
                continue
            raise last from e
    raise last or RuntimeError("cf_json failed")


def list_keys(token: str) -> list[str]:
    keys: list[str] = []
    cursor: str | None = None
    while True:
        q = {"per_page": "1000"}
        if cursor:
            q["cursor"] = cursor
        qs = urllib.parse.urlencode(q)
        payload = cf_json(token, f"/accounts/{ACCOUNT_ID}/r2/buckets/{BUCKET}/objects?{qs}")
        if not payload.get("success"):
            raise RuntimeError(payload)
        result = payload.get("result")
        batch = result if isinstance(result, list) else (result or {}).get("objects") or []
        past_prefixes = False
        for row in batch:
            key = row.get("key") if isinstance(row, dict) else str(row)
            if not key:
                continue
            if PREFIXES:
                if any(key.startswith(p) for p in PREFIXES):
                    keys.append(key)
                elif all(key > p for p in PREFIXES):
                    # R2 list is lexicographic; once past all prefixes, stop paging.
                    past_prefixes = True
            else:
                keys.append(key)
        info = payload.get("result_info") or {}
        cursor = info.get("cursor")
        truncated = info.get("is_truncated")
        print(f"listed keep={len(keys)} truncated={truncated}", flush=True)
        if past_prefixes:
            break
        if not truncated and not cursor:
            break
        if not batch:
            break
        time.sleep(0.05)
        if MAX_OBJECTS and len(keys) >= MAX_OBJECTS:
            keys = keys[:MAX_OBJECTS]
            break
    return keys


def download(token: str, key: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    enc = urllib.parse.quote(key, safe="")
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/r2/buckets/{BUCKET}/objects/{enc}"
    for attempt in range(6):
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {load_token()}"})
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(resp.read())
            return
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503, 504):
                time.sleep(min(45, 2**attempt))
                continue
            raise RuntimeError(f"get {key} {e.code}") from e


def ssh() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> str:
    print("==>", cmd[:120], flush=True)
    _i, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err else "")).strip()
    if text:
        print(text[-2000:], flush=True)
    if code != 0:
        raise RuntimeError(f"failed {code}: {cmd}")
    return out


def main() -> None:
    token = load_token()
    print("prefixes", PREFIXES, flush=True)
    keys = list_keys(token)
    print(f"to download {len(keys)}", flush=True)
    root = Path("backups/r2-export")
    root.mkdir(parents=True, exist_ok=True)

    done = 0
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futs = {pool.submit(download, token, k, root / k): k for k in keys}
        for fut in as_completed(futs):
            fut.result()
            done += 1
            if done % 100 == 0 or done == len(keys):
                print(f"downloaded {done}/{len(keys)}", flush=True)

    tar_path = Path(tempfile.gettempdir()) / "football-r2-partial.tgz"
    with tarfile.open(tar_path, "w:gz") as tar:
        for path in root.rglob("*"):
            if path.is_file():
                rel = path.relative_to(root).as_posix()
                if PREFIXES and not any(rel.startswith(p) for p in PREFIXES):
                    continue
                tar.add(path, arcname=rel)

    client = ssh()
    remote = "/tmp/football-r2-partial.tgz"
    sftp = client.open_sftp()
    print(f"upload {tar_path.stat().st_size}", flush=True)
    sftp.put(str(tar_path), remote)
    sftp.close()
    run(
        client,
        "docker cp /tmp/football-r2-partial.tgz football-api:/tmp/r2.tgz && "
        "docker exec football-api sh -lc "
        "'mkdir -p /var/lib/football-api/objects && tar -xzf /tmp/r2.tgz -C /var/lib/football-api/objects && "
        "rm -f /tmp/r2.tgz && find /var/lib/football-api/objects -type f | wc -l'",
    )
    run(client, "rm -f /tmp/football-r2-partial.tgz; curl -sI https://orefinder.io | head -n 1")
    client.close()
    print("R2_SYNC_DONE", flush=True)


if __name__ == "__main__":
    main()
