import type { Match, MatchEvent, MatchPhase } from "@football-api/domain";
import { matchSchema, parseCanonical } from "@football-api/domain";
import type { UpstreamFixtureItem } from "./upstream-types.js";

export type IdResolver = {
  teamId: (externalId: number) => string | Promise<string>;
  seasonId: (competitionExternalId: number, seasonYear: number) => string | Promise<string>;
  competitionId: (externalId: number) => string | Promise<string>;
  matchId?: (externalId: number) => string | Promise<string>;
  coachId?: (externalId: number) => string | Promise<string>;
  venueId?: (externalId: number) => string | undefined | Promise<string | undefined>;
  playerId?: (externalId: number) => string | undefined | Promise<string | undefined>;
  countryId?: (name: string) => string | undefined | Promise<string | undefined>;
};

function mapPhase(statusShort: string): MatchPhase {
  const live = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
  const finished = new Set(["FT", "AET", "PEN", "AWD", "WO", "ABD"]);
  if (live.has(statusShort)) return "live";
  if (finished.has(statusShort)) return "finished";
  return "future";
}

function mapEventType(type: string, detail: string): MatchEvent["type"] {
  const t = type.toLowerCase();
  const d = detail.toLowerCase();
  if (t === "goal") {
    if (d.includes("own")) return "own_goal";
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

export async function mapFixtureToMatch(
  item: UpstreamFixtureItem,
  internalMatchId: string,
  ids: IdResolver,
): Promise<Match> {
  const phase = mapPhase(item.fixture.status.short);
  const events: MatchEvent[] = [];
  for (const [index, e] of (item.events ?? []).entries()) {
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

  const homeGoals = item.goals.home ?? item.score?.fulltime?.home ?? null;
  const awayGoals = item.goals.away ?? item.score?.fulltime?.away ?? null;

  const raw = {
    schemaVersion: 1 as const,
    id: internalMatchId,
    seasonId: await ids.seasonId(item.league.id, item.league.season),
    competitionId: await ids.competitionId(item.league.id),
    phase,
    status: item.fixture.status.short,
    kickoffAt: new Date(item.fixture.date).toISOString(),
    venueId:
      item.fixture.venue?.id != null ? await ids.venueId?.(item.fixture.venue.id) : undefined,
    homeTeamId: await ids.teamId(item.teams.home.id),
    awayTeamId: await ids.teamId(item.teams.away.id),
    score:
      homeGoals != null && awayGoals != null ? { home: homeGoals, away: awayGoals } : undefined,
    minute: item.fixture.status.elapsed ?? undefined,
    events,
    lineups: [],
  };

  return parseCanonical(matchSchema, raw);
}

export function parseQuotaHeaders(
  headers: Headers,
  provider: string,
  updatedAt: number,
): { dailyRemaining?: number; minuteRemaining?: number; provider: string; updatedAt: number } {
  const daily = headers.get("x-ratelimit-requests-remaining");
  const minute = headers.get("x-ratelimit-remaining");
  return {
    provider,
    updatedAt,
    dailyRemaining: daily != null ? Number(daily) : undefined,
    minuteRemaining: minute != null ? Number(minute) : undefined,
  };
}
