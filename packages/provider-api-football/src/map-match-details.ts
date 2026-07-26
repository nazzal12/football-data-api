import type { Match, MatchEvent } from "@football-api/domain";
import type { IdResolver } from "./map-match.js";

export type UpstreamEventItem = {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name?: string | null };
  player: { id: number | null; name?: string | null };
  assist: { id: number | null; name?: string | null };
  type: string;
  detail: string;
};

export type UpstreamLineupTeam = {
  team: { id: number };
  startXI?: Array<{
    player: {
      id: number;
      name?: string;
      number?: number;
      pos?: string;
      photo?: string | null;
    };
  }>;
  substitutes?: Array<{
    player: {
      id: number;
      name?: string;
      number?: number;
      pos?: string;
      photo?: string | null;
    };
  }>;
};

function playerPhotoUrl(externalId: number, photo?: string | null): string | undefined {
  if (photo && /^https?:\/\//.test(photo)) return photo;
  return `https://media.api-sports.io/football/players/${externalId}.png`;
}

type MatchLineup = Match["lineups"][number];

function mapEventType(type: string, detail: string): MatchEvent["type"] {
  const t = type.toLowerCase();
  const d = detail.toLowerCase();
  if (t === "goal") {
    if (d.includes("own")) return "own_goal";
    if (d.includes("missed") && d.includes("penalty")) return "missed_penalty";
    if (d.includes("penalty")) return "penalty";
    return "goal";
  }
  if (t === "card") {
    if (d.includes("red")) return "red_card";
    return "yellow_card";
  }
  if (t === "subst") return "substitution";
  if (t === "var") return "var";
  return "other";
}

export async function mapUpstreamEvents(
  items: UpstreamEventItem[],
  ids: IdResolver,
): Promise<MatchEvent[]> {
  const events: MatchEvent[] = [];
  for (const [index, e] of items.entries()) {
    events.push({
      sequence: index,
      minute: e.time.elapsed ?? undefined,
      extraMinute: e.time.extra ?? undefined,
      type: mapEventType(e.type, e.detail),
      teamId: await ids.teamId(e.team.id),
      teamName: e.team.name ?? undefined,
      playerId: e.player.id != null ? await ids.playerId?.(e.player.id) : undefined,
      playerName: e.player.name ?? undefined,
      assistPlayerId: e.assist.id != null ? await ids.playerId?.(e.assist.id) : undefined,
      assistPlayerName: e.assist.name ?? undefined,
      detail: e.detail,
    });
  }
  return events;
}

export async function mapUpstreamLineups(
  items: UpstreamLineupTeam[],
  ids: IdResolver,
): Promise<MatchLineup[]> {
  const lineups: MatchLineup[] = [];
  for (const side of items) {
    const players: MatchLineup["players"] = [];
    for (const row of side.startXI ?? []) {
      const playerId = await ids.playerId?.(row.player.id);
      if (!playerId) continue;
      players.push({
        playerId,
        playerName: row.player.name ?? undefined,
        photoUrl: playerPhotoUrl(row.player.id, row.player.photo),
        shirtNumber: row.player.number ?? undefined,
        position: row.player.pos ?? undefined,
        isStarter: true,
      });
    }
    for (const row of side.substitutes ?? []) {
      const playerId = await ids.playerId?.(row.player.id);
      if (!playerId) continue;
      players.push({
        playerId,
        playerName: row.player.name ?? undefined,
        photoUrl: playerPhotoUrl(row.player.id, row.player.photo),
        shirtNumber: row.player.number ?? undefined,
        position: row.player.pos ?? undefined,
        isStarter: false,
      });
    }
    lineups.push({
      teamId: await ids.teamId(side.team.id),
      players,
    });
  }
  return lineups;
}
