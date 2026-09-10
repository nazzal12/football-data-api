import hashlib
from pathlib import Path
import paramiko

ROOT = Path(__file__).resolve().parents[1]
local = ""
for line in (ROOT / "apps/worker/.dev.vars").read_text(encoding="utf-8").splitlines():
    if line.startswith("API_SPORTS_KEY="):
        local = line.split("=", 1)[1].strip().strip('"').strip("'")
print("local_len", len(local), "fp", hashlib.sha256(local.encode()).hexdigest()[:16])

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("168.119.180.149", username="root", password="pHJgmdbe77fC", timeout=30, allow_agent=False, look_for_keys=False)

def run(cmd, timeout=60):
    print("==>", cmd[:100], flush=True)
    _i, o, e = c.exec_command(cmd, timeout=timeout)
    out = (o.read() + e.read()).decode("utf-8", "replace")
    print(out[-2000:], flush=True)
    return out

# Hash env key via python on host reading .env
run(
    "python3 -c \"import hashlib; "
    "k=[l.split('=',1)[1].strip().strip(chr(34)).strip(chr(39)) "
    "for l in open('/opt/football-api/deploy/hetzner/.env') if l.startswith('API_SPORTS_KEY=')][0]; "
    "print('envfile_len',len(k),'fp',hashlib.sha256(k.encode()).hexdigest()[:16],'repr_head',repr(k[:4]),'repr_tail',repr(k[-4:]))\""
)

# Hash from container via printenv + sha256sum
run(
    "docker exec football-api sh -lc "
    "'printenv API_SPORTS_KEY | wc -c; printenv API_SPORTS_KEY | sha256sum | cut -c1-16'"
)

# Upstream status with curl from host using key from .env without echoing key
run(
    "KEY=$(python3 -c \"print([l.split('=',1)[1].strip().strip(chr(34)) for l in open('/opt/football-api/deploy/hetzner/.env') if l.startswith('API_SPORTS_KEY=')][0])\"); "
    "curl -sS -m 20 -H \"x-apisports-key: $KEY\" https://v3.football.api-sports.io/status | head -c 300; echo"
)

# Also try Worker secret isn't available; check if CF worker key differs - user may have rotated
# Compare: if local fp != envfile fp, rewrite .env from local and recreate container
c.close()
print("DONE")
