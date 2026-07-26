import type { Venue } from "@football-api/domain";
import { parseCanonical, venueSchema } from "@football-api/domain";

export type UpstreamVenueItem = {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  surface?: string | null;
  image?: string | null;
};

export type UpstreamVenuesResponse = {
  response: UpstreamVenueItem[];
};

export async function mapVenueToCanonical(
  item: UpstreamVenueItem,
  internalId: string,
  resolve: {
    countryId?: (name: string) => string | undefined | Promise<string | undefined>;
  },
): Promise<Venue> {
  return parseCanonical(venueSchema, {
    schemaVersion: 1,
    id: internalId,
    name: item.name,
    city: item.city ?? undefined,
    countryId: item.country ? await resolve.countryId?.(item.country) : undefined,
    capacity: item.capacity ?? undefined,
  });
}
