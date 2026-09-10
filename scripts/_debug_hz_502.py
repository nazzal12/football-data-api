import json
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "168.119.180.149",
    username="root",
    password="pHJgmdbe77fC",
    timeout=30,
    allow_agent=False,
    look_for_keys=False,
)

def run(cmd):
    _i, o, e = c.exec_command(cmd, timeout=120)
    return (o.read() + e.read()).decode("utf-8", "replace")

# body of 502
print("=== LIVE ===")
print(run("curl -sS -m 60 -H 'User-Agent: Dart/3.11 (dart:io)' http://127.0.0.1:8787/v1/projections/matches/live")[:1500])
print("=== DATE ===")
print(run("curl -sS -m 90 -H 'User-Agent: Dart/3.11 (dart:io)' http://127.0.0.1:8787/v1/projections/matches/by-date/2026-08-11")[:1500])
print("=== ENV KEYS (names only) ===")
print(run("docker exec football-api sh -lc 'env | cut -d= -f1 | sort'"))
print("=== HAS API KEY ===")
print(run("docker exec football-api sh -lc 'if [ -n \"$API_SPORTS_KEY\" ]; then echo KEY_SET len=${#API_SPORTS_KEY}; else echo KEY_MISSING; fi'"))
print("=== LOGS ===")
print(run("docker logs football-api --tail 80 2>&1").encode("ascii","replace").decode())
c.close()
