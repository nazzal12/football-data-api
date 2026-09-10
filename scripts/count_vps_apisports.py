"""Count API-Sports evidence from stopped football-api container logs."""
from __future__ import annotations

import re
import sys

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"


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

    def run(cmd: str) -> str:
        _i, stdout, stderr = client.exec_command(cmd, timeout=180)
        return (stdout.read() + stderr.read()).decode("utf-8", "replace")

    # Confirm still stopped
    print(safe(run("docker ps -a --filter name=football --format '{{.Names}} {{.Status}}'")))
    print(safe(run("ss -lntp | grep 8787 || echo 8787_FREE")))

    logs = run("docker logs football-api 2>&1")
    print(f"log_bytes={len(logs)} log_lines={logs.count(chr(10))}")

    patterns = {
        "api-sports.io OR apisports": r"api-sports\.io|apisports\.io|v3\.football",
        "warmup mentions": r"warmup",
        "cron disabled": r"cron disabled",
        "listening": r"football-api node listening",
        "provider/fetch errors": r"provider|API_SPORTS|apiFootball|api-football",
        "HTTP outbound hints": r"https?://[^\s\"']+",
    }
    for label, pat in patterns.items():
        hits = re.findall(pat, logs, flags=re.I)
        print(f"{label}: {len(hits)}")

    # Unique URLs
    urls = re.findall(r"https?://[^\s\"'<>]+", logs, flags=re.I)
    sports = [u for u in urls if re.search(r"api-sports|apisports|football", u, re.I)]
    print(f"unique_sports_urls={len(set(sports))}")
    for u in sorted(set(sports))[:30]:
        print(" URL", safe(u)[:180])

    # Warmup JSON lines
    warm = [ln for ln in logs.splitlines() if "warmup" in ln.lower()]
    print(f"warmup_lines={len(warm)}")
    for ln in warm[-20:]:
        print(" W", safe(ln)[:240])

    # Last 40 log lines
    print("=== LAST_40 ===")
    for ln in logs.splitlines()[-40:]:
        print(safe(ln)[:240])

    # Also stop redis to be thorough? User said stop further requests - redis alone doesn't call API-Sports.
    # Keep redis; API is the caller.
    print(safe(run("docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' football-api")))
    client.close()
    print("DONE")


if __name__ == "__main__":
    main()
