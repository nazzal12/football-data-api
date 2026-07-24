export {
  SCHEMA_VERSION,
  competitionFormatSchema,
  competitionSchema,
  countrySchema,
  entityIdSchema,
  matchEventSchema,
  matchListProjectionSchema,
  matchPhaseSchema,
  matchSchema,
  playerSchema,
  seasonSchema,
  squadSchema,
  standingRowSchema,
  standingsSchema,
  statisticsSchema,
  teamSchema,
  venueSchema,
} from "./canonical.js";
export type {
  Competition,
  CompetitionFormat,
  Country,
  Match,
  MatchEvent,
  MatchListProjection,
  MatchPhase,
  Player,
  Season,
  Squad,
  Standings,
  Statistics,
  Team,
  Venue,
} from "./canonical.js";

export {
  problemDetailsSchema,
  publicCompetitionSchema,
  publicCountrySchema,
  publicMatchSchema,
  publicPlayerSchema,
  publicSeasonSchema,
  publicStandingsSchema,
  publicTeamSchema,
  publicVenueSchema,
} from "./public.js";
export type { ProblemDetails } from "./public.js";

export { parseCanonical } from "./validate.js";
