import type { SeasonLeaderKind, SeasonLeaders } from "@football-api/domain";
import { parseCanonical, seasonLeadersSchema } from "@football-api/domain";

export type UpstreamTopPlayersResponse = {
  response: Array<{
    player: { id: number; name?: string | null; photo?: string | null };
    statistics?: Array<{
      team?: { id: number; name?: string | null };
      goals?: { total?: number | null; assists?: number | null };
      cards?: { yellow?: number | null; red?: number | null };
    }>;
  }>;
};

function valueForKind(
  kind: SeasonLeaderKind,
  stats: UpstreamTopPlayersResponse["response"][number]["statistics"],
): number {
  const row = stats?.[0];
  switch (kind) {
    case "goals":
      return row?.goals?.total ?? 0;
    case "assists":
      return row?.goals?.assists ?? 0;
    case "yellow_cards":
      return row?.cards?.yellow ?? 0;
    case "red_cards":
      return row?.cards?.red ?? 0;
  }
}

export async function mapSeasonLeadersToCanonical(
  body: UpstreamTopPlayersResponse,
  internalId: string,
  seasonId: string,
  kind: SeasonLeaderKind,
  resolve: {
    playerId: (externalId: number) => string | Promise<string>;
    teamId: (externalId: number) => string | Promise<string>;
  },
): Promise<SeasonLeaders> {
  const rows = [];
  let rank = 1;
  for (const item of body.response ?? []) {
    const teamExternalId = item.statistics?.[0]?.team?.id;
    if (teamExternalId == null) continue;
    const photo =
      item.player.photo && /^https?:\/\//.test(item.player.photo)
        ? item.player.photo
        : undefined;
    rows.push({
      rank: rank++,
      playerId: await resolve.playerId(item.player.id),
      playerName: item.player.name ?? undefined,
      playerPhotoUrl: photo,
      teamId: await resolve.teamId(teamExternalId),
      teamName: item.statistics?.[0]?.team?.name ?? undefined,
      value: valueForKind(kind, item.statistics),
    });
  }
  return parseCanonical(seasonLeadersSchema, {
    schemaVersion: 1,
    id: internalId,
    seasonId,
    kind,
    rows,
  });
}

/** External leaders key: "{leagueId}:{seasonYear}:{kind}" */
export function parseLeadersExternalId(externalId: string): {
  leagueId: string;
  seasonYear: string;
  kind: SeasonLeaderKind;
} | null {
  const match = /^(\d+):(\d{4}):(goals|assists|yellow_cards|red_cards)$/.exec(externalId);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return {
    leagueId: match[1],
    seasonYear: match[2],
    kind: match[3] as SeasonLeaderKind,
  };
}
