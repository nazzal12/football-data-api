"""Bring football-api back with DISABLE_CRON=1; skip media bulk sync."""
from __future__ import annotations

from pathlib import Path

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
ROOT = Path(__file__).resolve().parents[1]
REMOTE_DIR = "/opt/football-api"


def safe(s: str) -> str:
    return s.encode("ascii", "replace").decode("ascii")


def main() -> None:
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

    def run(cmd: str, timeout: int = 1200) -> str:
        print("==>", cmd[:140], flush=True)
        _i, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        text = (out + ("\n" + err if err else "")).strip()
        if text:
            print(safe(text[-2500:]), flush=True)
        if code != 0:
            raise RuntimeError(f"failed ({code}): {cmd}")
        return out

    # Drop any in-progress media tar upload on VPS
    run("rm -f /tmp/football-media-upload.tgz /tmp/football-r2*.tgz || true")

    sftp = client.open_sftp()
    sftp.put(str(ROOT / "apps/node-api/src/main.ts"), f"{REMOTE_DIR}/apps/node-api/src/main.ts")
    sftp.put(
        str(ROOT / "deploy/hetzner/docker-compose.yml"),
        f"{REMOTE_DIR}/deploy/hetzner/docker-compose.yml",
    )
    sftp.close()

    run(
        "grep -q '^DISABLE_CRON=' /opt/football-api/deploy/hetzner/.env && "
        "sed -i 's/^DISABLE_CRON=.*/DISABLE_CRON=1/' /opt/football-api/deploy/hetzner/.env || "
        "echo 'DISABLE_CRON=1' >> /opt/football-api/deploy/hetzner/.env; "
        "grep DISABLE_CRON /opt/football-api/deploy/hetzner/.env"
    )

    run(
        "docker run --rm --network football_api_net redis:7-alpine "
        "redis-cli -h football-api-redis DBSIZE"
    )

    run(
        "cd /opt/football-api/deploy/hetzner && docker compose -p football-api up -d --build api",
        timeout=1200,
    )
    run("docker update --restart=unless-stopped football-api || true")
    run("sleep 3; curl -sS http://127.0.0.1:8787/health")
    run("docker logs football-api --tail 30 2>&1")
    run("curl -sI https://orefinder.io | head -n 1")
    run("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    client.close()
    print("API_UP_NO_MEDIA_SYNC", flush=True)


if __name__ == "__main__":
    main()
