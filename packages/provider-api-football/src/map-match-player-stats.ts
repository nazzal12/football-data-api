import type { MatchPlayerStatistics } from "@football-api/domain";
import { matchPlayerStatisticsSchema, parseCanonical } from "@football-api/domain";

export type UpstreamFixturePlayersResponse = {
  response: Array<{
    team: { id: number };
    players: Array<{
      player: { id: number };
      statistics?: Array<Record<string, unknown>>;
    }>;
  }>;
};

function flattenPlayerMetrics(
  stats: Array<Record<string, unknown>> | undefined,
): Record<string, number | string | boolean | null> {
  const metrics: Record<string, number | string | boolean | null> = {};
  const row = stats?.[0];
  if (!row || typeof row !== "object") return metrics;
  for (const [section, value] of Object.entries(row)) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
        metrics[section] = value;
      } else if (value === null) {
        metrics[section] = null;
      }
      continue;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = `${section}_${k}`;
      if (typeof v === "number" || typeof v === "string" || typeof v === "boolean" || v === null) {
        metrics[key] = v;
      }
    }
  }
  return metrics;
}

export async function mapMatchPlayerStatisticsToCanonical(
  body: UpstreamFixturePlayersResponse,
  internalId: string,
  matchId: string,
  resolve: {
    playerId: (externalId: number) => string | Promise<string>;
    teamId: (externalId: number) => string | Promise<string>;
  },
): Promise<MatchPlayerStatistics> {
  const players = [];
  for (const side of body.response ?? []) {
    const teamId = await resolve.teamId(side.team.id);
    for (const row of side.players ?? []) {
      players.push({
        playerId: await resolve.playerId(row.player.id),
        teamId,
        metrics: flattenPlayerMetrics(row.statistics),
      });
    }
  }
  return parseCanonical(matchPlayerStatisticsSchema, {
    schemaVersion: 1,
    id: internalId,
    matchId,
    players,
  });
}
