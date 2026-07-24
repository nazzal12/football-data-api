import { createId } from "@football-api/core";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/fixture-finished.json";
import { mapFixtureToMatch } from "./map-match.js";
import type { UpstreamFixturesResponse } from "./upstream-types.js";

describe("mapFixtureToMatch", () => {
  it("maps upstream fixture to canonical match without provider keys", async () => {
    const item = (fixture as UpstreamFixturesResponse).response[0];
    if (!item) throw new Error("missing fixture");

    const ids = new Map<string, string>();
    const ensure = (key: string) => {
      const existing = ids.get(key);
      if (existing) return existing;
      const id = createId();
      ids.set(key, id);
      return id;
    };

    const match = await mapFixtureToMatch(item, createId(), {
      teamId: (ext) => ensure(`team:${ext}`),
      seasonId: (comp, year) => ensure(`season:${comp}:${year}`),
      competitionId: (ext) => ensure(`competition:${ext}`),
      venueId: (ext) => ensure(`venue:${ext}`),
      playerId: (ext) => ensure(`player:${ext}`),
    });

    expect(match.phase).toBe("finished");
    expect(match.score).toEqual({ home: 2, away: 1 });
    expect(match.events).toHaveLength(1);
    expect(JSON.stringify(match)).not.toContain("fixture");
    expect(JSON.stringify(match)).not.toContain('"league"');
  });
});
