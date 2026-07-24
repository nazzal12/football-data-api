import {
  ConsoleLogger,
  FrozenClock,
  createId,
  providerError,
  quotaError,
} from "@football-api/core";
import type { Match } from "@football-api/domain";
import { FakeFootballProvider, MemoryIdBridge } from "@football-api/provider";
import { MemoryHttpCache, MemoryMetaStore, MemoryObjectStore } from "@football-api/storage";
import { describe, expect, it } from "vitest";
import { Orchestrator } from "./orchestrator.js";

function matchOf(id: string, phase: Match["phase"] = "finished"): Match {
  return {
    schemaVersion: 1,
    id,
    seasonId: createId(),
    competitionId: createId(),
    phase,
    status: phase === "live" ? "1H" : phase === "future" ? "NS" : "FT",
    kickoffAt: "2026-01-01T15:00:00.000Z",
    homeTeamId: createId(),
    awayTeamId: createId(),
    score: phase === "future" ? undefined : { home: 2, away: 2 },
    events: [],
    lineups: [],
  };
}

describe("hardening", () => {
  it("does not poison cache on provider error for cold miss", async () => {
    const id = createId();
    const provider = new FakeFootballProvider();
    provider.setError(providerError("upstream down"));
    const ids = new MemoryIdBridge();
    await ids.bind({ provider: "fake", externalType: "match", externalId: "e-cold" }, id);
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
    const req = new Request(`https://api.test/v1/matches/${id}`);
    const result = await orch.getMatch(req, id);
    expect(result.ok).toBe(false);
    expect(await cache.match(req)).toBeUndefined();
  });

  it("keeps prior object when refresh fails", async () => {
    const id = createId();
    const provider = new FakeFootballProvider();
    provider.setMatch("e-keep", matchOf(id, "live"));
    const ids = new MemoryIdBridge();
    await ids.bind({ provider: "fake", externalType: "match", externalId: "e-keep" }, id);
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
    const url = `https://api.test/v1/matches/${id}`;
    expect((await orch.getMatch(new Request(url), id)).ok).toBe(true);

    clock.advance(120_000);
    provider.setError(providerError("temporary"));
    const second = await orch.getMatch(new Request(url), id);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.match.score).toEqual({ home: 2, away: 2 });
  });

  it("accepts finished phase when live window was missed", async () => {
    const id = createId();
    const provider = new FakeFootballProvider();
    provider.setMatch("e-skip", matchOf(id, "finished"));
    const ids = new MemoryIdBridge();
    await ids.bind({ provider: "fake", externalType: "match", externalId: "e-skip" }, id);
    const orch = new Orchestrator({
      objects: new MemoryObjectStore(),
      meta: new MemoryMetaStore(),
      cache: new MemoryHttpCache(),
      provider,
      ids,
      clock: new FrozenClock("2026-01-01T16:00:00.000Z"),
      logger: new ConsoleLogger("error"),
    });
    const result = await orch.getMatch(new Request(`https://api.test/v1/matches/${id}`), id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.match.phase).toBe("finished");
  });

  it("exposes quota errors for API mapping", () => {
    expect(quotaError("daily exhausted").code).toBe("QUOTA");
  });
});
