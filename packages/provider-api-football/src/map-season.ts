import type { Season } from "@football-api/domain";
import { parseCanonical, seasonSchema } from "@football-api/domain";
import type { UpstreamLeagueItem } from "./map-competition.js";
import { parseStandingsExternalId } from "./map-standings.js";

export type UpstreamSeasonLeagueItem = UpstreamLeagueItem;

function toIsoDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(date)) return date;
  return undefined;
}

export async function mapLeagueSeasonToCanonical(
  item: UpstreamSeasonLeagueItem,
  seasonYear: number,
  internalId: string,
  resolve: {
    competitionId: (externalId: number) => string | Promise<string>;
  },
): Promise<Season> {
  const season = item.seasons?.find((s) => s.year === seasonYear);
  if (!season) {
    throw new Error(`Season ${seasonYear} not found for league ${item.league.id}`);
  }
  const startDate = toIsoDate(season.start);
  const endDate = toIsoDate(season.end);
  const label =
    startDate && endDate
      ? `${startDate.slice(0, 4)}/${endDate.slice(0, 4)}`
      : String(season.year);

  const raw = {
    schemaVersion: 1 as const,
    id: internalId,
    competitionId: await resolve.competitionId(item.league.id),
    label,
    startDate,
    endDate,
  };
  return parseCanonical(seasonSchema, raw);
}

/** External season key: "{leagueId}:{seasonYear}" e.g. "39:2024" */
export const parseSeasonExternalId = parseStandingsExternalId;
