export { ApiFootballProvider } from "./adapter.js";
export type { ApiFootballClientOptions } from "./adapter.js";
export { mapFixtureToMatch, parseQuotaHeaders } from "./map-match.js";
export type { IdResolver } from "./map-match.js";
export { mapTeamToCanonical } from "./map-team.js";
export { mapLeagueToCompetition } from "./map-competition.js";
export { mapLeagueSeasonToCanonical, parseSeasonExternalId } from "./map-season.js";
export { mapStandingsToCanonical, parseStandingsExternalId } from "./map-standings.js";
export { mapUpstreamEvents, mapUpstreamLineups } from "./map-match-details.js";
export { mapFixtureStatisticsToCanonical } from "./map-match-statistics.js";
export { mapPredictionToCanonical } from "./map-prediction.js";
export { mapOddsToCanonical } from "./map-odds.js";
export { mapH2HToCanonical, parseH2HExternalId, h2hExternalId } from "./map-h2h.js";
export { mapInjuriesToCanonical } from "./map-injuries.js";
export { mapSeasonLeadersToCanonical, parseLeadersExternalId } from "./map-leaders.js";
export { mapSquadToCanonical, parseSquadExternalId } from "./map-squad.js";
export { mapPlayerToCanonical } from "./map-player.js";
export { mapCoachToCanonical } from "./map-coach.js";
export { mapTransfersToCanonical, parseTransferExternalId } from "./map-transfers.js";
export {
  mapTeamSeasonStatisticsToCanonical,
  parseTeamSeasonStatsExternalId,
} from "./map-team-season-stats.js";
export { mapCountryToCanonical } from "./map-country.js";
export { mapVenueToCanonical } from "./map-venue.js";
export { mapMatchPlayerStatisticsToCanonical } from "./map-match-player-stats.js";
export { mapTrophiesToCanonical, parseTrophyExternalId } from "./map-trophies.js";
export { mapSidelinedToCanonical, parseSidelinedExternalId } from "./map-sidelined.js";
export { mapSeasonRoundsToCanonical, parseRoundsExternalId } from "./map-rounds.js";
