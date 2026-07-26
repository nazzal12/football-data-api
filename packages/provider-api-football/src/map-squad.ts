import type { Squad } from "@football-api/domain";
import { parseCanonical, squadSchema } from "@football-api/domain";

export type UpstreamSquadsResponse = {
  response: Array<{
    team?: { id: number };
    players?: Array<{
      id: number;
      name?: string;
      photo?: string | null;
      age?: number;
      number?: number | null;
      position?: string | null;
    }>;
  }>;
};

export async function mapSquadToCanonical(
  body: UpstreamSquadsResponse,
  internalId: string,
  teamId: string,
  seasonId: string,
  resolve: { playerId: (externalId: number) => string | Promise<string> },
): Promise<Squad> {
  const players = body.response?.[0]?.players ?? [];
  const members = [];
  for (const p of players) {
    const photo =
      p.photo && /^https?:\/\//.test(p.photo) ? p.photo : undefined;
    members.push({
      playerId: await resolve.playerId(p.id),
      playerName: p.name ?? undefined,
      photoUrl: photo,
      shirtNumber: p.number ?? undefined,
      position: p.position ?? undefined,
    });
  }
  return parseCanonical(squadSchema, {
    schemaVersion: 1,
    id: internalId,
    seasonId,
    teamId,
    members,
  });
}

/** External squad key: "{teamId}:{leagueId}:{seasonYear}" e.g. "33:39:2024" */
export function parseSquadExternalId(externalId: string): {
  teamId: string;
  leagueId: string;
  seasonYear: string;
} | null {
  const match = /^(\d+):(\d+):(\d{4})$/.exec(externalId);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return { teamId: match[1], leagueId: match[2], seasonYear: match[3] };
}
