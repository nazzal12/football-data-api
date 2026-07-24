import { isId, validationError } from "@football-api/core";
import { getMatchListProjection } from "@football-api/storage";
import { Hono } from "hono";
import type { WorkerBindings } from "./env.js";
import { problem } from "./http.js";
import { createServices } from "./wiring.js";

const app = new Hono<{ Bindings: WorkerBindings }>();

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

app.get("/v1/projections/matches/:key", async (c) => {
  const key = c.req.param("key");
  const { objects, meta } = createServices(c.env);
  const projection = await getMatchListProjection(objects, meta, key);
  if (!projection) {
    return c.json(
      {
        type: "https://football-api.local/problems/not_found",
        title: "NOT_FOUND",
        status: 404,
        detail: "Projection not found",
        code: "NOT_FOUND",
      },
      404,
    );
  }
  c.header("Cache-Control", "public, max-age=60");
  return c.json(projection);
});

app.put("/v1/id-maps", async (c) => {
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

export default app;
export type { WorkerBindings };
