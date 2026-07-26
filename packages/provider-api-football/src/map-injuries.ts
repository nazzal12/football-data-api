import type { InjuryReport } from "@football-api/domain";
import { injuryReportSchema, parseCanonical } from "@football-api/domain";

export type UpstreamInjuriesResponse = {
  response: Array<{
    player: { id: number; name?: string; type?: string | null; reason?: string | null };
    team: { id: number };
    fixture?: { id?: number; date?: string };
  }>;
};

export async function mapInjuriesToCanonical(
  body: UpstreamInjuriesResponse,
  internalId: string,
  scope: { matchId?: string; teamId?: string; seasonId?: string },
  resolve: {
    playerId: (externalId: number) => string | Promise<string>;
    teamId: (externalId: number) => string | Promise<string>;
  },
): Promise<InjuryReport> {
  const injuries = [];
  for (const row of body.response ?? []) {
    injuries.push({
      playerId: await resolve.playerId(row.player.id),
      teamId: await resolve.teamId(row.team.id),
      type: row.player.type ?? undefined,
      reason: row.player.reason ?? undefined,
      startDate: row.fixture?.date?.slice(0, 10),
    });
  }
  return parseCanonical(injuryReportSchema, {
    schemaVersion: 1,
    id: internalId,
    matchId: scope.matchId,
    teamId: scope.teamId,
    seasonId: scope.seasonId,
    injuries,
  });
}
