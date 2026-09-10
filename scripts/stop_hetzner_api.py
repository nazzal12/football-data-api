"""Hard-stop football-api on VPS and report API-Sports call evidence from logs."""
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
        # Hard stop API only — leave redis alone for now; no more HTTP/cron.
        "docker stop football-api 2>/dev/null || true",
        "docker update --restart=no football-api 2>/dev/null || true",
        "cd /opt/football-api/deploy/hetzner && docker compose -p football-api stop api 2>/dev/null || true",
        "docker ps -a --filter name=football-api --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
        # Confirm nothing listening on 8787
        "ss -lntp | grep 8787 || echo '8787_FREE'",
        # orefinder untouched check
        "docker ps --filter name=ore-finder --format 'table {{.Names}}\t{{.Status}}'",
        # Log evidence of upstream calls
        "echo '=== LOG_TAIL ==='",
        "docker logs football-api --since 48h 2>&1 | tail -n 200",
        "echo '=== API_SPORTS_URL_HITS ==='",
        "docker logs football-api --since 48h 2>&1 | grep -Eic 'api-football|api-sports|v3\\.football|apisports' || true",
        "echo '=== WARMUP_LINES ==='",
        "docker logs football-api --since 48h 2>&1 | grep -Eic 'warmup|cron' || true",
        "echo '=== WARMUP_SAMPLES ==='",
        "docker logs football-api --since 48h 2>&1 | grep -Ei 'warmup|api-football|api-sports|football' | tail -n 80 || true",
        "echo '=== HEALTH_WARMUP_JSON ==='",
        "docker logs football-api --since 48h 2>&1 | grep -F 'warmup' | tail -n 40 || true",
        "echo '=== REQUEST_LIKE ==='",
        "docker logs football-api --since 48h 2>&1 | grep -Eic '\"msg\":|fetch|provider' || true",
    ]
    for cmd in cmds:
        print("==>", cmd[:120], flush=True)
        _i, stdout, stderr = client.exec_command(cmd, timeout=180)
        out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
        print(out[-5000:], flush=True)

    client.close()
    print("VPS_API_STOPPED", flush=True)


if __name__ == "__main__":
    main()
