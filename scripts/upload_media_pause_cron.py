"""Stop Hetzner cron (DISABLE_CRON), upload local R2 media into football-api objects volume."""
from __future__ import annotations

import tarfile
import tempfile
from pathlib import Path

import paramiko

HOST = "168.119.180.149"
PASSWORD = "pHJgmdbe77fC"
ROOT = Path(__file__).resolve().parents[1]
LOCAL_MEDIA = ROOT / "backups" / "r2-export"
REMOTE_DIR = "/opt/football-api"


def ssh() -> paramiko.SSHClient:
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


def _safe(text: str) -> str:
    return text.encode("ascii", "replace").decode("ascii")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> str:
    print("==>", cmd[:160], flush=True)
    _i, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err else "")).strip()
    if text:
        print(_safe(text[-3000:]), flush=True)
    if code != 0:
        raise RuntimeError(f"failed ({code}): {cmd}\n{_safe(text[-800:])}")
    return out


def main() -> None:
    files = [p for p in LOCAL_MEDIA.rglob("*") if p.is_file()] if LOCAL_MEDIA.exists() else []
    print(f"local media files {len(files)}", flush=True)
    if not files:
        raise SystemExit(f"no files under {LOCAL_MEDIA}")

    tar_path = Path(tempfile.gettempdir()) / "football-media-upload.tgz"
    if tar_path.exists() and tar_path.stat().st_size > 50_000_000:
        print(f"reusing existing tar size={tar_path.stat().st_size}", flush=True)
    else:
        with tarfile.open(tar_path, "w:gz") as tar:
            for path in files:
                tar.add(path, arcname=path.relative_to(LOCAL_MEDIA).as_posix())
        print(f"tar size={tar_path.stat().st_size}", flush=True)

    client = ssh()

    # Pause API immediately so cron/warmup stop hitting API-Sports.
    run(client, "docker stop football-api || true")
    run(client, "docker ps --format 'table {{.Names}}\t{{.Status}}'")

    # Discover objects volume name
    vol = run(
        client,
        "docker volume ls --format '{{.Name}}' | grep football_api_objects | head -n 1",
    ).strip()
    if not vol:
        raise RuntimeError("football_api_objects volume not found")
    print(f"volume={vol}", flush=True)

    remote_tar = "/tmp/football-media-upload.tgz"
    sftp = client.open_sftp()
    print("uploading media tar...", flush=True)
    sftp.put(str(tar_path), remote_tar)
    # Patch DISABLE_CRON support into remote source + .env
    sftp.put(
        str(ROOT / "apps" / "node-api" / "src" / "main.ts"),
        f"{REMOTE_DIR}/apps/node-api/src/main.ts",
    )
    sftp.put(
        str(ROOT / "deploy" / "hetzner" / "docker-compose.yml"),
        f"{REMOTE_DIR}/deploy/hetzner/docker-compose.yml",
    )
    sftp.close()
    print("upload done", flush=True)

    run(
        client,
        f"docker run --rm -v {vol}:/objects -v {remote_tar}:/tmp/in.tgz:ro alpine:3.20 "
        "sh -lc 'mkdir -p /objects && tar -xzf /tmp/in.tgz -C /objects && "
        "find /objects -type f | wc -l && du -sh /objects'",
        timeout=1800,
    )
    run(client, f"rm -f {remote_tar}")

    # Ensure DISABLE_CRON=1 in env, rebuild/restart api only
    run(
        client,
        "grep -q '^DISABLE_CRON=' /opt/football-api/deploy/hetzner/.env && "
        "sed -i 's/^DISABLE_CRON=.*/DISABLE_CRON=1/' /opt/football-api/deploy/hetzner/.env || "
        "echo 'DISABLE_CRON=1' >> /opt/football-api/deploy/hetzner/.env; "
        "grep DISABLE_CRON /opt/football-api/deploy/hetzner/.env",
    )
    run(
        client,
        "docker run --rm --network football_api_net redis:7-alpine redis-cli -h football-api-redis DBSIZE",
    )
    run(
        client,
        "cd /opt/football-api/deploy/hetzner && docker compose -p football-api up -d --build api",
        timeout=1200,
    )
    # Ensure container will restart on reboot (was set to no during emergency stop)
    run(client, "docker update --restart=unless-stopped football-api || true")
    run(client, "sleep 3; curl -sS http://127.0.0.1:8787/health")
    run(client, "docker logs football-api --tail 20 2>&1")
    run(client, "curl -sI https://orefinder.io | head -n 1")
    run(client, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
    client.close()
    print("MEDIA_UPLOAD_DONE", flush=True)


if __name__ == "__main__":
    main()
