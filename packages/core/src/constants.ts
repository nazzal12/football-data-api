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
  "venue",
  "match",
  "standing",
  "statistics",
  "squad",
  "projection",
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

export const FRESHNESS_CLASSES = ["static", "edition", "table", "live"] as const;
export type FreshnessClass = (typeof FRESHNESS_CLASSES)[number];
