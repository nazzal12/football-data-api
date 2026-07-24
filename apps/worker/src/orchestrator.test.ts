import { ConsoleLogger, FrozenClock, createId, providerError } from "@football-api/core";
import type { Match } from "@football-api/domain";
import { FakeFootballProvider, MemoryIdBridge } from "@football-api/provider";
import { MemoryHttpCache, MemoryMetaStore, MemoryObjectStore } from "@football-api/storage";
import { describe, expect, it } from "vitest";
import { Orchestrator } from "./orchestrator.js";

function sampleMatch(id: string, phase: Match["phase"] = "finished"): Match {
  return {
    schemaVersion: 1,
    id,
    seasonId: createId(),
    competitionId: createId(),
    phase,
    status: phase === "live" ? "1H" : "FT",
    kickoffAt: "2026-01-01T15:00:00.000Z",
    homeTeamId: createId(),
    awayTeamId: createId(),
    score: { home: 1, away: 0 },
    events: [],
    lineups: [],
  };
}

describe("Orchestrator getMatch", () => {
  it("coalesces concurrent refreshes after warm object goes stale", async () => {
    const internalId = createId();
    const externalId = "1208000";
    const match = sampleMatch(internalId, "live");
    const provider = new FakeFootballProvider();
    provider.setMatch(externalId, match);

    const ids = new MemoryIdBridge();
    await ids.bind({ provider: "fake", externalType: "match", externalId }, internalId);

    const clock = new FrozenClock("2026-01-01T16:00:00.000Z");
    const orch = new Orchestrator({
      objects: new MemoryObjectStore(),
      meta: new MemoryMetaStore(),
      cache: new MemoryHttpCache(),
      provider,
      ids,
      clock,
      logger: new ConsoleLogger("error"),
    });

    const url = `https://api.test/v1/matches/${internalId}`;
    const warm = await orch.getMatch(new Request(url), internalId);
    expect(warm.ok).toBe(true);
    const callsAfterWarm = provider.callCount;

    clock.advance(120_000);
    provider.setDelay(40);

    const [a, b, c] = await Promise.all([
      orch.getMatch(new Request(url), internalId),
      orch.getMatch(new Request(url), internalId),
      orch.getMatch(new Request(url), internalId),
    ]);

    expect(a.ok && b.ok && c.ok).toBe(true);
    expect(provider.callCount - callsAfterWarm).toBeLessThanOrEqual(2);
  });

  it("returns cache hit on second request", async () => {
    const internalId = createId();
    const externalId = "1208001";
    const match = sampleMatch(internalId);
    const provider = new FakeFootballProvider();
    provider.setMatch(externalId, match);
    const ids = new MemoryIdBridge();
    await ids.bind({ provider: "fake", externalType: "match", externalId }, internalId);
    const cache = new MemoryHttpCache();

    const orch = new Orchestrator({
      objects: new MemoryObjectStore(),
      meta: new MemoryMetaStore(),
      cache,
      provider,
      ids,
      clock: new FrozenClock("2026-01-01T16:00:00.000Z"),
      logger: new ConsoleLogger("error"),
    });

    const request = new Request(`https://api.test/v1/matches/${internalId}`);
    const first = await orch.getMatch(request, internalId);
    const second = await orch.getMatch(request, internalId);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.cacheHit).toBe(true);
    expect(provider.callCount).toBe(1);
  });

  it("serves stale when provider fails after prior success", async () => {
    const internalId = createId();
    const externalId = "1208002";
    const match = sampleMatch(internalId, "live");
    const provider = new FakeFootballProvider();
    provider.setMatch(externalId, match);
    const ids = new MemoryIdBridge();
    await ids.bind({ provider: "fake", externalType: "match", externalId }, internalId);
    const clock = new FrozenClock("2026-01-01T16:00:00.000Z");

    const orch = new Orchestrator({
      objects: new MemoryObjectStore(),
      meta: new MemoryMetaStore(),
      cache: new MemoryHttpCache(),
      provider,
      ids,
      clock,
      logger: new ConsoleLogger("error"),
    });

    const url = `https://api.test/v1/matches/${internalId}`;
    const first = await orch.getMatch(new Request(url), internalId);
    expect(first.ok).toBe(true);

    clock.advance(60_000);
    provider.setError(providerError("boom"));

    const second = await orch.getMatch(new Request(url), internalId);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.match.score).toEqual({ home: 1, away: 0 });
  });
});
