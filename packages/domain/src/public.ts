import { z } from "zod";
import {
  coachSchema,
  competitionSchema,
  countrySchema,
  headToHeadSchema,
  injuryReportSchema,
  matchOddsSchema,
  matchPlayerStatisticsSchema,
  matchPredictionSchema,
  matchSchema,
  matchStatisticsSchema,
  playerSchema,
  seasonLeadersSchema,
  seasonRoundsSchema,
  seasonSchema,
  sidelinedReportSchema,
  squadSchema,
  standingsSchema,
  teamSchema,
  teamSeasonStatisticsSchema,
  transferReportSchema,
  trophyReportSchema,
  venueSchema,
} from "./canonical.js";

/** Public REST DTOs — same shape as canonical for v1. */
export const publicCountrySchema = countrySchema;
export const publicCompetitionSchema = competitionSchema;
export const publicSeasonSchema = seasonSchema;
export const publicTeamSchema = teamSchema;
export const publicPlayerSchema = playerSchema;
export const publicCoachSchema = coachSchema;
export const publicVenueSchema = venueSchema;
export const publicMatchSchema = matchSchema;
export const publicStandingsSchema = standingsSchema;
export const publicMatchStatisticsSchema = matchStatisticsSchema;
export const publicMatchPlayerStatisticsSchema = matchPlayerStatisticsSchema;
export const publicMatchPredictionSchema = matchPredictionSchema;
export const publicMatchOddsSchema = matchOddsSchema;
export const publicHeadToHeadSchema = headToHeadSchema;
export const publicInjuryReportSchema = injuryReportSchema;
export const publicSeasonLeadersSchema = seasonLeadersSchema;
export const publicSeasonRoundsSchema = seasonRoundsSchema;
export const publicTransferReportSchema = transferReportSchema;
export const publicTrophyReportSchema = trophyReportSchema;
export const publicSidelinedReportSchema = sidelinedReportSchema;
export const publicTeamSeasonStatisticsSchema = teamSeasonStatisticsSchema;
export const publicSquadSchema = squadSchema;

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: z.string().optional(),
  })
  .strict();
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
