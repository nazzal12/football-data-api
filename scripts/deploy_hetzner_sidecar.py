"""Deploy football-api sidecar to Hetzner beside orefinder (password SSH; encrypted local key)."""
from __future__ import annotations

import os
import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
REMOTE_DIR = "/opt/football-api"
ROOT = Path(__file__).resolve().parents[1]


def connect() -> paramiko.SSHClient:
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
    return client


def _safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"))


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> str:
    print("==>", cmd[:120])
    _i, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out:
        _safe_print(out[-4000:])
    if err:
        _safe_print("ERR " + err[-2000:])
    if code != 0:
        raise RuntimeError(f"cmd failed ({code}): {cmd}")
    return out


def main() -> None:
    dev_vars = ROOT / "apps" / "worker" / ".dev.vars"
    api_key = ""
    admin = ""
    if dev_vars.exists():
        for line in dev_vars.read_text().splitlines():
            if line.startswith("API_SPORTS_KEY="):
                api_key = line.split("=", 1)[1].strip().strip('"')
            if line.startswith("ADMIN_TOKEN="):
                admin = line.split("=", 1)[1].strip().strip('"')
    if not api_key:
        api_key = os.environ.get("API_SPORTS_KEY", "")
    if not api_key:
        raise SystemExit("API_SPORTS_KEY missing (.dev.vars or env)")

    exclude = {
        "node_modules",
        ".git",
        ".wrangler",
        "pelota_libre",
        "coverage",
        "dist",
        "backups",
    }

    with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
        tar_path = Path(tmp.name)
    with tarfile.open(tar_path, "w:gz") as tar:
        for path in ROOT.rglob("*"):
            rel = path.relative_to(ROOT).as_posix()
            if any(part in exclude for part in Path(rel).parts):
                continue
            if path.is_file():
                tar.add(path, arcname=f"football-api/{rel}")

    print("archive", tar_path, "size", tar_path.stat().st_size)

    client = connect()
    run(client, f"mkdir -p {REMOTE_DIR} /tmp")
    sftp = client.open_sftp()
    remote_tar = "/tmp/football-api-src.tgz"
    sftp.put(str(tar_path), remote_tar)
    sftp.close()
    tar_path.unlink(missing_ok=True)

    run(client, f"rm -rf {REMOTE_DIR}/apps {REMOTE_DIR}/packages {REMOTE_DIR}/deploy {REMOTE_DIR}/scripts {REMOTE_DIR}/package.json {REMOTE_DIR}/pnpm-lock.yaml {REMOTE_DIR}/pnpm-workspace.yaml {REMOTE_DIR}/tsconfig.base.json || true")
    run(client, f"tar -xzf {remote_tar} -C /opt && rm -f {remote_tar}")
    # tar extracts to /opt/football-api/...
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
            "",
        ]
    )
    sftp = client.open_sftp()
    with sftp.file(f"{REMOTE_DIR}/deploy/hetzner/.env", "w") as f:
        f.write(env_body)
    sftp.close()

    # Build/up only football-api project — leave ore-finder alone
    run(
        client,
        f"cd {REMOTE_DIR}/deploy/hetzner && docker compose -p football-api up -d --build",
        timeout=1200,
    )
    run(client, "sleep 3; curl -sS http://127.0.0.1:8787/health || true")
    run(client, "curl -sI https://orefinder.io | head -n 1 || true")
    run(client, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    client.close()
    print("DEPLOY_DONE")


if __name__ == "__main__":
    main()
