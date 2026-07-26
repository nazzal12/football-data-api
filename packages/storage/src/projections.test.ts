import { createId } from "@football-api/core";
import { describe, expect, it } from "vitest";
import {
  MemoryMetaStore,
  MemoryObjectStore,
  cacheMaxAgeForPhase,
  getMatchListProjection,
  parseMatchListProjectionKey,
  putMatchListProjection,
} from "./index.js";

describe("projections", () => {
  it("stores and loads match list projection", async () => {
    const objects = new MemoryObjectStore();
    const meta = new MemoryMetaStore();
    const ids = [createId(), createId()];
    const projectionId = createId();
    await putMatchListProjection(objects, meta, {
      projectionId,
      key: "date:2026-01-01",
      matchIds: ids,
    });
    const loaded = await getMatchListProjection(objects, meta, "date:2026-01-01");
    expect(loaded?.matchIds).toEqual(ids);
  });

  it("exposes cache TTL hints by phase", () => {
    expect(cacheMaxAgeForPhase("live")).toBeLessThan(cacheMaxAgeForPhase("historical"));
  });

  it("parses date projection keys", () => {
    expect(parseMatchListProjectionKey("date:2024-08-16")).toEqual({
      kind: "date",
      date: "2024-08-16",
    });
    expect(parseMatchListProjectionKey("league:39:2024")).toEqual({
      kind: "league",
      leagueId: "39",
      seasonYear: "2024",
    });
    expect(parseMatchListProjectionKey("team:33:2024")).toEqual({
      kind: "team",
      teamId: "33",
      seasonYear: "2024",
    });
    expect(parseMatchListProjectionKey("live")).toEqual({ kind: "live" });
    expect(parseMatchListProjectionKey("bad")).toBeNull();
  });
});
