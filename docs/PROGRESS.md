# Implementation progress

| Phase | Status |
|-------|--------|
| 1 Foundation | Done |
| 2 Core | Done |
| 3 Canonical schema | Done |
| 4 Storage | Done |
| 5 Lifecycle | Done |
| 6 Provider port | Done |
| 7 API-Football adapter | Done |
| 8 Orchestrator | Done |
| 9 REST API | Done (`GET /health`, `GET /v1/matches/:id`) |
| 10 Hardening tests | Done |
| 11 Projections / TTL hints | Done |
| 12 Live bindings + bootstrap routes | Done |

### Phase 12 notes

- Persistent KV id maps (`PersistentIdResolver`)
- `GET /v1/matches/by-external/:id`, `GET /v1/teams/by-external/:id`
- `GET /v1/teams/:id`, `GET /v1/projections/matches/:key`, `PUT /v1/id-maps`
- Fixed Workers `fetch` illegal invocation
- Cold-miss retries past failed backoff

Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test` green.
Live check: `GET /health` and `GET /v1/teams/by-external/33` succeed on wrangler dev.
