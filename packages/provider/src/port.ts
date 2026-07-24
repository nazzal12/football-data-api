import type { AppError, Result } from "@football-api/core";
import type {
  Competition,
  Country,
  Match,
  Season,
  Standings,
  Team,
  Venue,
} from "@football-api/domain";

export type QuotaSnapshot = {
  provider: string;
  dailyRemaining?: number;
  minuteRemaining?: number;
  updatedAt: number;
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
  getCompetition?(internalId: string, externalId: string): Promise<Result<Competition, AppError>>;
  getSeason?(internalId: string, externalId: string): Promise<Result<Season, AppError>>;
  getCountry?(internalId: string, externalId: string): Promise<Result<Country, AppError>>;
  getVenue?(internalId: string, externalId: string): Promise<Result<Venue, AppError>>;
  getStandings?(
    internalId: string,
    externalSeasonId: string,
    externalCompetitionId: string,
  ): Promise<Result<Standings, AppError>>;
  getQuota?(): QuotaSnapshot | undefined;
}
