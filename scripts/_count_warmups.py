import re
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
_i, o, e = c.exec_command("docker logs football-api 2>&1", timeout=120)
logs = (o.read() + e.read()).decode("utf-8", "replace")

print("warmup.done", logs.count("warmup.done"))
print("projection_fail", logs.count("warmup.projection_fail"))
print("mode_catalog_in_done", len(re.findall(r'"mode":"catalog"', logs)))
print("listening", logs.count("football-api node listening"))

# parse done events with timestamps
done = re.findall(
    r'"message":"warmup\.done","mode":"(\w+)","steps":(\d+),"ts":"([^"]+)"',
    logs,
)
print("done_events", len(done))
if done:
    print("first", done[0])
    print("last", done[-1])

fails = re.findall(
    r'"message":"warmup\.projection_fail".*?"code":"([^"]+)","ts":"([^"]+)"',
    logs,
)
from collections import Counter

print("fail_codes", Counter(code for code, _ in fails))
print("fail_count", len(fails))

# Estimate: each dates warmup does 3 forceRefresh projections; each likely >=1 upstream fixtures call
print("estimated_min_upstream_calls", len(fails) + sum(int(s) for _, s, _ in done if _ == "dates") - len(fails))
# clearer:
# every warmup.done with steps=3 means 3 projection attempts; fails count failed ones; successes = 3*dones - fails roughly if all dates
print("date_warmups", sum(1 for m, _, _ in done if m == "dates"))
print("catalog_warmups", sum(1 for m, _, _ in done if m == "catalog"))
attempts = sum(int(s) for m, s, _ in done if m == "dates")
print("date_projection_attempts_from_done_steps", attempts)
print("NOTE: each attempt typically = 1+ API-Sports fixtures request (pagination may add more)")

_i, o, e = c.exec_command(
    "docker ps -a --filter name=football-api --format '{{.Names}} {{.Status}}'; "
    "docker inspect -f 'restart={{.HostConfig.RestartPolicy.Name}}' football-api; "
    "ss -lntp | grep 8787 || echo 8787_FREE",
    timeout=30,
)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
