# Migrate Football Libre+ (app + website) → this Football API

Use this when an existing **Football Libre+** app or site is already bound to another football API, and you want to **swap only the HTTP layer** (base URL + endpoints + response mapping). Keep existing UI, routing, and product rules.

Canonical contract (do not invent paths):

- Human guide: [`API.md`](./API.md)
- OpenAPI: [`openapi.yaml`](./openapi.yaml)
- Cursor rule: [`.cursor/rules/football-api-client.mdc`](../.cursor/rules/football-api-client.mdc)

---

## 1. What changes vs what stays

| Change | Keep |
|--------|------|
| Base URL → this Worker | Screen layout, tabs, branding |
| Endpoint paths + query shapes | Business rules (featured leagues, LATAM TZ display, etc.) |
| Response field mapping (old DTO → new canonical JSON) | Offline/retry UX patterns you already like |
| ID strategy (external bootstrap → internal UUID) | Auth/session for *your* product (this API’s reads need no key) |

**Never** call API-Football (or the old upstream) from the browser/app. **Never** ship `API_SPORTS_KEY` / `ADMIN_TOKEN` to clients.

---

## 2. New base URL

```text
Production: https://football-api.nazzalkausar12.workers.dev
Local:      http://127.0.0.1:8787
```

Public reads: `GET /v1/...` — **no API key**.

---

## 3. Mental model (required)

1. **Bootstrap** with upstream ids via `/v1/.../by-external/...` (or name for countries).
2. **Persist** the returned UUID (`id`) for that entity.
3. **Later** call `/v1/{resource}/{uuid}` and child routes.
4. **Lists** come from `/v1/projections/matches/...` as `matchIds` + optional rich `items[]`. Prefer `items` for cards; hydrate `/v1/matches/{id}` only when you need full detail.
5. Treat `502` / `503` (rate limit / quota) as **retryable with backoff**.

Fixture date lists use timezone `America/Argentina/Buenos_Aires`. `kickoffAt` is UTC ISO — convert with the device/browser locale.

---

## 4. Screen → endpoint map (wiring cheat sheet)

### Home / today’s matches

| Need | Call |
|------|------|
| Fixtures for a calendar day | `GET /v1/projections/matches/by-date/{YYYY-MM-DD}` |
| Live list | `GET /v1/projections/matches/live` |
| Card fields without N+1 | Use projection `items[]` (`phase`, `score`, `minute`, names, logos) |

**Client refresh suggestion:** today list ~every **5 min**; live list / live detail ~every **5 s** (server soft TTLs match this).

### Match detail

| Tab / block | Call |
|-------------|------|
| Header / scoreboard | `GET /v1/matches/{matchId}` or bootstrap `.../by-external/{fixtureId}` |
| Timeline | `GET /v1/matches/{matchId}/events` |
| Lineups | `GET /v1/matches/{matchId}/lineups` |
| Team stats | `GET /v1/matches/{matchId}/statistics` |
| Player match stats | `GET /v1/matches/{matchId}/player-statistics` |
| Predictions | `GET /v1/matches/{matchId}/predictions` |
| Odds | `GET /v1/matches/{matchId}/odds` |
| Injuries | `GET /v1/matches/{matchId}/injuries` |
| H2H | `GET /v1/h2h/by-external/{homeExt}/{awayExt}` → then hydrate `matchIds` |
| Teams / logos | `GET /v1/teams/{teamId}` (or `by-external`) |
| Venue | `GET /v1/venues/{venueId}` |

### League / tournament

| Need | Call |
|------|------|
| Competition | `GET /v1/competitions/by-external/{leagueId}` |
| Season | `GET /v1/seasons/by-external/{leagueId}/{year}` |
| Table | `GET /v1/standings/by-external/{leagueId}/{year}` |
| Fixtures | `GET /v1/projections/matches/by-league/{leagueId}/{year}` |
| Rounds | `GET /v1/seasons/by-external/{leagueId}/{year}/rounds` |
| Top scorers / assists / cards | `GET /v1/leaders/by-external/{leagueId}/{year}/{kind}` where `kind` ∈ `goals` \| `assists` \| `yellow_cards` \| `red_cards` |

### Team hub

| Need | Call |
|------|------|
| Profile | `GET /v1/teams/by-external/{teamId}` |
| Squad | `GET /v1/teams/by-external/{teamId}/squads/{leagueId}/{year}` |
| Coach | `GET /v1/teams/by-external/{teamId}/coach` |
| Season stats | `GET /v1/teams/by-external/{teamId}/statistics/{leagueId}/{year}` |
| Injuries | `GET /v1/teams/by-external/{teamId}/injuries/{year}` |
| Transfers | `GET /v1/teams/by-external/{teamId}/transfers` |
| Fixtures | `GET /v1/projections/matches/by-team/{teamId}/{year}` |

### Player pages (already on this API)

You do **not** need new player routes for a basic player profile hub:

| Need | Call |
|------|------|
| Profile (name, photo, position, DOB, …) | `GET /v1/players/by-external/{playerId}` then `GET /v1/players/{uuid}` |
| Transfers | `GET /v1/players/by-external/{playerId}/transfers` |
| Trophies | `GET /v1/players/by-external/{playerId}/trophies` |
| Sidelined / injury history | `GET /v1/players/by-external/{playerId}/sidelined` |
| Search (team / league / player) | `GET /v1/search?q={text}` (min 3 chars) |
| Link from lineup / leaders | Use `playerId` UUID on events/lineups/leaders → `GET /v1/players/{uuid}` |
| Resolve UUID → upstream id | `GET /v1/ids/{internalId}` → `{ internalId, externalId }` |

**Possible gaps** (add later only if the site needs them):

- Player **season** statistics (goals/apps by league-season) — not a dedicated public route yet.
- Player **career** / multi-season history aggregate — not a dedicated route yet.
- ~~Player search / catalog listing~~ — use `GET /v1/search?q=` (teams, competitions, players).

If your website player page needs season stats, say so and we can add e.g.  
`GET /v1/players/by-external/{playerId}/statistics/{leagueId}/{seasonYear}` behind the same lifecycle rules.

### Coach pages

| Need | Call |
|------|------|
| Profile | `GET /v1/coaches/by-external/{coachId}` |
| Trophies / sidelined | `.../trophies`, `.../sidelined` |

---

## 5. Practical swap steps (app or website)

### Step A — Config

1. Replace old API base URL with the Worker URL above.
2. Remove old API keys from client env (reads are public).
3. Keep any *product* keys (analytics, auth) unchanged.

### Step B — HTTP client adapter

Create one adapter module (name ideas: `FootballApiClient`, `api/football.ts`) that:

- Prefixes paths with `/v1`
- Parses RFC7807 errors (`code`, `detail`, `status`)
- Retries `429` / `502` / `503` with backoff
- Honors `Cache-Control` (or use short TTL for live / today)

Do **not** scatter raw `fetch` URLs across screens.

### Step C — Replace call sites screen by screen

For each old call:

1. Find the matching row in §4.
2. Map response fields once in a mapper (old UI model ← new JSON).
3. Prefer projection `items` for lists; full `Match` only on detail.

Suggested order: **live → today → match detail → team → league → player**.

### Step D — IDs in routes / DB

| If old app stored… | Do this |
|--------------------|---------|
| Upstream fixture/team/player ids in URLs | Keep working via `by-external`, then redirect/store UUID |
| Own DB rows keyed by upstream id | Add `internal_uuid` column; fill on first bootstrap |
| Deep links with UUIDs already | Call `/v1/{resource}/{uuid}` directly |

### Step E — Smoke checklist

```text
GET /health
GET /v1/projections/matches/live
GET /v1/projections/matches/by-date/{today}
GET /v1/matches/by-external/{knownFixture}
GET /v1/matches/{uuid}/events
GET /v1/matches/{uuid}/statistics
GET /v1/teams/by-external/33
GET /v1/players/by-external/{knownPlayer}
GET /v1/standings/by-external/39/2024
```

---

## 6. Response shape tips (common breakage)

- Success bodies are **raw resources**, not `{ data: ... }` wrappers.
- Every resource has `schemaVersion: 1` and `id` (UUID).
- Match phase is `future` | `live` | `finished` | `historical` (not provider-specific status codes).
- List projections:

```json
{
  "schemaVersion": 1,
  "id": "...",
  "kind": "match_list",
  "key": "date:2026-07-26",
  "matchIds": ["..."],
  "items": [
    {
      "matchId": "...",
      "phase": "live",
      "minute": 67,
      "score": { "home": 1, "away": 0 },
      "homeName": "...",
      "awayName": "...",
      "homeLogoUrl": "...",
      "awayLogoUrl": "..."
    }
  ]
}
```

- Player profile fields today: `name`, `firstName`, `lastName`, `age`, `nationality`, `dateOfBirth`, `height`, `weight`, `position`, `photoUrl`, optional `countryId`.

---

## 7. What “done” looks like

- [ ] No remaining imports/calls to the old API host
- [ ] No upstream API keys in app/web bundles
- [ ] All list UIs use projections (`items` when present)
- [ ] Match / team / player pages bootstrap with `by-external` then cache UUIDs
- [ ] Live + today polling respects 5s / 5m guidance
- [ ] Player pages wired to `/v1/players/...` (+ transfers / trophies / sidelined)
- [ ] 502/503 handled with retry UI

---

## 8. Hand this to Cursor in the other repo

Paste into the Football Libre+ app/website chat:

```text
Migrate HTTP wiring only to our Football API.
Read football-api docs/MIGRATE-FOOTBALL-LIBRE.md and docs/API.md.
Base URL: https://football-api.nazzalkausar12.workers.dev
Rules: by-external bootstrap → persist UUIDs; projections for lists;
never call API-Football from the client; retry 502/503.
Do not redesign UI. Replace endpoints + mappers only.
Player pages: use /v1/players/by-external/:id plus transfers/trophies/sidelined.
```

If you paste 5–10 old endpoint examples from the current binding, we can add an explicit **old path → new path** table next.
