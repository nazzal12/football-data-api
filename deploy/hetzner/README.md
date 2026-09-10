# Hetzner sidecar (football-api)

Separate Docker Compose project next to orefinder.io / CloudPanel.

## Local backup (already created)

- Git tag/branch: `backup/pre-hetzner-20260810`
- Config copy: `backups/pre-hetzner-20260810/`

## Deploy (VPS)

```bash
# new directory — not inside orefinder
sudo mkdir -p /opt/football-api
# copy repo or deploy/hetzner + built context
cd /opt/football-api/deploy/hetzner
cp .env.example .env   # fill API_SPORTS_KEY etc.
docker compose -p football-api up -d --build
curl -s http://127.0.0.1:8787/health
# confirm orefinder still up
curl -sI https://orefinder.io | head -n1
```

API listens on **127.0.0.1:8787** only. Add a CloudPanel proxy vhost later for `api.verfutbollibre.net`.

## Data import

See `scripts/import-from-cloudflare.md`.
