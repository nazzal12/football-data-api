import { isId, notFoundError, validationError } from "@football-api/core";
import { Hono } from "hono";
import type { WorkerBindings } from "./env.js";
import { problem } from "./http.js";
import { createServices } from "./wiring.js";
import { runWarmup } from "./warmup.js";

const app = new Hono<{ Bindings: WorkerBindings }>();

app.onError((error, c) => {
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

app.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "football-api",
    environment: c.env.ENVIRONMENT ?? "unknown",
  });
});

/** Bootstrap: fetch match by upstream fixture id (creates stable internal UUID in KV). */
app.get("/v1/matches/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getTeamByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(result.value.team);
});

app.get("/v1/teams/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid team id"), c.req.path).body, 400);
  }
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getTeam(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(result.value.team);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getPlayerByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.player);
});

app.get("/v1/players/by-external/:playerId/transfers", async (c) => {
  const playerId = c.req.param("playerId");
  if (!/^\d+$/.test(playerId)) {
    return c.json(problem(validationError("playerId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getPlayer(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.player);
});

app.get("/v1/coaches/by-external/:externalId", async (c) => {
  const externalId = c.req.param("externalId");
  if (!/^\d+$/.test(externalId)) {
    return c.json(problem(validationError("externalId must be numeric"), c.req.path).body, 400);
  }
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getCompetitionByExternal(c.req.raw, externalId);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  return c.json(result.value.competition);
});

app.get("/v1/competitions/:id", async (c) => {
  const id = c.req.param("id");
  if (!isId(id)) {
    return c.json(problem(validationError("Invalid competition id"), c.req.path).body, 400);
  }
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getCompetition(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.competition);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getMatchListProjection(c.req.raw, key);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.projection);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getMatchListProjection(
    c.req.raw,
    `league:${leagueId}:${seasonYear}`,
  );
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.projection);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getMatchListProjection(
    c.req.raw,
    `team:${teamId}:${seasonYear}`,
  );
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.projection);
});

app.get("/v1/projections/matches/live", async (c) => {
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getMatchListProjection(c.req.raw, "live");
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  c.header("X-Cache", result.value.cacheHit ? "HIT" : "MISS");
  c.header("X-Refreshed", result.value.refreshed ? "1" : "0");
  return c.json(result.value.projection);
});

app.get("/v1/countries/by-name/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name")).trim();
  if (!name) {
    return c.json(problem(validationError("name is required"), c.req.path).body, 400);
  }
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
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
  const { orchestrator } = createServices(c.env);
  const result = await orchestrator.getVenue(c.req.raw, id);
  if (!result.ok) {
    const p = problem(result.error, c.req.path);
    return c.json(p.body, p.status as 400 | 404 | 409 | 500 | 502 | 503);
  }
  c.header("Cache-Control", `public, max-age=${result.value.cacheTtlSeconds}`);
  return c.json(result.value.venue);
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
  const { orchestrator } = createServices(c.env);
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
  const { resolver } = createServices(c.env);
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
  const { resolver } = createServices(c.env);
  await resolver.bind(body.externalType, String(body.externalId), body.internalId);
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
    _controller: ScheduledController,
    env: WorkerBindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runWarmup(env).catch((err) => {
        console.error("warmup failed", err);
      }),
    );
  },
};
export type { WorkerBindings };
