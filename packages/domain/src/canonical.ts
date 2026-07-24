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
  })
  .strict();
export type Team = z.infer<typeof teamSchema>;

export const playerSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    name: z.string().min(1),
    countryId: entityIdSchema.optional(),
    dateOfBirth: z.string().optional(),
  })
  .strict();
export type Player = z.infer<typeof playerSchema>;

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
    playerId: entityIdSchema.optional(),
    assistPlayerId: entityIdSchema.optional(),
    detail: z.string().optional(),
  })
  .strict();
export type MatchEvent = z.infer<typeof matchEventSchema>;

export const lineupPlayerSchema = z
  .object({
    playerId: entityIdSchema,
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

export const matchListProjectionSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: entityIdSchema,
    kind: z.literal("match_list"),
    key: z.string().min(1),
    matchIds: z.array(entityIdSchema),
  })
  .strict();
export type MatchListProjection = z.infer<typeof matchListProjectionSchema>;
