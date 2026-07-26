export const SCHEMA_VERSION = 1 as const;

export const MS = {
  SECOND: 1_000,
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
  WEEK: 604_800_000,
} as const;

export const OBJECT_TYPES = [
  "country",
  "competition",
  "season",
  "team",
  "player",
  "coach",
  "venue",
  "match",
  "standing",
  "statistics",
  "prediction",
  "odds",
  "h2h",
  "injury",
  "leaders",
  "transfer",
  "trophy",
  "sidelined",
  "rounds",
  "squad",
  "projection",
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

export const FRESHNESS_CLASSES = ["static", "edition", "table", "live"] as const;
export type FreshnessClass = (typeof FRESHNESS_CLASSES)[number];

/**
 * Curated league external ids (API-Football) for date/live list filtering.
 * Keeps projections small so clients do not N+1 hydrate worldwide fixtures.
 */
/** IANA TZ used when listing fixtures by calendar date (Latin America). */
export const PROVIDER_FIXTURE_TIMEZONE = "America/Argentina/Buenos_Aires";

export const FEATURED_LEAGUE_EXTERNAL_IDS = [
  "39",
  "140",
  "135",
  "78",
  "61",
  "2",
  "3",
  "848",
  "88",
  "94",
  "144",
  "203",
  "71",
  "128",
  "253",
  "307",
  "262",
  "13",
  "11",
] as const;
