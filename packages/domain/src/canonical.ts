import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const entityIdSchema = z.string().uuid();

export const matchPhaseSchema = z.enum(["future", "live", "finished", "historical"]);
export type MatchPhase = z.infer<typeof matchPhaseSchema>;

export const competitionFormatSchema = z.enum(["league", "cup", "international", "other"]);
export type CompetitionFormat = z.infer<typeof competitionFormatSchema>;

export const countrySchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    name: z.string().min(1),
    code: z.string().min(2).max(3).optional(),
  })
  .strict();
export type Country = z.infer<typeof countrySchema>;

export const competitionSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    name: z.string().min(1),
    format: competitionFormatSchema,
    isLeague: z.boolean(),
    countryId: entityIdSchema.optional(),
    logoUrl: z.string().url().optional(),
  })
  .strict();
export type Competition = z.infer<typeof competitionSchema>;

export const seasonSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    competitionId: entityIdSchema,
    label: z.string().min(1),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .strict();
export type Season = z.infer<typeof seasonSchema>;

export const teamSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    name: z.string().min(1),
    shortName: z.string().optional(),
    countryId: entityIdSchema.optional(),
    venueId: entityIdSchema.optional(),
    logoUrl: z.string().url().optional(),
  })
  .strict();
export type Team = z.infer<typeof teamSchema>;

export const playerSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    name: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    age: z.number().int().nonnegative().optional(),
    nationality: z.string().optional(),
    countryId: entityIdSchema.optional(),
    dateOfBirth: z.string().optional(),
    height: z.string().optional(),
    weight: z.string().optional(),
    position: z.string().optional(),
    photoUrl: z.string().url().optional(),
  })
  .strict();
export type Player = z.infer<typeof playerSchema>;

export const coachCareerEntrySchema = z
  .object({
    teamId: entityIdSchema,
    start: z.string().optional(),
    end: z.string().optional(),
  })
  .strict();

export const coachSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    name: z.string().min(1),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    nationality: z.string().optional(),
    dateOfBirth: z.string().optional(),
    photoUrl: z.string().url().optional(),
    teamId: entityIdSchema.optional(),
    career: z.array(coachCareerEntrySchema).default([]),
  })
  .strict();
export type Coach = z.infer<typeof coachSchema>;

export const transferEntrySchema = z
  .object({
    playerId: entityIdSchema,
    date: z.string().optional(),
    type: z.string().optional(),
    fromTeamId: entityIdSchema.optional(),
    toTeamId: entityIdSchema.optional(),
  })
  .strict();

export const transferReportSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    teamId: entityIdSchema.optional(),
    playerId: entityIdSchema.optional(),
    transfers: z.array(transferEntrySchema),
  })
  .strict();
export type TransferReport = z.infer<typeof transferReportSchema>;

export const teamSeasonStatisticsSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    teamId: entityIdSchema,
    seasonId: entityIdSchema,
    form: z.string().optional(),
    fixturesPlayed: z.number().int().nonnegative().optional(),
    wins: z.number().int().nonnegative().optional(),
    draws: z.number().int().nonnegative().optional(),
    losses: z.number().int().nonnegative().optional(),
    goalsFor: z.number().int().nonnegative().optional(),
    goalsAgainst: z.number().int().nonnegative().optional(),
    cleanSheets: z.number().int().nonnegative().optional(),
    failedToScore: z.number().int().nonnegative().optional(),
    metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  })
  .strict();
export type TeamSeasonStatistics = z.infer<typeof teamSeasonStatisticsSchema>;

export const venueSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    name: z.string().min(1),
    city: z.string().optional(),
    countryId: entityIdSchema.optional(),
    capacity: z.number().int().nonnegative().optional(),
  })
  .strict();
export type Venue = z.infer<typeof venueSchema>;

export const matchEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    minute: z.number().int().nonnegative().optional(),
    extraMinute: z.number().int().nonnegative().optional(),
    type: z.enum([
      "goal",
      "own_goal",
      "penalty",
      "missed_penalty",
      "yellow_card",
      "red_card",
      "substitution",
      "var",
      "other",
    ]),
    teamId: entityIdSchema.optional(),
    teamName: z.string().optional(),
    playerId: entityIdSchema.optional(),
    playerName: z.string().optional(),
    assistPlayerId: entityIdSchema.optional(),
    assistPlayerName: z.string().optional(),
    detail: z.string().optional(),
  })
  .strict();
export type MatchEvent = z.infer<typeof matchEventSchema>;

export const lineupPlayerSchema = z
  .object({
    playerId: entityIdSchema,
    playerName: z.string().optional(),
    photoUrl: z.string().url().optional(),
    shirtNumber: z.number().int().positive().optional(),
    position: z.string().optional(),
    isStarter: z.boolean(),
  })
  .strict();

export const matchLineupSchema = z
  .object({
    teamId: entityIdSchema,
    players: z.array(lineupPlayerSchema),
  })
  .strict();

export const matchScoreSchema = z
  .object({
    home: z.number().int().nonnegative(),
    away: z.number().int().nonnegative(),
    /** Penalty shootout conversion count (not regulation goals). */
    penaltyHome: z.number().int().nonnegative().optional(),
    penaltyAway: z.number().int().nonnegative().optional(),
  })
  .strict();

export const matchSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    seasonId: entityIdSchema,
    competitionId: entityIdSchema,
    phase: matchPhaseSchema,
    status: z.string().min(1),
    kickoffAt: z.string().datetime(),
    venueId: entityIdSchema.optional(),
    homeTeamId: entityIdSchema,
    awayTeamId: entityIdSchema,
    score: matchScoreSchema.optional(),
    minute: z.number().int().nonnegative().optional(),
    events: z.array(matchEventSchema).default([]),
    lineups: z.array(matchLineupSchema).default([]),
  })
  .strict();
export type Match = z.infer<typeof matchSchema>;

export const standingRowSchema = z
  .object({
    rank: z.number().int().positive(),
    teamId: entityIdSchema,
    played: z.number().int().nonnegative(),
    won: z.number().int().nonnegative(),
    drawn: z.number().int().nonnegative(),
    lost: z.number().int().nonnegative(),
    goalsFor: z.number().int().nonnegative(),
    goalsAgainst: z.number().int().nonnegative(),
    goalDifference: z.number().int(),
    points: z.number().int(),
    form: z.string().optional(),
  })
  .strict();

export const standingsSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    seasonId: entityIdSchema,
    stage: z.string().optional(),
    group: z.string().optional(),
    rows: z.array(standingRowSchema),
  })
  .strict();
export type Standings = z.infer<typeof standingsSchema>;

export const statisticsScopeSchema = z.enum(["match", "season"]);
export const statisticsSubjectSchema = z.enum(["team", "player"]);

export const statisticsSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    scope: statisticsScopeSchema,
    subjectType: statisticsSubjectSchema,
    subjectId: entityIdSchema,
    matchId: entityIdSchema.optional(),
    seasonId: entityIdSchema.optional(),
    metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.null()])),
  })
  .strict();
export type Statistics = z.infer<typeof statisticsSchema>;

export const squadMemberSchema = z
  .object({
    playerId: entityIdSchema,
    playerName: z.string().optional(),
    photoUrl: z.string().url().optional(),
    shirtNumber: z.number().int().positive().optional(),
    position: z.string().optional(),
  })
  .strict();

export const squadSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    seasonId: entityIdSchema,
    teamId: entityIdSchema,
    members: z.array(squadMemberSchema),
  })
  .strict();
export type Squad = z.infer<typeof squadSchema>;

/** Team-level statistics for a single match (both sides). */
export const matchStatisticsSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    matchId: entityIdSchema,
    teams: z.array(
      z
        .object({
          teamId: entityIdSchema,
          metrics: z.record(
            z.string(),
            z.union([z.number(), z.string(), z.boolean(), z.null()]),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type MatchStatistics = z.infer<typeof matchStatisticsSchema>;

/** Provider-agnostic pre-match prediction summary. */
export const matchPredictionSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    matchId: entityIdSchema,
    advice: z.string().optional(),
    winnerTeamId: entityIdSchema.optional(),
    winOrDraw: z.boolean().optional(),
    underOver: z.string().optional(),
    goalsHome: z.string().optional(),
    goalsAway: z.string().optional(),
    percentHome: z.number().nonnegative().optional(),
    percentDraw: z.number().nonnegative().optional(),
    percentAway: z.number().nonnegative().optional(),
    formHome: z.string().optional(),
    formAway: z.string().optional(),
  })
  .strict();
export type MatchPrediction = z.infer<typeof matchPredictionSchema>;

/** Pre-match bookmaker odds snapshot for a match. */
export const oddsValueSchema = z
  .object({
    label: z.string().min(1),
    odd: z.number().positive(),
  })
  .strict();

export const oddsBetSchema = z
  .object({
    name: z.string().min(1),
    values: z.array(oddsValueSchema),
  })
  .strict();

export const oddsBookmakerSchema = z
  .object({
    name: z.string().min(1),
    bets: z.array(oddsBetSchema),
  })
  .strict();

export const matchOddsSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    matchId: entityIdSchema,
    updatedAt: z.string().datetime().optional(),
    bookmakers: z.array(oddsBookmakerSchema),
  })
  .strict();
export type MatchOdds = z.infer<typeof matchOddsSchema>;

/** Recent head-to-head meetings between two teams. */
export const headToHeadSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    teamAId: entityIdSchema,
    teamBId: entityIdSchema,
    matchIds: z.array(entityIdSchema),
  })
  .strict();
export type HeadToHead = z.infer<typeof headToHeadSchema>;

export const injuryEntrySchema = z
  .object({
    playerId: entityIdSchema,
    teamId: entityIdSchema,
    type: z.string().optional(),
    reason: z.string().optional(),
    startDate: z.string().optional(),
  })
  .strict();

/** Injuries for a match or team+season scope. */
export const injuryReportSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    matchId: entityIdSchema.optional(),
    teamId: entityIdSchema.optional(),
    seasonId: entityIdSchema.optional(),
    injuries: z.array(injuryEntrySchema),
  })
  .strict();
export type InjuryReport = z.infer<typeof injuryReportSchema>;

export const seasonLeaderKindSchema = z.enum([
  "goals",
  "assists",
  "yellow_cards",
  "red_cards",
]);
export type SeasonLeaderKind = z.infer<typeof seasonLeaderKindSchema>;

export const seasonLeaderRowSchema = z
  .object({
    rank: z.number().int().positive(),
    playerId: entityIdSchema,
    playerName: z.string().optional(),
    playerPhotoUrl: z.string().url().optional(),
    teamId: entityIdSchema,
    teamName: z.string().optional(),
    value: z.number(),
  })
  .strict();

export const seasonLeadersSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    seasonId: entityIdSchema,
    kind: seasonLeaderKindSchema,
    rows: z.array(seasonLeaderRowSchema),
  })
  .strict();
export type SeasonLeaders = z.infer<typeof seasonLeadersSchema>;

/** Per-player statistics within a match. */
export const matchPlayerStatisticsSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    matchId: entityIdSchema,
    players: z.array(
      z
        .object({
          playerId: entityIdSchema,
          teamId: entityIdSchema,
          metrics: z.record(
            z.string(),
            z.union([z.number(), z.string(), z.boolean(), z.null()]),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type MatchPlayerStatistics = z.infer<typeof matchPlayerStatisticsSchema>;

export const trophyEntrySchema = z
  .object({
    place: z.string().optional(),
    season: z.string().optional(),
    competitionName: z.string().optional(),
    country: z.string().optional(),
  })
  .strict();

export const trophyReportSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    subjectType: z.enum(["player", "team", "coach"]),
    subjectId: entityIdSchema,
    trophies: z.array(trophyEntrySchema),
  })
  .strict();
export type TrophyReport = z.infer<typeof trophyReportSchema>;

export const sidelinedEntrySchema = z
  .object({
    type: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  })
  .strict();

export const sidelinedReportSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    playerId: entityIdSchema.optional(),
    coachId: entityIdSchema.optional(),
    entries: z.array(sidelinedEntrySchema),
  })
  .strict();
export type SidelinedReport = z.infer<typeof sidelinedReportSchema>;

export const seasonRoundsSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    seasonId: entityIdSchema,
    rounds: z.array(z.string().min(1)),
  })
  .strict();
export type SeasonRounds = z.infer<typeof seasonRoundsSchema>;

/** Lightweight card fields embedded in list projections (avoids client N+1). */
export const matchListItemSchema = z
  .object({
    matchId: entityIdSchema,
    competitionId: entityIdSchema,
    homeTeamId: entityIdSchema,
    awayTeamId: entityIdSchema,
    kickoffAt: z.string().datetime(),
    phase: matchPhaseSchema,
    status: z.string().min(1),
    score: matchScoreSchema.optional(),
    minute: z.number().int().nonnegative().optional(),
    homeName: z.string().min(1),
    awayName: z.string().min(1),
    homeLogoUrl: z.string().url().optional(),
    awayLogoUrl: z.string().url().optional(),
    competitionName: z.string().min(1).optional(),
    competitionLogoUrl: z.string().url().optional(),
    /** Upstream fixture id — for SEO URLs / by-external without N+1 id lookups. */
    externalId: z.string().min(1).optional(),
    homeExternalId: z.string().min(1).optional(),
    awayExternalId: z.string().min(1).optional(),
    competitionExternalId: z.string().min(1).optional(),
  })
  .strict();
export type MatchListItem = z.infer<typeof matchListItemSchema>;

export const matchListProjectionSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    kind: z.literal("match_list"),
    key: z.string().min(1),
    matchIds: z.array(entityIdSchema),
    /** Optional hydrated cards from the same upstream list response. */
    items: z.array(matchListItemSchema).optional(),
  })
  .strict();
export type MatchListProjection = z.infer<typeof matchListProjectionSchema>;

/** One hit from a global text search (team / competition / player). */
export const searchHitSchema = z
  .object({
    type: z.enum(["team", "competition", "player"]),
    id: entityIdSchema,
    externalId: z.string().min(1),
    displayName: z.string().min(1),
    logoUrl: z.string().url().optional(),
  })
  .strict();
export type SearchHit = z.infer<typeof searchHitSchema>;

/** Aggregated search response for client typeahead / search screens. */
export const searchResultSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    query: z.string().min(1),
    results: z.array(searchHitSchema),
  })
  .strict();
export type SearchResult = z.infer<typeof searchResultSchema>;
