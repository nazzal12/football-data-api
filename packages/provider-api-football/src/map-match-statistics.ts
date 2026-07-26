import type { MatchStatistics } from "@football-api/domain";
import { matchStatisticsSchema, parseCanonical } from "@football-api/domain";

export type UpstreamFixtureStatisticsResponse = {
  response: Array<{
    team: { id: number };
    statistics: Array<{ type: string; value: number | string | null }>;
  }>;
};

function metricKey(type: string): string {
  return type
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function mapFixtureStatisticsToCanonical(
  body: UpstreamFixtureStatisticsResponse,
  internalId: string,
  matchId: string,
  resolve: { teamId: (externalId: number) => string | Promise<string> },
): Promise<MatchStatistics> {
  const teams = [];
  for (const side of body.response ?? []) {
    const metrics: Record<string, number | string | boolean | null> = {};
    for (const row of side.statistics ?? []) {
      metrics[metricKey(row.type) || "unknown"] = row.value;
    }
    teams.push({
      teamId: await resolve.teamId(side.team.id),
      metrics,
    });
  }
  return parseCanonical(matchStatisticsSchema, {
    schemaVersion: 1,
    id: internalId,
    matchId,
    teams,
  });
}
