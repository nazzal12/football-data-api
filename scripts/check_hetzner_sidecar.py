"""Check football-api sidecar + orefinder health on VPS."""
from __future__ import annotations

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"


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
    cmds = [
        'docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"',
        "docker compose -p football-api ps",
        "curl -sS -m 5 http://127.0.0.1:8787/health || echo HEALTH_FAIL",
        "curl -sI -m 10 https://orefinder.io | head -n 1",
        "ls -la /opt/football-api/deploy/hetzner/",
        "cd /opt/football-api/deploy/hetzner && docker compose -p football-api logs --tail=80 api || true",
    ]
    for cmd in cmds:
        print("==>", cmd)
        _i, stdout, stderr = client.exec_command(cmd, timeout=120)
        out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
        print(out[-5000:])
    client.close()


if __name__ == "__main__":
    main()
