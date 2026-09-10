"""Set API_SPORTS_KEY on VPS from argv/env and recreate api; smoke live endpoint."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
KEY = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("API_SPORTS_KEY", "")).strip()
if not KEY or len(KEY) < 16:
    raise SystemExit("missing key")


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)

    # Preserve other .env lines; replace API_SPORTS_KEY only
    _i, stdout, stderr = client.exec_command("cat /opt/football-api/deploy/hetzner/.env", timeout=30)
    raw = stdout.read().decode("utf-8", "replace")
    lines = []
    found = False
    for line in raw.splitlines():
        if line.startswith("API_SPORTS_KEY="):
            lines.append(f"API_SPORTS_KEY={KEY}")
            found = True
        else:
            lines.append(line)
    if not found:
        lines.append(f"API_SPORTS_KEY={KEY}")
    if not any(l.startswith("DISABLE_CRON=") for l in lines):
        lines.append("DISABLE_CRON=1")
    body = "\n".join(lines) + "\n"

    sftp = client.open_sftp()
    with sftp.file("/opt/football-api/deploy/hetzner/.env", "w") as f:
        f.write(body)
    sftp.close()

    def run(cmd: str, timeout: int = 300) -> str:
        print("==>", cmd[:120], flush=True)
        _i, o, e = client.exec_command(cmd, timeout=timeout)
        out = (o.read() + e.read()).decode("utf-8", "replace")
        print(out.encode("ascii", "replace").decode()[-2000:], flush=True)
        if o.channel.recv_exit_status() != 0:
            raise RuntimeError(cmd)
        return out

    run("cd /opt/football-api/deploy/hetzner && docker compose -p football-api up -d --force-recreate api")
    run("sleep 3; curl -sS -m 30 -H 'User-Agent: Dart/3.11 (dart:io)' http://127.0.0.1:8787/health")
    run(
        "curl -sS -m 90 -H 'User-Agent: Dart/3.11 (dart:io)' "
        "http://127.0.0.1:8787/v1/projections/matches/live | head -c 500; echo"
    )
    run(
        "curl -sS -m 120 -H 'User-Agent: Dart/3.11 (dart:io)' "
        "http://127.0.0.1:8787/v1/projections/matches/by-date/2026-08-11 | head -c 300; echo"
    )
    run("curl -sI https://orefinder.io | head -n 1 || true")
    client.close()
    print("KEY_APPLIED", flush=True)


if __name__ == "__main__":
    main()
