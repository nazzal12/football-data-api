# Football API

Provider-agnostic football data platform on Cloudflare Workers.

Powers a programmatic SEO website and Android app via a public REST API only.
Clients never talk to upstream providers.

## Architecture (locked)

| Store | Role |
|-------|------|
| **R2** (`OBJECTS`) | Canonical domain objects |
| **KV** (`META`) | Lifecycle metadata, indexes, refresh leases |
| **Cache API** | Serialized public HTTP responses |

Refresh is **request-driven** only. No cron. Provider adapters are replaceable.

## Workspace layout

```
apps/worker                 Hono Worker, orchestrator, routes
packages/core               Config, logger, errors, Result, clock, ids
packages/domain             Canonical Zod schemas + public DTOs
packages/storage            Cache / KV / R2 ports + implementations
packages/lifecycle          Refresh policies and decide()
packages/provider           FootballProvider port + ID bridge + quota
packages/provider-api-football  API-Football adapter (isolated)
```

## Prerequisites

- Node.js 20+
- pnpm 9 (`npm install -g pnpm@9.15.0`)

## Setup

```bash
pnpm install
cp .env.example .env   # set API_SPORTS_KEY for local provider calls
```

For Wrangler local secrets:

```bash
# apps/worker/.dev.vars
API_SPORTS_KEY=your-key
```

KV/R2 binding IDs in `apps/worker/wrangler.toml` are placeholders. Replace with real
Cloudflare resource IDs before production deploy. Local `wrangler dev` uses Miniflare.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm lint` | Biome check |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm test` | Vitest |
| `pnpm dev` | Wrangler local Worker |
| `pnpm deploy` | Deploy Worker |

## Public API

- `GET /health` — liveness

Domain routes are added in later phases (`GET /v1/matches/:id`, …).

## Security

- Never commit `.env` or `.dev.vars`
- Never log or return `API_SPORTS_KEY`
- Provider payloads must not leak into public JSON or R2 canonical docs
