import type { TeamSeasonStatistics } from "@football-api/domain";
import { parseCanonical, teamSeasonStatisticsSchema } from "@football-api/domain";

export type UpstreamTeamStatisticsResponse = {
  response: {
    form?: string | null;
    fixtures?: {
      played?: { total?: number | null };
      wins?: { total?: number | null };
      draws?: { total?: number | null };
      loses?: { total?: number | null };
    };
    goals?: {
      for?: { total?: { total?: number | null } };
      against?: { total?: { total?: number | null } };
    };
    clean_sheet?: { total?: number | null };
    failed_to_score?: { total?: number | null };
    lineups?: Array<{ formation?: string; played?: number }>;
    cards?: unknown;
    penalty?: unknown;
  };
};

function flattenMetrics(response: UpstreamTeamStatisticsResponse["response"]): Record<
  string,
  number | string | boolean | null
> {
  const metrics: Record<string, number | string | boolean | null> = {};
  for (const row of response.lineups ?? []) {
    if (row.formation) metrics[`formation_${row.formation}`] = row.played ?? null;
  }
  return metrics;
}

export async function mapTeamSeasonStatisticsToCanonical(
  body: UpstreamTeamStatisticsResponse,
  internalId: string,
  teamId: string,
  seasonId: string,
): Promise<TeamSeasonStatistics> {
  const r = body.response;
  if (!r) throw new Error("Empty team statistics response");
  return parseCanonical(teamSeasonStatisticsSchema, {
    schemaVersion: 1,
    id: internalId,
    teamId,
    seasonId,
    form: r.form ?? undefined,
    fixturesPlayed: r.fixtures?.played?.total ?? undefined,
    wins: r.fixtures?.wins?.total ?? undefined,
    draws: r.fixtures?.draws?.total ?? undefined,
    losses: r.fixtures?.loses?.total ?? undefined,
    goalsFor: r.goals?.for?.total?.total ?? undefined,
    goalsAgainst: r.goals?.against?.total?.total ?? undefined,
    cleanSheets: r.clean_sheet?.total ?? undefined,
    failedToScore: r.failed_to_score?.total ?? undefined,
    metrics: flattenMetrics(r),
  });
}

/** External key: "{teamId}:{leagueId}:{seasonYear}" */
export function parseTeamSeasonStatsExternalId(externalId: string): {
  teamId: string;
  leagueId: string;
  seasonYear: string;
} | null {
  const match = /^(\d+):(\d+):(\d{4})$/.exec(externalId);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return { teamId: match[1], leagueId: match[2], seasonYear: match[3] };
}
