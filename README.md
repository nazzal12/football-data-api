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
apps/worker                      Hono Worker, orchestrator, routes, OpenAPI stub
packages/core                    Config, logger, errors, Result, clock, ids
packages/domain                  Canonical Zod schemas + public DTOs
packages/storage                 Cache / KV / R2 ports, fakes, projections
packages/lifecycle               Refresh policies and decide()
packages/provider                FootballProvider port + ID bridge + fake
packages/provider-api-football   API-Football adapter (isolated mappers)
```

## Prerequisites

- Node.js 20+
- pnpm 9 (`npm install -g pnpm@9.15.0`)

## Setup

```bash
pnpm install
cp .env.example .env
```

Wrangler local secrets (`apps/worker/.dev.vars`):

```
API_SPORTS_KEY=your-key
```

Replace KV/R2 ids in `apps/worker/wrangler.toml` before production deploy.

Bind an internal match id before first fetch:

```
idmap:api-football:match:<externalId> = <internalUuid>
idmap:api-football:internal:<internalUuid> = <externalId>
```

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
- `GET /v1/matches/:id` — match by internal UUID
- `GET /v1/matches/by-external/:externalId` — bootstrap from upstream fixture id
- `GET /v1/teams/:id` — team by internal UUID
- `GET /v1/teams/by-external/:externalId` — bootstrap from upstream team id
- `GET /v1/projections/matches/:key` — match list projection
- `PUT /v1/id-maps` — bind `{ externalType, externalId, internalId }`

OpenAPI: `apps/worker/openapi.json`. Progress: [docs/PROGRESS.md](docs/PROGRESS.md).

## Security

- Never commit `.env` or `.dev.vars`
- Never log or return `API_SPORTS_KEY`
- Provider payloads must not leak into public JSON or R2 canonical docs
