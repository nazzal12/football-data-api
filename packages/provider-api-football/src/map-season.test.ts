import { createId } from "@football-api/core";
import { describe, expect, it } from "vitest";
import { mapLeagueSeasonToCanonical } from "./map-season.js";

describe("mapLeagueSeasonToCanonical", () => {
  it("maps league season years into canonical Season", async () => {
    const competitionId = createId();
    const season = await mapLeagueSeasonToCanonical(
      {
        league: { id: 39, name: "Premier League", type: "League" },
        country: { name: "England", code: "GB-ENG" },
        seasons: [
          { year: 2024, start: "2024-08-16", end: "2025-05-25", current: false },
          { year: 2025, start: "2025-08-15", end: "2026-05-24", current: true },
        ],
      },
      2024,
      createId(),
      { competitionId: async () => competitionId },
    );

    expect(season.competitionId).toBe(competitionId);
    expect(season.label).toBe("2024/2025");
    expect(season.startDate).toBe("2024-08-16T00:00:00.000Z");
    expect(season.endDate).toBe("2025-05-25T00:00:00.000Z");
  });
});
