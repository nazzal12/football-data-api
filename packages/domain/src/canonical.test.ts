import { createId } from "@football-api/core";
import { describe, expect, it } from "vitest";
import { competitionSchema, matchSchema } from "./canonical.js";
import { parseCanonical } from "./validate.js";

describe("canonical schemas", () => {
  it("accepts a valid match", () => {
    const match = parseCanonical(matchSchema, {
      schemaVersion: 1,
      id: createId(),
      seasonId: createId(),
      competitionId: createId(),
      phase: "future",
      status: "scheduled",
      kickoffAt: "2026-08-01T15:00:00.000Z",
      homeTeamId: createId(),
      awayTeamId: createId(),
      events: [],
      lineups: [],
    });
    expect(match.phase).toBe("future");
  });

  it("models league as competition role", () => {
    const competition = parseCanonical(competitionSchema, {
      schemaVersion: 1,
      id: createId(),
      name: "Premier League",
      format: "league",
      isLeague: true,
      countryId: createId(),
    });
    expect(competition.isLeague).toBe(true);
  });

  it("rejects provider-shaped unknown fields", () => {
    expect(() =>
      parseCanonical(matchSchema, {
        schemaVersion: 1,
        id: createId(),
        seasonId: createId(),
        competitionId: createId(),
        phase: "live",
        status: "1H",
        kickoffAt: "2026-08-01T15:00:00.000Z",
        homeTeamId: createId(),
        awayTeamId: createId(),
        fixture: { id: 123 },
      }),
    ).toThrow();
  });
});
