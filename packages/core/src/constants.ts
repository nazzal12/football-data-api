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

/** IANA TZ used when listing fixtures by calendar date (Latin America). */
export const PROVIDER_FIXTURE_TIMEZONE = "America/Argentina/Buenos_Aires";

/**
 * Curated league external ids (API-Football) — Futbol Libre / LATAM-first order.
 * Used for warmup / catalog hints. Date and live projections still return worldwide fixtures.
 */
export const FEATURED_LEAGUE_EXTERNAL_IDS = [
  // Continental LATAM
  "13", // Copa Libertadores
  "11", // Copa Sudamericana
  "16", // Copa America (when active)
  "9", // Recopa Sudamericana
  // Domestic LATAM
  "128", // Liga Profesional Argentina
  "130", // Copa de la Liga Profesional
  "71", // Brasileirão Serie A
  "72", // Brasileirão Serie B
  "73", // Copa do Brasil
  "262", // Liga MX
  "263", // Liga de Expansión MX
  "239", // Primera A Colombia
  "241", // Copa Colombia
  "265", // Primera División Chile
  "242", // Liga Pro Ecuador
  "243", // Liga Pro Serie B
  "281", // Primera División Peru
  "268", // Primera División Uruguay
  "250", // División Profesional Paraguay
  "252", // División Profesional - Clausura
  "253", // MLS (Americas libre niche)
  // Spanish-speaking Europe + top UEFA (libre staples)
  "140", // La Liga
  "143", // Copa del Rey
  "2", // UEFA Champions League
  "3", // UEFA Europa League
  "848", // Conference League
  // Other big five
  "39", // Premier League
  "135", // Serie A
  "78", // Bundesliga
  "61", // Ligue 1
  "94", // Primeira Liga
  "88", // Eredivisie
  "203", // Super Lig
  "307", // Saudi Pro League
] as const;
