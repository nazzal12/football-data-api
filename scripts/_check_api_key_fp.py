"""Compare API_SPORTS_KEY fingerprint local vs VPS without printing the secret."""
from __future__ import annotations

import hashlib
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]


def load_local() -> str:
    p = ROOT / "apps" / "worker" / ".dev.vars"
    for line in p.read_text(encoding="utf-8").splitlines():
        if line.startswith("API_SPORTS_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def fp(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:16]


def main() -> None:
    local = load_local()
    print("local_len", len(local), "fp", fp(local) if local else "NONE")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "168.119.180.149",
        username="root",
        password="pHJgmdbe77fC",
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    # get key from container env without printing it: hash on server
    cmd = (
        "docker exec football-api node -e "
        "\"const k=process.env.API_SPORTS_KEY||'';"
        "const c=require('crypto').createHash('sha256').update(k).digest('hex').slice(0,16);"
        "console.log('vps_len',k.length,'fp',c,'has_ws',/\\s/.test(k))\""
    )
    _i, o, e = client.exec_command(cmd, timeout=60)
    print((o.read() + e.read()).decode())

    # also check .env file length only
    _i, o, e = client.exec_command(
        "python3 - <<'PY'\n"
        "from pathlib import Path\n"
        "p=Path('/opt/football-api/deploy/hetzner/.env')\n"
        "k=''\n"
        "for line in p.read_text().splitlines():\n"
        "  if line.startswith('API_SPORTS_KEY='):\n"
        "    k=line.split('=',1)[1].strip().strip(chr(34)).strip(chr(39))\n"
        "import hashlib\n"
        "print('envfile_len', len(k), 'fp', hashlib.sha256(k.encode()).hexdigest()[:16])\n"
        "PY",
        timeout=30,
    )
    print((o.read() + e.read()).decode())

    # Test upstream with the container key (status only)
    _i, o, e = client.exec_command(
        "docker exec football-api node -e "
        "\"fetch('https://v3.football.api-sports.io/status',{headers:{'x-apisports-key':process.env.API_SPORTS_KEY||''}})"
        ".then(async r=>{const t=await r.text(); console.log('status',r.status,'body',t.slice(0,200));})\""
        ,
        timeout=60,
    )
    print((o.read() + e.read()).decode())
    client.close()


if __name__ == "__main__":
    main()
