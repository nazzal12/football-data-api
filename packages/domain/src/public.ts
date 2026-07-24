import { z } from "zod";
import {
  competitionSchema,
  countrySchema,
  matchSchema,
  playerSchema,
  seasonSchema,
  standingsSchema,
  teamSchema,
  venueSchema,
} from "./canonical.js";

/** Public REST DTOs — same shape as canonical for v1, without internal-only fields later. */
export const publicCountrySchema = countrySchema;
export const publicCompetitionSchema = competitionSchema;
export const publicSeasonSchema = seasonSchema;
export const publicTeamSchema = teamSchema;
export const publicPlayerSchema = playerSchema;
export const publicVenueSchema = venueSchema;
export const publicMatchSchema = matchSchema;
export const publicStandingsSchema = standingsSchema;

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
