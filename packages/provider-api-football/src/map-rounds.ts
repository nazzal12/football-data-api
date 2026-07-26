import type { SeasonRounds } from "@football-api/domain";
import { parseCanonical, seasonRoundsSchema } from "@football-api/domain";

export type UpstreamRoundsResponse = {
  response: string[];
};

export function mapSeasonRoundsToCanonical(
  body: UpstreamRoundsResponse,
  internalId: string,
  seasonId: string,
): SeasonRounds {
  return parseCanonical(seasonRoundsSchema, {
    schemaVersion: 1,
    id: internalId,
    seasonId,
    rounds: body.response ?? [],
  });
}

/** External rounds key: "{leagueId}:{seasonYear}" */
export function parseRoundsExternalId(externalId: string): {
  leagueId: string;
  seasonYear: string;
} | null {
  const match = /^(\d+):(\d{4})$/.exec(externalId);
  if (!match?.[1] || !match[2]) return null;
  return { leagueId: match[1], seasonYear: match[2] };
}
