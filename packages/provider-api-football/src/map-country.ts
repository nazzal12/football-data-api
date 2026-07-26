import type { Country } from "@football-api/domain";
import { countrySchema, parseCanonical } from "@football-api/domain";

export type UpstreamCountryItem = {
  name: string;
  code?: string | null;
  flag?: string | null;
};

export type UpstreamCountriesResponse = {
  response: UpstreamCountryItem[];
};

export function mapCountryToCanonical(item: UpstreamCountryItem, internalId: string): Country {
  const code = item.code && item.code.length >= 2 && item.code.length <= 3 ? item.code : undefined;
  return parseCanonical(countrySchema, {
    schemaVersion: 1,
    id: internalId,
    name: item.name,
    code,
  });
}
