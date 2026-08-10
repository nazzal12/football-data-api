# Football API — Client Integration Guide

> **For Cursor / agents:** Read this file before wiring any app, website, or SDK to the API.
> Prefer `by-external` routes to bootstrap entities, then store and reuse returned UUIDs.
> Never call API-Football (or any upstream) from the client — this API is the only public surface.
> Machine-readable contract: [`openapi.yaml`](./openapi.yaml).
> Swapping an existing Football Libre+ app/site off another API: [`MIGRATE-FOOTBALL-LIBRE.md`](./MIGRATE-FOOTBALL-LIBRE.md).

## Base URL

| Environment | URL |
|-------------|-----|
| Production | `https://football-api.nazzalkausar12.workers.dev` |
| Local | `http://127.0.0.1:8787` (after `pnpm --filter @football-api/worker run dev`) |

All public data routes are under `/v1/...`. No API key is required for reads.

---

## Core concepts (read first)

### 1. Internal IDs vs external IDs

| Kind | Shape | Where used |
|------|--------|------------|
| **Internal id** | UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) | Canonical `id` on every resource; path params like `/v1/matches/:id` |
| **External id** | Upstream numeric string (API-Football today) | Bootstrap paths: `/v1/.../by-external/:externalId` |

- First contact with a fixture/team/player: use **`by-external`**.
- Response includes a stable internal `id` — **persist that UUID** in your app DB / URL slugs / cache keys.
- Later loads: prefer `/v1/{resource}/:uuid` (and related child routes).
- Related entities are linked by UUID (`homeTeamId`, `seasonId`, …). Resolve them with their own endpoints.

### 2. Request-driven refresh

Refresh is **request-driven** through the orchestrator/lifecycle path:

| Kind | Cron? | Lifecycle |
|------|-------|-----------|
| Live match / live list / live match screen | **No** | 5s soft TTL; refresh only when a user hits an expired object |
| Pre-match (`future`) | Date-list cron only | Soft-expires **at kickoff** so the next user gets live data, not the cron snapshot |
| Finished / historical / yesterday | Cron may list them once | **Frozen forever** after stored — no further refresh |
| Teams, tournaments, today/tomorrow date lists | Yes, every **5 hours** | Catalog warmup only |

Fixture-by-date lists use timezone `America/Argentina/Buenos_Aires`; `kickoffAt` is UTC ISO — convert locally in the client.

### 3. Response envelope

Successful responses are **raw JSON resources** (not wrapped in `{ data: ... }`).

Every canonical resource includes:

```json
{
  "schemaVersion": 1,
  "id": "074db8fe-cb0b-4cc4-b1fd-6ae0f0ed3c68"
}
```

### 4. Useful response headers

| Header | Meaning |
|--------|---------|
| `Cache-Control` | `public, max-age=<seconds>` — safe browser/CDN TTL hint |
| `X-Cache` | `HIT` \| `MISS` (when set) |
| `X-Refreshed` | `1` if this request triggered a provider refresh |

### 5. Errors (RFC7807-style)

```json
{
  "type": "https://football-api.local/problems/provider",
  "title": "PROVIDER",
  "status": 502,
  "detail": "Provider returned errors",
  "instance": "/v1/matches/by-external/1208021",
  "code": "PROVIDER",
  "details": {}
}
```

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | `VALIDATION` | Bad path/body params |
| 401 | `UNAUTHORIZED` | Admin route only — bad `x-admin-token` |
| 404 | `NOT_FOUND` | Unknown id / unavailable object |
| 409 | `CONFLICT` | Lifecycle conflict |
| 500 | `INTERNAL` | Unexpected Worker error |
| 502 | `PROVIDER` / `UNAVAILABLE` | Upstream failure or rate limit |
| 503 | `QUOTA` / `UNAVAILABLE` | Quota exhausted or admin not configured |

**Client guidance:** treat `502` with `details.errors.rateLimit` as retryable (backoff 30–60s). Do not hammer list projections.

### 6. Auth

| Route class | Auth |
|-------------|------|
| All `GET` data routes | **None** (public) |
| `PUT /v1/id-maps` | Header `x-admin-token: <ADMIN_TOKEN>` |

---

## Well-known external IDs (API-Football)

Handy for demos and smoke tests (not exhaustive):

| Entity | External id | Notes |
|--------|-------------|--------|
| Premier League | `39` | Competition / league |
| Season year | `2024` | Use with league as `39` + `2024` |
| Manchester United | `33` | Team |
| Old Trafford | `556` | Venue |
| Example fixture | `1208021` | Match |

Country bootstrap uses **name**, not numeric id: `/v1/countries/by-name/England`.

---

## Integration recipes (copy these patterns)

### A. Match center page / screen

```
1. GET /v1/matches/by-external/{fixtureId}
2. Cache match.id, homeTeamId, awayTeamId, competitionId, seasonId
3. Parallel:
   GET /v1/matches/{matchId}/events
   GET /v1/matches/{matchId}/lineups
   GET /v1/matches/{matchId}/statistics
   GET /v1/matches/{matchId}/player-statistics
4. Optional: predictions, odds, injuries
5. Resolve teams: GET /v1/teams/{homeTeamId} and /v1/teams/{awayTeamId}
```

### B. League table + leaders

```
1. GET /v1/standings/by-external/{leagueId}/{seasonYear}
2. GET /v1/leaders/by-external/{leagueId}/{seasonYear}/goals
3. Resolve each row.teamId / row.playerId as needed
```

### C. Fixtures list (date / league / team / live)

```
1. GET /v1/projections/matches/by-date/2024-08-16
   or /by-league/{leagueId}/{seasonYear}
   or /by-team/{teamId}/{seasonYear}
   or /live
2. Response is `{ matchIds: UUID[], items?: MatchListItem[] }` — prefer `items` for list UIs (names, logos, score, phase) to avoid N+1 `/v1/matches/{id}` hydrates. Fall back to `matchIds` when `items` is absent.
3. For each id (batch/limit concurrency): GET /v1/matches/{id}
```

### D. Team hub

```
1. GET /v1/teams/by-external/{teamId}
2. Squad:  GET /v1/teams/by-external/{teamId}/squads/{leagueId}/{seasonYear}
3. Coach:  GET /v1/teams/by-external/{teamId}/coach
4. Stats:  GET /v1/teams/by-external/{teamId}/statistics/{leagueId}/{seasonYear}
5. Injuries: GET /v1/teams/by-external/{teamId}/injuries/{seasonYear}
6. Transfers: GET /v1/teams/by-external/{teamId}/transfers
```

### E. SEO / SSR tips

- Use **internal UUIDs** in canonical URLs once known (`/match/{uuid}`).
- Bootstrap once from external ids at ingest/build time; store UUID maps in your CMS/DB.
- Respect `Cache-Control`; projections + live data should be revalidated more often than static team profiles.
- Never expose `API_SPORTS_KEY` or `ADMIN_TOKEN` in frontend code.

---

## Endpoint catalog

Path params:

- `{id}` / `{matchId}` / etc. marked **uuid** → internal UUID
- `{externalId}` / `{teamId}` / `{leagueId}` / `{playerId}` / `{coachId}` marked **ext** → numeric string unless noted

### Health

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{ ok, service, environment }` |

### Matches

| Method | Path | Params | Response |
|--------|------|--------|----------|
| GET | `/v1/matches/by-external/{externalId}` | ext fixture id | `Match` |
| GET | `/v1/matches/{id}` | uuid | `Match` |
| GET | `/v1/matches/{id}/events` | uuid | `{ matchId, events: MatchEvent[] }` |
| GET | `/v1/matches/{id}/lineups` | uuid | `{ matchId, lineups: MatchLineup[] }` |
| GET | `/v1/matches/{id}/statistics` | uuid | `MatchStatistics` |
| GET | `/v1/matches/{id}/player-statistics` | uuid | `MatchPlayerStatistics` |
| GET | `/v1/matches/{id}/predictions` | uuid | `MatchPrediction` |
| GET | `/v1/matches/{id}/odds` | uuid | `MatchOdds` |
| GET | `/v1/matches/{id}/injuries` | uuid | `InjuryReport` |

### Match list projections

Returns **ids only** — hydrate with `/v1/matches/{id}`.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/v1/projections/matches/by-date/{date}` | `date` = `YYYY-MM-DD` |
| GET | `/v1/projections/matches/by-league/{leagueId}/{seasonYear}` | ext league + year |
| GET | `/v1/projections/matches/by-team/{teamId}/{seasonYear}` | ext team + year |
| GET | `/v1/projections/matches/live` | currently live fixtures |

Response: `MatchListProjection`

```json
{
  "schemaVersion": 1,
  "id": "...",
  "kind": "match_list",
  "key": "league:39:2024",
  "matchIds": ["uuid", "..."],
  "items": [
    {
      "matchId": "uuid",
      "competitionId": "uuid",
      "homeTeamId": "uuid",
      "awayTeamId": "uuid",
      "kickoffAt": "2026-07-25T15:00:00.000Z",
      "phase": "future",
      "status": "NS",
      "homeName": "Home",
      "awayName": "Away",
      "homeLogoUrl": "https://...",
      "awayLogoUrl": "https://...",
      "competitionName": "Premier League",
      "externalId": "1208021",
      "homeExternalId": "33",
      "awayExternalId": "34",
      "competitionExternalId": "39"
    }
  ]
}
```

### Teams

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/teams/by-external/{externalId}` | `Team` |
| GET | `/v1/teams/{id}` | `Team` |
| GET | `/v1/teams/by-external/{teamId}/squads/{leagueId}/{seasonYear}` | `Squad` |
| GET | `/v1/teams/by-external/{teamId}/coach` | `Coach` |
| GET | `/v1/teams/by-external/{teamId}/transfers` | `TransferReport` |
| GET | `/v1/teams/by-external/{teamId}/statistics/{leagueId}/{seasonYear}` | `TeamSeasonStatistics` |
| GET | `/v1/teams/by-external/{teamId}/injuries/{seasonYear}` | `InjuryReport` |

### Players

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/players/by-external/{externalId}` | `Player` |
| GET | `/v1/players/{id}` | `Player` |
| GET | `/v1/players/by-external/{playerId}/transfers` | `TransferReport` |
| GET | `/v1/players/by-external/{playerId}/trophies` | `TrophyReport` |
| GET | `/v1/players/by-external/{playerId}/sidelined` | `SidelinedReport` |

### Search

| Method | Path | Params | Response |
|--------|------|--------|----------|
| GET | `/v1/search` | `q` (min 3 chars) | `SearchResult` — teams, competitions, players with UUIDs |

Response shape:

```json
{
  "schemaVersion": 1,
  "id": "…",
  "query": "neym",
  "results": [
    {
      "type": "player",
      "id": "uuid",
      "externalId": "276",
      "displayName": "Neymar",
      "logoUrl": "https://…"
    }
  ]
}
```

`type` ∈ `team` | `competition` | `player`. Prefer `id` (UUID) for navigation; `externalId` is the upstream numeric id.

### Coaches

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/coaches/by-external/{externalId}` | `Coach` |
| GET | `/v1/coaches/{id}` | `Coach` |
| GET | `/v1/coaches/by-external/{coachId}/trophies` | `TrophyReport` |
| GET | `/v1/coaches/by-external/{coachId}/sidelined` | `SidelinedReport` |

### Competitions, seasons, standings, rounds

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/competitions/by-external/{externalId}` | `Competition` |
| GET | `/v1/competitions/{id}` | `Competition` |
| GET | `/v1/seasons/by-external/{leagueId}/{seasonYear}` | `Season` |
| GET | `/v1/seasons/{id}` | `Season` |
| GET | `/v1/seasons/by-external/{leagueId}/{seasonYear}/rounds` | `SeasonRounds` |
| GET | `/v1/standings/by-external/{leagueId}/{seasonYear}` | `Standings` |
| GET | `/v1/standings/{id}` | `Standings` |

### Leaders, H2H, countries, venues

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/leaders/by-external/{leagueId}/{seasonYear}/{kind}` | `SeasonLeaders` — `kind` ∈ `goals` \| `assists` \| `yellow_cards` \| `red_cards` |
| GET | `/v1/h2h/by-external/{teamA}/{teamB}` | `HeadToHead` — both ext team ids |
| GET | `/v1/countries/by-name/{name}` | `Country` — URL-encode spaces |
| GET | `/v1/venues/by-external/{externalId}` | `Venue` |
| GET | `/v1/venues/{id}` | `Venue` |
| GET | `/v1/search` | `SearchResult` — query param `q` (min 3 chars) |

### ID resolution

| Method | Path | Notes |
|--------|------|--------|
| GET | `/v1/ids/:internalId` | Returns `{ internalId, externalId }` from KV maps |

Use this when a client has a UUID and needs an upstream external id (e.g. standings / squads).


---

## Type reference

Source of truth in code: `packages/domain/src/canonical.ts` (Zod). Public DTOs match canonical for v1.

### Match

```ts
type MatchPhase = "future" | "live" | "finished" | "historical";

type Match = {
  schemaVersion: 1;
  id: string; // uuid
  seasonId: string;
  competitionId: string;
  phase: MatchPhase;
  status: string;
  kickoffAt: string; // ISO datetime
  venueId?: string;
  homeTeamId: string;
  awayTeamId: string;
  score?: { home: number; away: number };
  minute?: number;
  events: MatchEvent[];
  lineups: MatchLineup[];
};
```

### MatchEvent

```ts
type MatchEvent = {
  sequence: number;
  minute?: number;
  extraMinute?: number;
  type:
    | "goal"
    | "own_goal"
    | "penalty"
    | "missed_penalty"
    | "yellow_card"
    | "red_card"
    | "substitution"
    | "var"
    | "other";
  teamId?: string;
  playerId?: string;
  assistPlayerId?: string;
  detail?: string;
};
```

### Team / Player / Coach / Venue / Country

```ts
type Team = {
  schemaVersion: 1;
  id: string;
  name: string;
  shortName?: string;
  countryId?: string;
  venueId?: string;
};

type Player = {
  schemaVersion: 1;
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  nationality?: string;
  countryId?: string;
  dateOfBirth?: string;
  height?: string;
  weight?: string;
  position?: string;
  photoUrl?: string;
};

type Coach = {
  schemaVersion: 1;
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  dateOfBirth?: string;
  photoUrl?: string;
  teamId?: string;
  career: Array<{ teamId: string; start?: string; end?: string }>;
};

type Venue = {
  schemaVersion: 1;
  id: string;
  name: string;
  city?: string;
  countryId?: string;
  capacity?: number;
};

type Country = {
  schemaVersion: 1;
  id: string;
  name: string;
  code?: string; // 2–3 chars when present
};
```

### Competition / Season / Standings

```ts
type Competition = {
  schemaVersion: 1;
  id: string;
  name: string;
  format: "league" | "cup" | "international" | "other";
  isLeague: boolean;
  countryId?: string;
};

type Season = {
  schemaVersion: 1;
  id: string;
  competitionId: string;
  label: string;
  startDate?: string;
  endDate?: string;
};

type Standings = {
  schemaVersion: 1;
  id: string;
  seasonId: string;
  stage?: string;
  group?: string;
  rows: Array<{
    rank: number;
    teamId: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    form?: string;
  }>;
};
```

### Statistics & related

```ts
type MatchStatistics = {
  schemaVersion: 1;
  id: string;
  matchId: string;
  teams: Array<{
    teamId: string;
    metrics: Record<string, number | string | boolean | null>;
  }>;
};

type MatchPlayerStatistics = {
  schemaVersion: 1;
  id: string;
  matchId: string;
  players: Array<{
    playerId: string;
    teamId: string;
    metrics: Record<string, number | string | boolean | null>;
  }>;
};

type MatchPrediction = {
  schemaVersion: 1;
  id: string;
  matchId: string;
  advice?: string;
  winnerTeamId?: string;
  winOrDraw?: boolean;
  underOver?: string;
  goalsHome?: string;
  goalsAway?: string;
  percentHome?: number;
  percentDraw?: number;
  percentAway?: number;
  formHome?: string;
  formAway?: string;
};

type MatchOdds = {
  schemaVersion: 1;
  id: string;
  matchId: string;
  updatedAt?: string;
  bookmakers: Array<{
    name: string;
    bets: Array<{ name: string; values: Array<{ label: string; odd: number }> }>;
  }>;
};

type Squad = {
  schemaVersion: 1;
  id: string;
  seasonId: string;
  teamId: string;
  members: Array<{ playerId: string; shirtNumber?: number; position?: string }>;
};

type HeadToHead = {
  schemaVersion: 1;
  id: string;
  teamAId: string;
  teamBId: string;
  matchIds: string[];
};

type InjuryReport = {
  schemaVersion: 1;
  id: string;
  matchId?: string;
  teamId?: string;
  seasonId?: string;
  injuries: Array<{
    playerId: string;
    teamId: string;
    type?: string;
    reason?: string;
    startDate?: string;
  }>;
};

type SeasonLeaders = {
  schemaVersion: 1;
  id: string;
  seasonId: string;
  kind: "goals" | "assists" | "yellow_cards" | "red_cards";
  rows: Array<{ rank: number; playerId: string; teamId: string; value: number }>;
};

type SeasonRounds = {
  schemaVersion: 1;
  id: string;
  seasonId: string;
  rounds: string[];
};

type TransferReport = {
  schemaVersion: 1;
  id: string;
  teamId?: string;
  playerId?: string;
  transfers: Array<{
    playerId: string;
    date?: string;
    type?: string;
    fromTeamId?: string;
    toTeamId?: string;
  }>;
};

type TrophyReport = {
  schemaVersion: 1;
  id: string;
  subjectType: "player" | "team" | "coach";
  subjectId: string;
  trophies: Array<{
    place?: string;
    season?: string;
    competitionName?: string;
    country?: string;
  }>;
};

type SidelinedReport = {
  schemaVersion: 1;
  id: string;
  playerId?: string;
  coachId?: string;
  entries: Array<{ type?: string; start?: string; end?: string }>;
};

type TeamSeasonStatistics = {
  schemaVersion: 1;
  id: string;
  teamId: string;
  seasonId: string;
  form?: string;
  fixturesPlayed?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  cleanSheets?: number;
  failedToScore?: number;
  metrics: Record<string, number | string | boolean | null>;
};
```

---

## Minimal TypeScript client sketch

```ts
const BASE = "https://football-api.nazzalkausar12.workers.dev";

export class FootballApiError extends Error {
  constructor(
    public status: number,
    public body: { code?: string; detail?: string; details?: unknown },
  ) {
    super(body.detail ?? `HTTP ${status}`);
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new FootballApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

// Bootstrap then hydrate
const match = await apiGet<Match>(`/v1/matches/by-external/1208021`);
const [events, stats] = await Promise.all([
  apiGet<{ matchId: string; events: MatchEvent[] }>(`/v1/matches/${match.id}/events`),
  apiGet<MatchStatistics>(`/v1/matches/${match.id}/statistics`),
]);
```

---

## Not available (do not invent routes)

- Team trophies (`/trophies?team=` is unsupported upstream)
- Client-side provider keys / raw API-Football passthrough
- Uncapped “dump all fixtures” without projection caps
- Bookmaker / timezone / status catalog endpoints
- Write APIs for matches/teams (read-only platform except admin id-maps)

---

## Binding checklist for Cursor

When implementing a consumer app:

1. Set `FOOTBALL_API_BASE_URL` (or equivalent) to the production Worker URL.
2. Bootstrap with `by-external` using known league/team/fixture ids; persist returned UUIDs.
3. Use projections for lists; hydrate matches individually with concurrency limits (e.g. 5–10).
4. Handle `502`/`503` with backoff; surface friendly UI for rate limits.
5. Type responses from this doc or generate types from [`openapi.yaml`](./openapi.yaml).
6. Never put `ADMIN_TOKEN` or provider secrets in the client bundle.

