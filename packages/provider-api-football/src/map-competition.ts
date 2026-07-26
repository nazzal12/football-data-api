import type { Competition } from "@football-api/domain";
import { competitionSchema, parseCanonical } from "@football-api/domain";

export type UpstreamLeagueItem = {
  league: {
    id: number;
    name: string;
    type: string;
    logo?: string | null;
  };
  country: {
    name: string;
    code?: string | null;
  };
  seasons?: Array<{
    year: number;
    start?: string;
    end?: string;
    current?: boolean;
  }>;
};

function mapFormat(type: string | null | undefined): Competition["format"] {
  const t = (type ?? "").toLowerCase();
  if (t === "league") return "league";
  if (t === "cup") return "cup";
  return "other";
}

export async function mapLeagueToCompetition(
  item: UpstreamLeagueItem,
  internalId: string,
  resolve: {
    countryId?: (name: string) => string | Promise<string | undefined>;
  },
): Promise<Competition> {
  const format = mapFormat(item.league.type);
  const logo =
    item.league.logo && /^https?:\/\//.test(item.league.logo) ? item.league.logo : undefined;
  const raw = {
    schemaVersion: 1 as const,
    id: internalId,
    name: item.league.name,
    format,
    isLeague: format === "league",
    countryId: item.country.name ? await resolve.countryId?.(item.country.name) : undefined,
    logoUrl: logo,
  };
  return parseCanonical(competitionSchema, raw);
}
