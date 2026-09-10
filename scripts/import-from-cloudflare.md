# Cloudflare → Hetzner data import

Cloudflare remains source of truth until cutover. Import into **football-api** Redis/volume only.

## KV → Redis

```bash
# from repo root (wrangler logged in)
pnpm exec tsx scripts/export-kv-to-jsonl.ts > /tmp/football-kv.jsonl

# against local tunnel or VPS redis (port-forward if needed)
ssh -L 6379:127.0.0.1:6379 user@168.119.180.149
# then, with football-api-redis published only on docker network, use:
docker compose -p football-api exec -T redis redis-cli PING

# simpler: copy jsonl to VPS and run import in api container network
scp /tmp/football-kv.jsonl user@vps:/tmp/
ssh user@vps 'docker run --rm -i --network football_api_net -e REDIS_URL=redis://football-api-redis:6379 node:22-bookworm-slim bash -lc "npm i -g tsx ioredis && tsx -e \"...\""'
```

Prefer running `import-kv-jsonl-to-redis.ts` on a machine that can reach Redis:

```bash
REDIS_URL=redis://127.0.0.1:6379 pnpm exec tsx scripts/import-kv-jsonl-to-redis.ts < /tmp/football-kv.jsonl
```

(Expose Redis temporarily via `127.0.0.1:6379:6379` in compose for import only, then remove.)

## R2 → disk volume

```bash
# with rclone configured for CF R2 account, or wrangler r2
pnpm exec wrangler r2 object get football-api-objects/<key> --file=...
# or bulk sync with rclone to /var/lib/football-api/objects
```

Mount target on VPS: Docker volume `football_api_objects`.
