"""
Export Cloudflare Workers KV idmap/slug keys via REST bulk get (with 429 backoff),
then import into football-api-redis on the VPS (not host/CloudPanel Redis).
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import paramiko

ACCOUNT_ID = "172e60bf5969fa2ef5e34f840c3b1045"
NAMESPACE_ID = "47d3dcca27284017a3d6a1be1d2cb119"
HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
# Stable identity only — meta/proj rebuild from upstream on miss.
PREFIXES = ["idmap:", "slug:"]
BULK_SIZE = 100
LIST_LIMIT = 1000
CONCURRENCY = 2


def load_token() -> str:
    for env in ("CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"):
        if os.environ.get(env):
            return os.environ[env]
    cfg = Path(os.environ.get("APPDATA", "")) / "xdg.config" / ".wrangler" / "config" / "default.toml"
    if cfg.exists():
        for line in cfg.read_text(encoding="utf-8").splitlines():
            if line.startswith("oauth_token"):
                return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("No Cloudflare token (CLOUDFLARE_API_TOKEN or wrangler oauth)")


def cf_request(token: str, method: str, path: str, body: dict | None = None, retries: int = 8) -> dict | list | bytes:
    url = f"https://api.cloudflare.com/client/v4{path}"
    data = None if body is None else json.dumps(body).encode()
    last_err: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read()
                ctype = resp.headers.get("Content-Type", "")
                if "application/json" in ctype or raw[:1] in (b"{", b"["):
                    return json.loads(raw.decode())
                return raw
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", "replace")
            last_err = RuntimeError(f"CF {method} {path} -> {e.code}: {err[:500]}")
            if e.code in (429, 502, 503, 504):
                sleep_s = min(60, 2**attempt) + attempt
                print(f"  backoff {sleep_s}s after {e.code}", flush=True)
                time.sleep(sleep_s)
                # reload token in case wrangler refreshed
                token = load_token()
                continue
            raise last_err from e
    raise last_err or RuntimeError("cf_request failed")


def list_keys(token: str, prefix: str) -> list[dict]:
    keys: list[dict] = []
    cursor: str | None = None
    while True:
        q = {"limit": str(LIST_LIMIT), "prefix": prefix}
        if cursor:
            q["cursor"] = cursor
        qs = urllib.parse.urlencode(q)
        path = f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/keys?{qs}"
        payload = cf_request(token, "GET", path)
        assert isinstance(payload, dict)
        if not payload.get("success"):
            raise RuntimeError(f"list failed: {payload}")
        batch = payload.get("result") or []
        keys.extend(batch)
        cursor = (payload.get("result_info") or {}).get("cursor")
        print(f"  listed {prefix} {len(keys)}...", flush=True)
        if not cursor or not batch:
            break
        time.sleep(0.15)
    return keys


def bulk_get(token: str, names: list[str]) -> dict[str, str | None]:
    path = f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/bulk/get"
    payload = cf_request(token, "POST", path, {"keys": names})
    assert isinstance(payload, dict)
    if not payload.get("success"):
        out: dict[str, str | None] = {}
        for name in names:
            enc = urllib.parse.quote(name, safe="")
            vpath = f"/accounts/{ACCOUNT_ID}/storage/kv/namespaces/{NAMESPACE_ID}/values/{enc}"
            try:
                raw = cf_request(token, "GET", vpath)
                out[name] = raw.decode() if isinstance(raw, bytes) else str(raw)
            except Exception:
                out[name] = None
            time.sleep(0.05)
        return out
    result = payload.get("result") or {}
    values = result.get("values") or result
    if isinstance(values, dict):
        return {k: (None if v is None else str(v)) for k, v in values.items()}
    out2: dict[str, str | None] = {}
    if isinstance(values, list):
        for row in values:
            if isinstance(row, dict) and "name" in row:
                out2[row["name"]] = row.get("value")
    return out2


def export_jsonl(token: str, out_path: Path) -> int:
    all_rows: list[dict] = []
    seen: set[str] = set()
    for prefix in PREFIXES:
        print(f"listing {prefix}", flush=True)
        for row in list_keys(token, prefix):
            name = row["name"]
            if name in seen:
                continue
            seen.add(name)
            all_rows.append(row)

    print(f"total keys {len(all_rows)}", flush=True)
    names = [r["name"] for r in all_rows]
    exp_by_name = {r["name"]: r.get("expiration") for r in all_rows}
    batches = [names[i : i + BULK_SIZE] for i in range(0, len(names), BULK_SIZE)]
    written = 0
    with out_path.open("w", encoding="utf-8") as fh:
        with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
            futs = {pool.submit(bulk_get, token, b): b for b in batches}
            done = 0
            for fut in as_completed(futs):
                got = fut.result()
                for k, v in got.items():
                    if v is None:
                        continue
                    rec = {"key": k, "value": v}
                    if exp_by_name.get(k):
                        rec["expiration"] = exp_by_name[k]
                    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    written += 1
                done += 1
                if done % 20 == 0 or done == len(batches):
                    print(f"  bulk batches {done}/{len(batches)} written={written}", flush=True)
                time.sleep(0.05)
    return written


def ssh() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username="root",
        password=PASSWORD,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> str:
    print("==>", cmd[:140], flush=True)
    _i, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err else "")).strip()
    if text:
        print(text[-3000:], flush=True)
    if code != 0:
        raise RuntimeError(f"failed ({code}): {cmd}\n{text[-1000:]}")
    return out


def import_on_vps(local_jsonl: Path) -> None:
    client = ssh()
    remote = "/tmp/football-kv.jsonl"
    sftp = client.open_sftp()
    print(f"upload {local_jsonl} -> {remote} ({local_jsonl.stat().st_size} bytes)", flush=True)
    sftp.put(str(local_jsonl), remote)
    sftp.close()

    importer = r'''
import json, os, time
from pathlib import Path
import redis

r = redis.Redis(host=os.environ.get("REDIS_HOST", "football-api-redis"), port=6379, decode_responses=True)
n = 0
now = int(time.time())
pipe = r.pipeline(transaction=False)
for line in Path("/data/football-kv.jsonl").read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    row = json.loads(line)
    key = row["key"]
    val = row["value"]
    exp = row.get("expiration")
    if exp and int(exp) > now:
        pipe.set(key, val, ex=int(exp) - now)
    else:
        pipe.set(key, val)
    n += 1
    if n % 500 == 0:
        pipe.execute()
        pipe = r.pipeline(transaction=False)
        print(f"imported {n}", flush=True)
pipe.execute()
print(f"done {n} dbsize={r.dbsize()}", flush=True)
'''
    sftp = client.open_sftp()
    with sftp.file("/tmp/import_kv_redis.py", "w") as f:
        f.write(importer)
    sftp.close()

    run(
        client,
        "docker run --rm --network football_api_net "
        "-v /tmp/football-kv.jsonl:/data/football-kv.jsonl:ro "
        "-v /tmp/import_kv_redis.py:/import_kv_redis.py:ro "
        "-e REDIS_HOST=football-api-redis "
        "python:3.12-slim bash -lc 'pip install -q redis && python /import_kv_redis.py'",
        timeout=1800,
    )
    run(
        client,
        "docker run --rm --network football_api_net redis:7-alpine "
        "redis-cli -h football-api-redis DBSIZE",
    )
    run(client, "cd /opt/football-api/deploy/hetzner && docker compose -p football-api start api || true")
    run(client, "sleep 2; curl -sS http://127.0.0.1:8787/health")
    run(client, "curl -sI https://orefinder.io | head -n 1")
    client.close()


def main() -> None:
    token = load_token()
    out_dir = Path("backups") / "kv-export"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"football-kv-idmap-{time.strftime('%Y%m%d-%H%M%S')}.jsonl"
    n = export_jsonl(token, out_path)
    print(f"exported {n} records -> {out_path}", flush=True)
    if n == 0:
        raise SystemExit("no keys exported")
    import_on_vps(out_path)
    print("KV_IMPORT_DONE", flush=True)


if __name__ == "__main__":
    main()
