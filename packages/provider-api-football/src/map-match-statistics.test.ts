import { describe, expect, it } from "vitest";
import { mapFixtureStatisticsToCanonical } from "./map-match-statistics.js";

describe("mapFixtureStatisticsToCanonical", () => {
  it("maps possession percentages and shot rows", async () => {
    const stats = await mapFixtureStatisticsToCanonical(
      {
        response: [
          {
            team: { id: 10 },
            statistics: [
              { type: "Ball Possession", value: "55%" },
              { type: "Total Shots", value: 12 },
              { type: "Shots on Goal", value: 5 },
              { type: "expected_goals", value: null },
            ],
          },
          {
            team: { id: 20 },
            statistics: [
              { type: "Ball Possession", value: "45%" },
              { type: "Total Shots", value: 8 },
              { type: "Shots on Goal", value: 2 },
            ],
          },
        ],
      },
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      {
        teamId: (externalId) =>
          externalId === 10
            ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    );

    expect(stats.teams).toHaveLength(2);
    expect(stats.teams[0]?.metrics.ball_possession).toBe("55%");
    expect(stats.teams[0]?.metrics.total_shots).toBe(12);
    expect(stats.teams[1]?.metrics.shots_on_goal).toBe(2);
  });
});
