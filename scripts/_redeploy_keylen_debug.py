"""Push patched main.ts and recreate; show key-length log only."""
from __future__ import annotations

from pathlib import Path
import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
ROOT = Path(__file__).resolve().parents[1]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
sftp = c.open_sftp()
sftp.put(str(ROOT / "apps/node-api/src/main.ts"), "/opt/football-api/apps/node-api/src/main.ts")
sftp.close()

def run(cmd, timeout=600):
    print("==>", cmd[:120], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = (o.read() + e.read()).decode("utf-8", "replace")
    print(out.encode("ascii", "replace").decode()[-2500:], flush=True)

run("cd /opt/football-api/deploy/hetzner && docker compose -p football-api up -d --build api")
run("sleep 2; docker logs football-api --tail 20 2>&1")
# Direct curl to API-Sports from inside container using same env var
run(
    "docker exec football-api sh -lc "
    "'wget -qO- --header=\"x-apisports-key: $API_SPORTS_KEY\" https://v3.football.api-sports.io/status 2>/dev/null "
    "| head -c 250 || curl -sS -m 20 -H \"x-apisports-key: $API_SPORTS_KEY\" https://v3.football.api-sports.io/status | head -c 250; echo'"
)
c.close()
print("DONE")
