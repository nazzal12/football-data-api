import { AppError, isId, notFoundError, validationError } from "@football-api/core";
import type { Result } from "@football-api/core";
import { Hono } from "hono";
import { decideAccess, isAccessGuardEnabled } from "./access.js";
import type { WorkerBindings } from "./env.js";
import { problem } from "./http.js";
import { createServices, type RuntimeEnv } from "./wiring.js";
import {
  runWarmup,
  warmupModeForCron,
  WARMUP_LAST_KEY,
  type WarmupLast,
} from "./warmup.js";
import type { GetMatchListResult } from "./orchestrator.js";
import {
  getOrCacheMedia,
  isMediaKind,
  rewriteLogoToMediaProxy,
} from "./media.js";

type AppBindings = WorkerBindings | RuntimeEnv;
type AppServices = ReturnType<typeof createServices>;

const app = new Hono<{ Bindings: AppBindings; Variables: { services: AppServices } }>();

app.use("*", async (c, next) => {
  const services = createServices(c.env);
  c.set("services", services);
  try {
    await next();
  } finally {
    await services.resolver.flush();
  }
});

/** Soft gate: Dart app, site Worker, site browser Origin/Referer — no API key. */
app.use("*", async (c, next) => {
  if (!isAccessGuardEnabled(c.env)) {
    await next();
    return;
  }
  const decision = decideAccess(c.req.raw, c.env);
  if (decision.allowed) {
    await next();
    return;
  }
  return c.json(
    {
      type: "https://football-api.local/problems/forbidden",
      title: "FORBIDDEN",
      status: 403,
      detail: "Client not allowed",
      instance: c.req.path,
      code: "FORBIDDEN",
    },
    403,
  );
});

app.onError((error, c) => {
  if (error instanceof AppError) {
    const p = problem(error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  const message = error instanceof Error ? error.message : String(error);
  return c.json(
    {
      type: "https://football-api.local/problems/internal",
      title: "INTERNAL",
      status: 500,
      detail: message,
      instance: c.req.path,
      code: "INTERNAL",
    },
    500,
  );
});

app.get("/health", async (c) => {
  const { meta } = c.get("services");
  const warmup = await meta.getJson<WarmupLast>(WARMUP_LAST_KEY);
  return c.json({
    ok: true,
    service: "football-api",
    environment: c.env.ENVIRONMENT ?? "unknown",
    ...(warmup ? { warmup } : {}),
  });
});

function scheduleProjectionRefresh(
  c: { executionCtx?: { waitUntil?: (promise: Promise<unknown>) => void } },
  result: Result<GetMatchListResult, AppError>,
): void {
  if (!result.ok) return;
  const bg = result.value.backgroundRefresh;
  if (!bg) return;
  const run = bg().catch((err: unknown) => {
    console.error("projection background refresh failed", err);
  });
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(run);
  }
}

function requestOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://football-api.nazzalkausar12.workers.dev";
  }
}

/** Point list/entity logo fields at /v1/media so images are served from R2. */
function rewriteProjectionLogos<T>(projection: T, origin: string): T {
  if (!projection || typeof projection !== "object") return projection;
  const doc = projection as {
    items?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(doc.items)) return projection;
  for (const item of doc.items) {
    if (item.homeLogoUrl != null) {
      item.homeLogoUrl = rewriteLogoToMediaProxy(String(item.homeLogoUrl), origin);
    }
    if (item.awayLogoUrl != null) {
      item.awayLogoUrl = rewriteLogoToMediaProxy(String(item.awayLogoUrl), origin);
    }
    if (item.competitionLogoUrl != null) {
      item.competitionLogoUrl = rewriteLogoToMediaProxy(
        String(item.competitionLogoUrl),
        origin,
      );
    }
  }
  return projection;
}

function rewriteEntityLogo<T extends { logoUrl?: string; photoUrl?: string }>(
  entity: T,
  origin: string,
): T {
  if (entity.logoUrl) {
    entity.logoUrl = rewriteLogoToMediaProxy(entity.logoUrl, origin);
  }
  if (entity.photoUrl) {
    entity.photoUrl = rewriteLogoToMediaProxy(entity.photoUrl, origin);
  }
  return entity;
}

/** R2-backed media proxy for team / league / player / venue images. */
app.get("/v1/media/:kind/:file", async (c) => {
  const kindRaw = c.req.param("kind");
  const file = c.req.param("file");
  const idMatch = /^(\d+)\.png$/i.exec(file);
  if (!isMediaKind(kindRaw) || !idMatch) {
    return c.json(
      problem(
        validationError("path must be /v1/media/{teams|leagues|players|venues}/{id}.png"),
        c.req.path,
      ).body,
      400,
    );
  }
  const externalId = idMatch[1];
  if (!externalId) {
    return c.json(problem(validationError("missing media id"), c.req.path).body, 400);
  }
  const { objects } = c.get("services");
  try {
    const result = await getOrCacheMedia({
      objects,
      kind: kindRaw,
      externalId,
    });
    c.header("Content-Type", result.contentType);
    c.header("Cache-Control", "public, max-age=604800, immutable");
    c.header("X-Cache", result.cacheHit ? "HIT" : "MISS");
    return new Response(result.body as unknown as BodyInit, {
      status: 200,
      headers: c.res.headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(problem(notFoundError(message), c.req.path).body, 404);
  }
});
/** Bootstrap: fetch match by upstream fixture id (creates stable internal UUID in KV). */
app.get("/v1/matches/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.match);
});

app.get("/v1/matches/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatch(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.match);
});

app.get("/v1/matches/:id/events", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchEvents(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json({ matchId: result.value.matchId, events: result.value.events });
});

app.get("/v1/matches/:id/lineups", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchLineups(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json({ matchId: result.value.matchId, lineups: result.value.lineups });
});

app.get("/v1/matches/:id/statistics", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchStatistics(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.statistics);
});

app.get("/v1/matches/:id/predictions", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchPrediction(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.prediction);
});

app.get("/v1/matches/:id/odds", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchOdds(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.odds);
});

app.get("/v1/matches/:id/injuries", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchInjuries(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.injuries);
});

app.get("/v1/matches/:id/player-statistics", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid match id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchPlayerStatistics(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.statistics);
});

app.get("/v1/h2h/by-external/:teamA/:teamB", async (c) => {
  const teamA = c.req.param("teamA");
  const teamB = c.req.param("teamB");
  if (!/^\d+$/.test(teamA) || !/^\d+$/.test(teamB) || teamA === teamB) {
    return c.json(
      problem(validationError("teamA and teamB must be distinct numeric ids"), c.req.path).body,
      400,
    );
  }
  const a = Number(teamA);
  const b = Number(teamB);
  const externalId = a < b ? `${a}-${b}` : `${b}-${a}`;
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getHeadToHead(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.h2h);
});

app.get("/v1/leaders/by-external/:leagueId/:seasonYear/:kind", async (c) => {
  const leagueId = c.req.param("leagueId");
  const seasonYear = c.req.param("seasonYear");
  const kind = c.req.param("kind");
  if (
    !/^\d+$/.test(leagueId) ||
    !/^\d{4}$/.test(seasonYear) ||
    !["goals", "assists", "yellow_cards", "red_cards"].includes(kind)
  ) {
    return c.json(
      problem(
        validationError("kind must be goals|assists|yellow_cards|red_cards"),
        c.req.path,
      ).body,
      400,
    );
  }
  const externalId = `${leagueId}:${seasonYear}:${kind}`;
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getSeasonLeaders(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.leaders);
});

app.get("/v1/teams/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTeamByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(rewriteEntityLogo(result.value.team, requestOrigin(c.req.raw)));
});

app.get("/v1/teams/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid team id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTeam(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(rewriteEntityLogo(result.value.team, requestOrigin(c.req.raw)));
});

/** Squad: team + league + season (league binds canonical season id). */
app.get("/v1/teams/by-external/:teamId/squads/:leagueId/:seasonYear", async (c) => {
  const teamId = c.req.param("teamId");
  const leagueId = c.req.param("leagueId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(teamId) || !/^\d+$/.test(leagueId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("teamId, leagueId, seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const externalId = `${teamId}:${leagueId}:${seasonYear}`;
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getSquadByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.squad);
});

app.get("/v1/teams/by-external/:teamId/coach", async (c) => {
  const teamId = c.req.param("teamId");
  if (!/^\d+$/.test(teamId)) {
    return c.json(problem(validationError("teamId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTeamCoachByExternal(c.req.raw, teamId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.coach);
});

app.get("/v1/teams/by-external/:teamId/transfers", async (c) => {
  const teamId = c.req.param("teamId");
  if (!/^\d+$/.test(teamId)) {
    return c.json(problem(validationError("teamId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTransfersByExternal(c.req.raw, `team:${teamId}`);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.transfers);
});

app.get("/v1/teams/by-external/:teamId/statistics/:leagueId/:seasonYear", async (c) => {
  const teamId = c.req.param("teamId");
  const leagueId = c.req.param("leagueId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(teamId) || !/^\d+$/.test(leagueId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("teamId, leagueId, seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTeamSeasonStatisticsByExternal(
    c.req.raw,
    `${teamId}:${leagueId}:${seasonYear}`,
  );
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.statistics);
});

app.get("/v1/teams/by-external/:teamId/injuries/:seasonYear", async (c) => {
  const teamId = c.req.param("teamId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(teamId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("teamId and seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTeamInjuriesByExternal(
    c.req.raw,
    `team:${teamId}:${seasonYear}`,
  );
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.injuries);
});

app.get("/v1/players/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getPlayerByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(rewriteEntityLogo(result.value.player, requestOrigin(c.req.raw)));
});

app.get("/v1/players/by-external/:playerId/transfers", async (c) => {
  const playerId = c.req.param("playerId");
  if (!/^\d+$/.test(playerId)) {
    return c.json(problem(validationError("playerId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTransfersByExternal(c.req.raw, `player:${playerId}`);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.transfers);
});

app.get("/v1/players/by-external/:playerId/trophies", async (c) => {
  const playerId = c.req.param("playerId");
  if (!/^\d+$/.test(playerId)) {
    return c.json(problem(validationError("playerId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTrophiesByExternal(c.req.raw, `player:${playerId}`);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.trophies);
});

app.get("/v1/players/by-external/:playerId/sidelined", async (c) => {
  const playerId = c.req.param("playerId");
  if (!/^\d+$/.test(playerId)) {
    return c.json(problem(validationError("playerId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getSidelinedByExternal(c.req.raw, `player:${playerId}`);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.sidelined);
});

app.get("/v1/players/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid player id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getPlayer(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(rewriteEntityLogo(result.value.player, requestOrigin(c.req.raw)));
});

app.get("/v1/coaches/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getCoachByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.coach);
});

app.get("/v1/coaches/by-external/:coachId/trophies", async (c) => {
  const coachId = c.req.param("coachId");
  if (!/^\d+$/.test(coachId)) {
    return c.json(problem(validationError("coachId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getTrophiesByExternal(c.req.raw, `coach:${coachId}`);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.trophies);
});

app.get("/v1/coaches/by-external/:coachId/sidelined", async (c) => {
  const coachId = c.req.param("coachId");
  if (!/^\d+$/.test(coachId)) {
    return c.json(problem(validationError("coachId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getSidelinedByExternal(c.req.raw, `coach:${coachId}`);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.sidelined);
});

app.get("/v1/coaches/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid coach id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getCoach(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.coach);
});

app.get("/v1/competitions/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getCompetitionByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(rewriteEntityLogo(result.value.competition, requestOrigin(c.req.raw)));
});

app.get("/v1/competitions/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid competition id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getCompetition(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(rewriteEntityLogo(result.value.competition, requestOrigin(c.req.raw)));
});

/** Season: /v1/seasons/by-external/:leagueId/:seasonYear e.g. 39/2024 */
app.get("/v1/seasons/by-external/:leagueId/:seasonYear", async (c) => {
  const leagueId = c.req.param("leagueId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(leagueId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("leagueId and seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const externalId = `${leagueId}:${seasonYear}`;
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getSeasonByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(result.value.season);
});

app.get("/v1/seasons/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid season id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getSeason(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.season);
});

/** Standings: /v1/standings/by-external/:leagueId/:seasonYear e.g. 39/2025 */
app.get("/v1/standings/by-external/:leagueId/:seasonYear", async (c) => {
  const leagueId = c.req.param("leagueId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(leagueId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("leagueId and seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const externalId = `${leagueId}:${seasonYear}`;
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getStandingsByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(result.value.standings);
});

app.get("/v1/standings/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid standings id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getStandings(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.standings);
});

/** Match-list projection: refresh-on-read for calendar date lists. */
app.get("/v1/projections/matches/by-date/:date", async (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json(problem(validationError("date must be YYYY-MM-DD"), c.req.path).body, 400);
  }
  const key = `date:${date}`;
  const forceRefresh = c.req.query("force") === "1";
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchListProjection(c.req.raw, key, {
    forceRefresh,
  });
  scheduleProjectionRefresh(c, result);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  c.header("X-SWR", result.value.backgroundRefresh ? "1" : "0");
  return c.json(rewriteProjectionLogos(result.value.projection, requestOrigin(c.req.raw)));
});

app.get("/v1/projections/matches/by-league/:leagueId/:seasonYear", async (c) => {
  const leagueId = c.req.param("leagueId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(leagueId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("leagueId and seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchListProjection(
    c.req.raw,
    `league:${leagueId}:${seasonYear}`,
  );
  scheduleProjectionRefresh(c, result);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  c.header("X-SWR", result.value.backgroundRefresh ? "1" : "0");
  return c.json(rewriteProjectionLogos(result.value.projection, requestOrigin(c.req.raw)));
});

app.get("/v1/projections/matches/by-team/:teamId/:seasonYear", async (c) => {
  const teamId = c.req.param("teamId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(teamId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("teamId and seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchListProjection(
    c.req.raw,
    `team:${teamId}:${seasonYear}`,
  );
  scheduleProjectionRefresh(c, result);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  c.header("X-SWR", result.value.backgroundRefresh ? "1" : "0");
  return c.json(rewriteProjectionLogos(result.value.projection, requestOrigin(c.req.raw)));
});

app.get("/v1/projections/matches/live", async (c) => {
  const forceRefresh = c.req.query("force") === "1";
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getMatchListProjection(c.req.raw, "live", {
    forceRefresh,
  });
  scheduleProjectionRefresh(c, result);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  c.header("X-SWR", result.value.backgroundRefresh ? "1" : "0");
  return c.json(rewriteProjectionLogos(result.value.projection, requestOrigin(c.req.raw)));
});

app.get("/v1/countries/by-name/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name")).trim();
  if (!name) {
    return c.json(problem(validationError("name is required"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getCountryByExternal(c.req.raw, name);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.country);
});

app.get("/v1/venues/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getVenueByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.venue);
});

app.get("/v1/venues/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid venue id"), c.req.path).body, 400);
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getVenue(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.venue);
});

/** Text search across teams, competitions, and players (min 3 chars). */
app.get("/v1/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 3) {
    return c.json(
      problem(validationError("Query parameter q must be at least 3 characters"), c.req.path).body,
      400,
    );
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.search(c.req.raw, q);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.search);
});

app.get("/v1/seasons/by-external/:leagueId/:seasonYear/rounds", async (c) => {
  const leagueId = c.req.param("leagueId");
  const seasonYear = c.req.param("seasonYear");
  if (!/^\d+$/.test(leagueId) || !/^\d{4}$/.test(seasonYear)) {
    return c.json(
      problem(validationError("leagueId and seasonYear must be numeric"), c.req.path).body,
      400,
    );
  }
  const { orchestrator } = c.get("services");
  const result = await orchestrator.getSeasonRoundsByExternal(
    c.req.raw,
    `${leagueId}:${seasonYear}`,
  );
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.rounds);
});

app.get("/v1/ids/:internalId", async (c) => {
  const internalId = c.req.param("internalId");
  if (!isId(internalId)) {
    return c.json(problem(validationError("Invalid id"), c.req.path).body, 400);
  }
  const { resolver } = c.get("services");
  const externalId = await resolver.toExternal(internalId);
  if (!externalId) {
    return c.json(problem(notFoundError("No external id for resource", { id: internalId }), c.req.path).body, 404);
  }
  return c.json({ internalId, externalId });
});

app.put("/v1/id-maps", async (c) => {
  const adminToken = c.env.ADMIN_TOKEN;
  if (!adminToken) {
    return c.json(
      {
        type: "https://football-api.local/problems/unavailable",
        title: "UNAVAILABLE",
        status: 503,
        detail: "ADMIN_TOKEN is not configured",
        code: "UNAVAILABLE",
      },
      503,
    );
  }
  const provided = c.req.header("x-admin-token");
  if (provided !== adminToken) {
    return c.json(
      {
        type: "https://football-api.local/problems/unauthorized",
        title: "UNAUTHORIZED",
        status: 401,
        detail: "Invalid or missing x-admin-token",
        code: "UNAUTHORIZED",
      },
      401,
    );
  }
  const body = await c.req.json<{
    externalType?: string;
    externalId?: string;
    internalId?: string;
  }>();
  if (!body.externalType || !body.externalId || !body.internalId || !isId(body.internalId)) {
    return c.json(
      problem(
        validationError("externalType, externalId, and internalId (uuid) are required"),
        c.req.path,
      ).body,
      400,
    );
  }
  const { resolver } = c.get("services");
  await resolver.bind(body.externalType, String(body.externalId), body.internalId);
  await resolver.flush();
  return c.json({
    ok: true,
    externalType: body.externalType,
    externalId: String(body.externalId),
    internalId: body.internalId,
  });
});

export default {
  fetch: app.fetch,
  async scheduled(
    controller: ScheduledController,
    env: WorkerBindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    const mode = warmupModeForCron(controller.cron);
    ctx.waitUntil(
      runWarmup(env, { mode }).catch((err) => {
        console.error("warmup failed", { mode, err });
      }),
    );
  },
};
export { app };
export type { WorkerBindings, AppBindings };
export type { RuntimeEnv } from "./wiring.js";
