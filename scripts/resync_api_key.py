"""Rewrite VPS .env API_SPORTS_KEY from local .dev.vars and recreate api container."""
from __future__ import annotations

from pathlib import Path

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    dev = ROOT / "apps" / "worker" / ".dev.vars"
    api_key = ""
    admin = ""
    for line in dev.read_text(encoding="utf-8").splitlines():
        if line.startswith("API_SPORTS_KEY="):
            api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
        if line.startswith("ADMIN_TOKEN="):
            admin = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not api_key:
        raise SystemExit("API_SPORTS_KEY missing in .dev.vars")

    env_body = "\n".join(
        [
            f"API_SPORTS_KEY={api_key}",
            f"ADMIN_TOKEN={admin}",
            "ACCESS_GUARD=",
            "ALLOWED_CF_WORKERS=verfutbollibre.net",
            "ALLOWED_SITE_HOSTS=verfutbollibre.net",
            "PUBLIC_BASE_URL=http://127.0.0.1:8787",
            "LOG_LEVEL=info",
            "ENVIRONMENT=production",
            "DISABLE_CRON=1",
            "",
        ]
    )

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
    sftp = client.open_sftp()
    with sftp.file("/opt/football-api/deploy/hetzner/.env", "w") as f:
        f.write(env_body)
    sftp.close()

    def run(cmd: str, timeout: int = 300) -> None:
        print("==>", cmd[:120], flush=True)
        _i, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
        print(out.encode("ascii", "replace").decode()[-2000:], flush=True)
        code = stdout.channel.recv_exit_status()
        if code != 0:
            raise RuntimeError(f"failed {code}")

    # Recreate so env is picked up
    run("cd /opt/football-api/deploy/hetzner && docker compose -p football-api up -d --force-recreate api")
    run("sleep 3; curl -sS -m 30 -H 'User-Agent: Dart/3.11 (dart:io)' http://127.0.0.1:8787/health")
    run(
        "curl -sS -m 60 -H 'User-Agent: Dart/3.11 (dart:io)' "
        "http://127.0.0.1:8787/v1/projections/matches/live | head -c 400; echo"
    )
    run("docker logs football-api --tail 15 2>&1")
    run("curl -sI https://orefinder.io | head -n 1 || true")
    client.close()
    print("KEY_SYNCED", flush=True)


if __name__ == "__main__":
    main()
