import type { Team } from "@football-api/domain";
import { parseCanonical, teamSchema } from "@football-api/domain";

export type UpstreamTeamItem = {
  team: {
    id: number;
    name: string;
    code?: string | null;
    country?: string | null;
  };
  venue?: {
    id?: number | null;
    name?: string | null;
  };
};

export async function mapTeamToCanonical(
  item: UpstreamTeamItem,
  internalId: string,
  resolve: {
    countryId?: (name: string) => string | Promise<string | undefined>;
    venueId?: (externalId: number) => string | Promise<string | undefined>;
  },
): Promise<Team> {
  const countryName = item.team.country ?? undefined;
  const venueExt = item.venue?.id ?? undefined;
  const raw = {
    schemaVersion: 1 as const,
    id: internalId,
    name: item.team.name,
    shortName: item.team.code ?? undefined,
    countryId: countryName ? await resolve.countryId?.(countryName) : undefined,
    venueId: venueExt != null ? await resolve.venueId?.(venueExt) : undefined,
  };
  return parseCanonical(teamSchema, raw);
}
