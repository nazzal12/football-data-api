import type { AppError, Result } from "@football-api/core";
import type {
  Coach,
  Competition,
  Country,
  HeadToHead,
  InjuryReport,
  Match,
  MatchEvent,
  MatchOdds,
  MatchPhase,
  MatchPlayerStatistics,
  MatchPrediction,
  MatchStatistics,
  Player,
  Season,
  SeasonLeaders,
  SeasonRounds,
  SidelinedReport,
  Squad,
  Standings,
  Team,
  TeamSeasonStatistics,
  TransferReport,
  TrophyReport,
  Venue,
} from "@football-api/domain";

/** Provider list row — enough to build projection cards without per-match fetches. */
export type ProviderMatchListRow = {
  matchExternalId: string;
  leagueExternalId: string;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  seasonYear: number;
  kickoffAt: string;
  phase: MatchPhase;
  status: string;
  score?: {
    home: number;
    away: number;
    penaltyHome?: number;
    penaltyAway?: number;
  };
  minute?: number;
  homeName: string;
  awayName: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  leagueName: string;
  leagueLogoUrl?: string;
};

export type QuotaSnapshot = {
  provider: string;
  dailyRemaining?: number;
  minuteRemaining?: number;
  updatedAt: number;
};

/** Upstream search hit before UUID binding. */
export type ProviderSearchHit = {
  type: "team" | "competition" | "player";
  externalId: string;
  displayName: string;
  logoUrl?: string;
};

export type ExternalRef = {
  provider: string;
  externalType: string;
  externalId: string;
};

export type IdBridge = {
  toInternal(ref: ExternalRef): Promise<string | null>;
  bind(ref: ExternalRef, internalId: string): Promise<void>;
};

/** Provider port — domain intents only. No provider schema. */
export interface FootballProvider {
  readonly name: string;
  getMatch(internalId: string, externalId: string): Promise<Result<Match, AppError>>;
  getTeam?(internalId: string, externalId: string): Promise<Result<Team, AppError>>;
  getPlayer?(internalId: string, externalId: string): Promise<Result<Player, AppError>>;
  getCoach?(internalId: string, externalId: string): Promise<Result<Coach, AppError>>;
  getCoachByTeam?(
    internalId: string,
    teamExternalId: string,
  ): Promise<Result<Coach, AppError>>;
  getCompetition?(internalId: string, externalId: string): Promise<Result<Competition, AppError>>;
  getSeason?(internalId: string, externalId: string): Promise<Result<Season, AppError>>;
  getCountry?(internalId: string, externalId: string): Promise<Result<Country, AppError>>;
  getVenue?(internalId: string, externalId: string): Promise<Result<Venue, AppError>>;
  getStandings?(internalId: string, externalId: string): Promise<Result<Standings, AppError>>;
  listMatchExternalIdsByDate?(date: string): Promise<Result<string[], AppError>>;
  listMatchExternalIdsByLeagueSeason?(
    leagueId: string,
    seasonYear: string,
  ): Promise<Result<string[], AppError>>;
  listMatchExternalIdsByTeamSeason?(
    teamId: string,
    seasonYear: string,
  ): Promise<Result<string[], AppError>>;
  listLiveMatchExternalIds?(): Promise<Result<string[], AppError>>;
  /** Preferred over id-only lists — includes card fields from the same upstream call. */
  listMatchRowsByDate?(date: string): Promise<Result<ProviderMatchListRow[], AppError>>;
  listMatchRowsByLeagueSeason?(
    leagueId: string,
    seasonYear: string,
  ): Promise<Result<ProviderMatchListRow[], AppError>>;
  listMatchRowsByTeamSeason?(
    teamId: string,
    seasonYear: string,
  ): Promise<Result<ProviderMatchListRow[], AppError>>;
  listLiveMatchRows?(): Promise<Result<ProviderMatchListRow[], AppError>>;
  getMatchEvents?(externalId: string): Promise<Result<MatchEvent[], AppError>>;
  getMatchLineups?(externalId: string): Promise<Result<Match["lineups"], AppError>>;
  getMatchStatistics?(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchStatistics, AppError>>;
  getMatchPlayerStatistics?(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchPlayerStatistics, AppError>>;
  getMatchPrediction?(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchPrediction, AppError>>;
  getMatchOdds?(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchOdds, AppError>>;
  getMatchInjuries?(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<InjuryReport, AppError>>;
  /** externalId: "team:{teamId}:{seasonYear}" */
  getTeamInjuries?(internalId: string, externalId: string): Promise<Result<InjuryReport, AppError>>;
  getHeadToHead?(internalId: string, externalId: string): Promise<Result<HeadToHead, AppError>>;
  getSeasonLeaders?(internalId: string, externalId: string): Promise<Result<SeasonLeaders, AppError>>;
  getSeasonRounds?(internalId: string, externalId: string): Promise<Result<SeasonRounds, AppError>>;
  getSquad?(internalId: string, externalId: string): Promise<Result<Squad, AppError>>;
  getTransfers?(internalId: string, externalId: string): Promise<Result<TransferReport, AppError>>;
  getTeamSeasonStatistics?(
    internalId: string,
    externalId: string,
  ): Promise<Result<TeamSeasonStatistics, AppError>>;
  /** externalId: "player:{id}" | "coach:{id}" */
  getTrophies?(internalId: string, externalId: string): Promise<Result<TrophyReport, AppError>>;
  /** externalId: "player:{id}" | "coach:{id}" */
  getSidelined?(internalId: string, externalId: string): Promise<Result<SidelinedReport, AppError>>;
  /**
   * Text search across teams, competitions, and players.
   * Query should be at least 3 characters (upstream requirement for most search routes).
   */
  search?(query: string): Promise<Result<ProviderSearchHit[], AppError>>;
  getQuota?(): QuotaSnapshot | undefined;
}
