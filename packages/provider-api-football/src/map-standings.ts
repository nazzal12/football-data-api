import type { Standings } from "@football-api/domain";
import { parseCanonical, standingsSchema } from "@football-api/domain";

export type UpstreamStandingsResponse = {
  response: Array<{
    league: {
      id: number;
      season: number;
      standings: Array<
        Array<{
          rank: number;
          team: { id: number; name: string };
          points: number;
          goalsDiff: number;
          form?: string | null;
          all: {
            played: number;
            win: number;
            draw: number;
            lose: number;
            goals: { for: number; against: number };
          };
          group?: string | null;
        }>
      >;
    };
  }>;
};

export async function mapStandingsToCanonical(
  body: UpstreamStandingsResponse,
  internalId: string,
  resolve: {
    seasonId: (competitionExternalId: number, seasonYear: number) => string | Promise<string>;
    teamId: (externalId: number) => string | Promise<string>;
  },
): Promise<Standings> {
  const league = body.response?.[0]?.league;
  if (!league) {
    throw new Error("Empty standings response");
  }
  const table = league.standings?.[0] ?? [];
  const rows = [];
  for (const row of table) {
    rows.push({
      rank: row.rank,
      teamId: await resolve.teamId(row.team.id),
      played: row.all.played,
      won: row.all.win,
      drawn: row.all.draw,
      lost: row.all.lose,
      goalsFor: row.all.goals.for,
      goalsAgainst: row.all.goals.against,
      goalDifference: row.goalsDiff,
      points: row.points,
      form: row.form ?? undefined,
    });
  }

  const raw = {
    schemaVersion: 1 as const,
    id: internalId,
    seasonId: await resolve.seasonId(league.id, league.season),
    group: table[0]?.group ?? undefined,
    rows,
  };
  return parseCanonical(standingsSchema, raw);
}

/** External standings key: "{leagueId}:{seasonYear}" e.g. "39:2025" */
export function parseStandingsExternalId(externalId: string): {
  leagueId: string;
  seasonYear: string;
} | null {
  const match = /^(\d+):(\d{4})$/.exec(externalId);
  if (!match?.[1] || !match[2]) return null;
  return { leagueId: match[1], seasonYear: match[2] };
}
