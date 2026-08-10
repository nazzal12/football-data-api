import type { AppError, Result } from "@football-api/core";
import { err, ok, PROVIDER_FIXTURE_TIMEZONE, providerError } from "@football-api/core";
import type {
  Coach,
  Competition,
  Country,
  Match,
  MatchEvent,
  MatchOdds,
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
  InjuryReport,
  HeadToHead,
} from "@football-api/domain";
import type {
  FootballProvider,
  ProviderMatchListRow,
  ProviderSearchHit,
  QuotaSnapshot,
} from "@football-api/provider";
import { mapFixturesToListRows } from "./map-list-rows.js";
import { type UpstreamLeagueItem, mapLeagueToCompetition } from "./map-competition.js";
import type { IdResolver } from "./map-match.js";
import { mapFixtureToMatch, parseQuotaHeaders } from "./map-match.js";
import {
  type UpstreamEventItem,
  type UpstreamLineupTeam,
  mapUpstreamEvents,
  mapUpstreamLineups,
} from "./map-match-details.js";
import {
  type UpstreamFixtureStatisticsResponse,
  mapFixtureStatisticsToCanonical,
} from "./map-match-statistics.js";
import {
  type UpstreamFixturePlayersResponse,
  mapMatchPlayerStatisticsToCanonical,
} from "./map-match-player-stats.js";
import {
  type UpstreamPredictionsResponse,
  mapPredictionToCanonical,
} from "./map-prediction.js";
import { type UpstreamOddsResponse, mapOddsToCanonical } from "./map-odds.js";
import {
  type UpstreamH2HResponse,
  h2hExternalId,
  mapH2HToCanonical,
  parseH2HExternalId,
} from "./map-h2h.js";
import {
  type UpstreamInjuriesResponse,
  mapInjuriesToCanonical,
} from "./map-injuries.js";
import {
  type UpstreamTopPlayersResponse,
  mapSeasonLeadersToCanonical,
  parseLeadersExternalId,
} from "./map-leaders.js";
import { type UpstreamCoachsResponse, mapCoachToCanonical } from "./map-coach.js";
import {
  type UpstreamPlayersResponse,
  mapPlayerToCanonical,
} from "./map-player.js";
import {
  type UpstreamTransfersResponse,
  mapTransfersToCanonical,
  parseTransferExternalId,
} from "./map-transfers.js";
import {
  type UpstreamTeamStatisticsResponse,
  mapTeamSeasonStatisticsToCanonical,
  parseTeamSeasonStatsExternalId,
} from "./map-team-season-stats.js";
import {
  type UpstreamCountriesResponse,
  mapCountryToCanonical,
} from "./map-country.js";
import {
  type UpstreamVenuesResponse,
  mapVenueToCanonical,
} from "./map-venue.js";
import {
  type UpstreamTrophiesResponse,
  mapTrophiesToCanonical,
  parseTrophyExternalId,
} from "./map-trophies.js";
import {
  type UpstreamSidelinedResponse,
  mapSidelinedToCanonical,
  parseSidelinedExternalId,
} from "./map-sidelined.js";
import {
  type UpstreamRoundsResponse,
  mapSeasonRoundsToCanonical,
  parseRoundsExternalId,
} from "./map-rounds.js";
import {
  type UpstreamLeaguesSearchResponse,
  type UpstreamPlayerProfilesSearchResponse,
  type UpstreamTeamsSearchResponse,
  mapLeaguesSearchHits,
  mapPlayerProfilesSearchHits,
  mapTeamsSearchHits,
} from "./map-search.js";
import { mapLeagueSeasonToCanonical, parseSeasonExternalId } from "./map-season.js";
import {
  type UpstreamSquadsResponse,
  mapSquadToCanonical,
} from "./map-squad.js";
import {
  type UpstreamStandingsResponse,
  mapStandingsToCanonical,
  parseStandingsExternalId,
} from "./map-standings.js";
import { type UpstreamTeamItem, mapTeamToCanonical } from "./map-team.js";
import type {
  UpstreamFixtureItem,
  UpstreamFixturesResponse,
} from "./upstream-types.js";

export type ApiFootballClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  resolveIds: IdResolver;
};

export class ApiFootballProvider implements FootballProvider {
  readonly name = "api-football";
  private quota: QuotaSnapshot | undefined;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: ApiFootballClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://v3.football.api-sports.io";
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
  }

  getQuota(): QuotaSnapshot | undefined {
    return this.quota;
  }

  private async requestJson<T>(path: string): Promise<Result<T, AppError>> {
    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        headers: { "x-apisports-key": this.options.apiKey },
      });
      this.quota = parseQuotaHeaders(response.headers, this.name, Date.now());
      if (response.status === 429) {
        return err(providerError("Provider rate limited", { status: 429 }));
      }
      if (!response.ok) {
        return err(providerError("Provider request failed", { status: response.status }));
      }
      const body = (await response.json()) as T & {
        errors?: unknown;
        results?: number;
      };
      const apiErrors = body.errors;
      const hasErrors =
        apiErrors != null &&
        ((Array.isArray(apiErrors) && apiErrors.length > 0) ||
          (typeof apiErrors === "object" &&
            !Array.isArray(apiErrors) &&
            Object.keys(apiErrors as object).length > 0));
      if (hasErrors) {
        return err(providerError("Provider returned errors", { errors: apiErrors, path }));
      }
      return ok(body);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Provider transport error", { cause: message }));
    }
  }

  async getMatch(internalId: string, externalId: string): Promise<Result<Match, AppError>> {
    const body = await this.requestJson<UpstreamFixturesResponse>(
      `/fixtures?id=${encodeURIComponent(externalId)}&${this.tzQuery()}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Match not found upstream", { externalId }));
    return ok(await mapFixtureToMatch(item, internalId, this.options.resolveIds));
  }

  async getTeam(internalId: string, externalId: string): Promise<Result<Team, AppError>> {
    const body = await this.requestJson<{ response?: UpstreamTeamItem[] }>(
      `/teams?id=${encodeURIComponent(externalId)}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Team not found upstream", { externalId }));
    return ok(
      await mapTeamToCanonical(item, internalId, {
        venueId: async (id) => this.options.resolveIds.venueId?.(id),
      }),
    );
  }

  async getCompetition(
    internalId: string,
    externalId: string,
  ): Promise<Result<Competition, AppError>> {
    const body = await this.requestJson<{ response?: UpstreamLeagueItem[] }>(
      `/leagues?id=${encodeURIComponent(externalId)}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Competition not found upstream", { externalId }));
    try {
      return ok(
        await mapLeagueToCompetition(item, internalId, {
          countryId: async (name) => this.options.resolveIds.countryId?.(name),
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Competition mapping failed", { cause: message }));
    }
  }

  async getSeason(internalId: string, externalId: string): Promise<Result<Season, AppError>> {
    const parsed = parseSeasonExternalId(externalId);
    if (!parsed) {
      return err(providerError("Season external id must be leagueId:seasonYear", { externalId }));
    }
    const body = await this.requestJson<{ response?: UpstreamLeagueItem[] }>(
      `/leagues?id=${encodeURIComponent(parsed.leagueId)}&season=${encodeURIComponent(parsed.seasonYear)}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Season not found upstream", { externalId }));
    try {
      return ok(
        await mapLeagueSeasonToCanonical(item, Number(parsed.seasonYear), internalId, {
          competitionId: this.options.resolveIds.competitionId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Season mapping failed", { cause: message }));
    }
  }

  async getStandings(internalId: string, externalId: string): Promise<Result<Standings, AppError>> {
    const parsed = parseStandingsExternalId(externalId);
    if (!parsed) {
      return err(
        providerError("Standings external id must be leagueId:seasonYear", { externalId }),
      );
    }
    const body = await this.requestJson<UpstreamStandingsResponse>(
      `/standings?league=${encodeURIComponent(parsed.leagueId)}&season=${encodeURIComponent(parsed.seasonYear)}`,
    );
    if (!body.ok) return body;
    if (!body.value.response?.[0]?.league) {
      return err(providerError("Standings not found upstream", { externalId }));
    }
    try {
      const standings = await mapStandingsToCanonical(body.value, internalId, {
        seasonId: this.options.resolveIds.seasonId,
        teamId: this.options.resolveIds.teamId,
      });
      return ok(standings);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Standings mapping failed", { cause: message }));
    }
  }

  private tzQuery(): string {
    return `timezone=${encodeURIComponent(PROVIDER_FIXTURE_TIMEZONE)}`;
  }

  /** Fetch every page of a fixtures listing (API-Football paginates large days). */
  private async requestFixturesAll(
    pathWithoutPage: string,
  ): Promise<Result<UpstreamFixtureItem[], AppError>> {
    const first = await this.requestJson<UpstreamFixturesResponse>(pathWithoutPage);
    if (!first.ok) return first;
    const items = [...(first.value.response ?? [])];
    const totalPages = Math.max(1, first.value.paging?.total ?? 1);
    for (let page = 2; page <= totalPages; page++) {
      const sep = pathWithoutPage.includes("?") ? "&" : "?";
      const next = await this.requestJson<UpstreamFixturesResponse>(
        `${pathWithoutPage}${sep}page=${page}`,
      );
      if (!next.ok) return next;
      items.push(...(next.value.response ?? []));
    }
    return ok(items);
  }

  async listMatchRowsByDate(date: string): Promise<Result<ProviderMatchListRow[], AppError>> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return err(providerError("date must be YYYY-MM-DD", { date }));
    }
    const fixtures = await this.requestFixturesAll(
      `/fixtures?date=${encodeURIComponent(date)}&${this.tzQuery()}`,
    );
    if (!fixtures.ok) return fixtures;
    // Full worldwide day — clients render from hydrated `items` (no N+1).
    return ok(mapFixturesToListRows(fixtures.value));
  }

  async listMatchRowsByLeagueSeason(
    leagueId: string,
    seasonYear: string,
  ): Promise<Result<ProviderMatchListRow[], AppError>> {
    const fixtures = await this.requestFixturesAll(
      `/fixtures?league=${encodeURIComponent(leagueId)}&season=${encodeURIComponent(seasonYear)}&${this.tzQuery()}`,
    );
    if (!fixtures.ok) return fixtures;
    return ok(mapFixturesToListRows(fixtures.value));
  }

  async listMatchRowsByTeamSeason(
    teamId: string,
    seasonYear: string,
  ): Promise<Result<ProviderMatchListRow[], AppError>> {
    const fixtures = await this.requestFixturesAll(
      `/fixtures?team=${encodeURIComponent(teamId)}&season=${encodeURIComponent(seasonYear)}&${this.tzQuery()}`,
    );
    if (!fixtures.ok) return fixtures;
    return ok(mapFixturesToListRows(fixtures.value));
  }

  async listLiveMatchRows(): Promise<Result<ProviderMatchListRow[], AppError>> {
    const fixtures = await this.requestFixturesAll(`/fixtures?live=all&${this.tzQuery()}`);
    if (!fixtures.ok) return fixtures;
    return ok(mapFixturesToListRows(fixtures.value));
  }

  async listMatchExternalIdsByDate(date: string): Promise<Result<string[], AppError>> {
    const rows = await this.listMatchRowsByDate(date);
    if (!rows.ok) return rows;
    return ok(rows.value.map((r) => r.matchExternalId));
  }

  async listMatchExternalIdsByLeagueSeason(
    leagueId: string,
    seasonYear: string,
  ): Promise<Result<string[], AppError>> {
    const rows = await this.listMatchRowsByLeagueSeason(leagueId, seasonYear);
    if (!rows.ok) return rows;
    return ok(rows.value.map((r) => r.matchExternalId));
  }

  async listMatchExternalIdsByTeamSeason(
    teamId: string,
    seasonYear: string,
  ): Promise<Result<string[], AppError>> {
    const rows = await this.listMatchRowsByTeamSeason(teamId, seasonYear);
    if (!rows.ok) return rows;
    return ok(rows.value.map((r) => r.matchExternalId));
  }

  async listLiveMatchExternalIds(): Promise<Result<string[], AppError>> {
    const rows = await this.listLiveMatchRows();
    if (!rows.ok) return rows;
    return ok(rows.value.map((r) => r.matchExternalId));
  }

  async getMatchEvents(externalId: string): Promise<Result<MatchEvent[], AppError>> {
    const body = await this.requestJson<{ response?: UpstreamEventItem[] }>(
      `/fixtures/events?fixture=${encodeURIComponent(externalId)}`,
    );
    if (!body.ok) return body;
    try {
      return ok(await mapUpstreamEvents(body.value.response ?? [], this.options.resolveIds));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Match events mapping failed", { cause: message }));
    }
  }

  async getMatchLineups(externalId: string): Promise<Result<Match["lineups"], AppError>> {
    const body = await this.requestJson<{ response?: UpstreamLineupTeam[] }>(
      `/fixtures/lineups?fixture=${encodeURIComponent(externalId)}`,
    );
    if (!body.ok) return body;
    try {
      return ok(await mapUpstreamLineups(body.value.response ?? [], this.options.resolveIds));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Match lineups mapping failed", { cause: message }));
    }
  }

  async getMatchStatistics(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchStatistics, AppError>> {
    const body = await this.requestJson<UpstreamFixtureStatisticsResponse>(
      `/fixtures/statistics?fixture=${encodeURIComponent(matchExternalId)}`,
    );
    if (!body.ok) return body;
    if (!body.value.response?.length) {
      // Upstream often omits stats for early cup rounds — empty payload, not an error.
      return ok({
        schemaVersion: 1,
        id: internalId,
        matchId: matchInternalId,
        teams: [],
      });
    }
    try {
      return ok(
        await mapFixtureStatisticsToCanonical(body.value, internalId, matchInternalId, {
          teamId: this.options.resolveIds.teamId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Match statistics mapping failed", { cause: message }));
    }
  }

  async getMatchPrediction(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchPrediction, AppError>> {
    const body = await this.requestJson<UpstreamPredictionsResponse>(
      `/predictions?fixture=${encodeURIComponent(matchExternalId)}`,
    );
    if (!body.ok) return body;
    try {
      return ok(
        await mapPredictionToCanonical(body.value, internalId, matchInternalId, {
          teamId: this.options.resolveIds.teamId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Match prediction mapping failed", { cause: message }));
    }
  }

  async getMatchOdds(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchOdds, AppError>> {
    const body = await this.requestJson<UpstreamOddsResponse>(
      `/odds?fixture=${encodeURIComponent(matchExternalId)}`,
    );
    if (!body.ok) return body;
    if (!body.value.response?.length) {
      return err(providerError("Match odds not found upstream", { matchExternalId }));
    }
    try {
      return ok(mapOddsToCanonical(body.value, internalId, matchInternalId));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Match odds mapping failed", { cause: message }));
    }
  }

  async getMatchInjuries(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<InjuryReport, AppError>> {
    const body = await this.requestJson<UpstreamInjuriesResponse>(
      `/injuries?fixture=${encodeURIComponent(matchExternalId)}`,
    );
    if (!body.ok) return body;
    try {
      return ok(
        await mapInjuriesToCanonical(
          body.value,
          internalId,
          { matchId: matchInternalId },
          {
            playerId: async (id) => {
              const resolved = await this.options.resolveIds.playerId?.(id);
              if (!resolved) throw new Error(`Unable to resolve player ${id}`);
              return resolved;
            },
            teamId: this.options.resolveIds.teamId,
          },
        ),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Match injuries mapping failed", { cause: message }));
    }
  }

  async getHeadToHead(
    internalId: string,
    externalId: string,
  ): Promise<Result<HeadToHead, AppError>> {
    const parsed = parseH2HExternalId(externalId);
    if (!parsed) {
      return err(providerError("H2H external id must be teamA-teamB", { externalId }));
    }
    const key = h2hExternalId(parsed.teamA, parsed.teamB);
    const body = await this.requestJson<UpstreamH2HResponse>(
      `/fixtures/headtohead?h2h=${encodeURIComponent(key)}`,
    );
    if (!body.ok) return body;
    try {
      const teamAId = await this.options.resolveIds.teamId(Number(parsed.teamA));
      const teamBId = await this.options.resolveIds.teamId(Number(parsed.teamB));
      return ok(
        await mapH2HToCanonical(body.value, internalId, teamAId, teamBId, async (id) => {
          const resolved = await this.options.resolveIds.matchId?.(id);
          if (!resolved) throw new Error(`Unable to resolve match ${id}`);
          return resolved;
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("H2H mapping failed", { cause: message }));
    }
  }

  async getSeasonLeaders(
    internalId: string,
    externalId: string,
  ): Promise<Result<SeasonLeaders, AppError>> {
    const parsed = parseLeadersExternalId(externalId);
    if (!parsed) {
      return err(
        providerError("Leaders external id must be leagueId:seasonYear:kind", { externalId }),
      );
    }
    const pathByKind: Record<string, string> = {
      goals: "topscorers",
      assists: "topassists",
      yellow_cards: "topyellowcards",
      red_cards: "topredcards",
    };
    const path = pathByKind[parsed.kind];
    const body = await this.requestJson<UpstreamTopPlayersResponse>(
      `/players/${path}?league=${encodeURIComponent(parsed.leagueId)}&season=${encodeURIComponent(parsed.seasonYear)}`,
    );
    if (!body.ok) return body;
    try {
      const seasonId = await this.options.resolveIds.seasonId(
        Number(parsed.leagueId),
        Number(parsed.seasonYear),
      );
      return ok(
        await mapSeasonLeadersToCanonical(body.value, internalId, seasonId, parsed.kind, {
          playerId: async (id) => {
            const resolved = await this.options.resolveIds.playerId?.(id);
            if (!resolved) throw new Error(`Unable to resolve player ${id}`);
            return resolved;
          },
          teamId: this.options.resolveIds.teamId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Season leaders mapping failed", { cause: message }));
    }
  }

  async getSquad(internalId: string, externalId: string): Promise<Result<Squad, AppError>> {
    const match = /^(\d+):(\d+):(\d{4})$/.exec(externalId);
    if (!match?.[1] || !match[2] || !match[3]) {
      return err(
        providerError("Squad external id must be teamId:leagueId:seasonYear", { externalId }),
      );
    }
    const teamExternalId = match[1];
    const leagueId = match[2];
    const seasonYear = match[3];
    const body = await this.requestJson<UpstreamSquadsResponse>(
      `/players/squads?team=${encodeURIComponent(teamExternalId)}`,
    );
    if (!body.ok) return body;
    if (!body.value.response?.[0]?.players?.length) {
      return err(providerError("Squad not found upstream", { externalId }));
    }
    try {
      const teamId = await this.options.resolveIds.teamId(Number(teamExternalId));
      const seasonId = await this.options.resolveIds.seasonId(Number(leagueId), Number(seasonYear));
      return ok(
        await mapSquadToCanonical(body.value, internalId, teamId, seasonId, {
          playerId: async (id) => {
            const resolved = await this.options.resolveIds.playerId?.(id);
            if (!resolved) throw new Error(`Unable to resolve player ${id}`);
            return resolved;
          },
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Squad mapping failed", { cause: message }));
    }
  }

  async getPlayer(internalId: string, externalId: string): Promise<Result<Player, AppError>> {
    const profiles = await this.requestJson<UpstreamPlayersResponse>(
      `/players/profiles?player=${encodeURIComponent(externalId)}`,
    );
    if (profiles.ok && profiles.value.response?.[0]) {
      try {
        return ok(
          await mapPlayerToCanonical(profiles.value.response[0], internalId, {
            countryId: async (name) => this.options.resolveIds.countryId?.(name),
          }),
        );
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return err(providerError("Player mapping failed", { cause: message }));
      }
    }
    const year = new Date().getUTCFullYear();
    const body = await this.requestJson<UpstreamPlayersResponse>(
      `/players?id=${encodeURIComponent(externalId)}&season=${year}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Player not found upstream", { externalId }));
    try {
      return ok(
        await mapPlayerToCanonical(item, internalId, {
          countryId: async (name) => this.options.resolveIds.countryId?.(name),
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Player mapping failed", { cause: message }));
    }
  }

  async getCoach(internalId: string, externalId: string): Promise<Result<Coach, AppError>> {
    const body = await this.requestJson<UpstreamCoachsResponse>(
      `/coachs?id=${encodeURIComponent(externalId)}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Coach not found upstream", { externalId }));
    try {
      return ok(
        await mapCoachToCanonical(item, internalId, {
          teamId: this.options.resolveIds.teamId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Coach mapping failed", { cause: message }));
    }
  }

  async getCoachByTeam(
    _internalId: string,
    teamExternalId: string,
  ): Promise<Result<Coach, AppError>> {
    const body = await this.requestJson<UpstreamCoachsResponse>(
      `/coachs?team=${encodeURIComponent(teamExternalId)}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Coach not found for team", { teamExternalId }));
    try {
      const coachInternalId = await this.options.resolveIds.coachId?.(item.id);
      if (!coachInternalId) throw new Error(`Unable to resolve coach ${item.id}`);
      return ok(
        await mapCoachToCanonical(item, coachInternalId, {
          teamId: this.options.resolveIds.teamId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Coach mapping failed", { cause: message }));
    }
  }

  async getTransfers(
    internalId: string,
    externalId: string,
  ): Promise<Result<TransferReport, AppError>> {
    const parsed = parseTransferExternalId(externalId);
    if (!parsed) {
      return err(providerError("Transfer external id must be team:{id} or player:{id}", { externalId }));
    }
    const path =
      parsed.scope === "team"
        ? `/transfers?team=${encodeURIComponent(parsed.id)}`
        : `/transfers?player=${encodeURIComponent(parsed.id)}`;
    const body = await this.requestJson<UpstreamTransfersResponse>(path);
    if (!body.ok) return body;
    try {
      const scope =
        parsed.scope === "team"
          ? { teamId: await this.options.resolveIds.teamId(Number(parsed.id)) }
          : {
              playerId: await (async () => {
                const resolved = await this.options.resolveIds.playerId?.(Number(parsed.id));
                if (!resolved) throw new Error(`Unable to resolve player ${parsed.id}`);
                return resolved;
              })(),
            };
      return ok(
        await mapTransfersToCanonical(body.value, internalId, scope, {
          playerId: async (id) => {
            const resolved = await this.options.resolveIds.playerId?.(id);
            if (!resolved) throw new Error(`Unable to resolve player ${id}`);
            return resolved;
          },
          teamId: this.options.resolveIds.teamId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Transfers mapping failed", { cause: message }));
    }
  }

  async getTeamSeasonStatistics(
    internalId: string,
    externalId: string,
  ): Promise<Result<TeamSeasonStatistics, AppError>> {
    const parsed = parseTeamSeasonStatsExternalId(externalId);
    if (!parsed) {
      return err(
        providerError("Team season stats external id must be teamId:leagueId:seasonYear", {
          externalId,
        }),
      );
    }
    const body = await this.requestJson<UpstreamTeamStatisticsResponse>(
      `/teams/statistics?team=${encodeURIComponent(parsed.teamId)}&league=${encodeURIComponent(parsed.leagueId)}&season=${encodeURIComponent(parsed.seasonYear)}`,
    );
    if (!body.ok) return body;
    try {
      const teamId = await this.options.resolveIds.teamId(Number(parsed.teamId));
      const seasonId = await this.options.resolveIds.seasonId(
        Number(parsed.leagueId),
        Number(parsed.seasonYear),
      );
      return ok(
        await mapTeamSeasonStatisticsToCanonical(body.value, internalId, teamId, seasonId),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Team season statistics mapping failed", { cause: message }));
    }
  }

  async getCountry(internalId: string, externalId: string): Promise<Result<Country, AppError>> {
    const encoded = encodeURIComponent(externalId);
    const byName = await this.requestJson<UpstreamCountriesResponse>(`/countries?name=${encoded}`);
    if (!byName.ok) return byName;
    let item = byName.value.response?.[0];
    if (!item && /^[A-Za-z]{2,3}$/.test(externalId)) {
      const byCode = await this.requestJson<UpstreamCountriesResponse>(
        `/countries?code=${encoded}`,
      );
      if (!byCode.ok) return byCode;
      item = byCode.value.response?.[0];
    }
    if (!item) return err(providerError("Country not found upstream", { externalId }));
    try {
      return ok(mapCountryToCanonical(item, internalId));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Country mapping failed", { cause: message }));
    }
  }

  async getVenue(internalId: string, externalId: string): Promise<Result<Venue, AppError>> {
    const body = await this.requestJson<UpstreamVenuesResponse>(
      `/venues?id=${encodeURIComponent(externalId)}`,
    );
    if (!body.ok) return body;
    const item = body.value.response?.[0];
    if (!item) return err(providerError("Venue not found upstream", { externalId }));
    try {
      return ok(
        await mapVenueToCanonical(item, internalId, {
          countryId: async (name) => this.options.resolveIds.countryId?.(name),
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Venue mapping failed", { cause: message }));
    }
  }

  async getMatchPlayerStatistics(
    internalId: string,
    matchInternalId: string,
    matchExternalId: string,
  ): Promise<Result<MatchPlayerStatistics, AppError>> {
    const body = await this.requestJson<UpstreamFixturePlayersResponse>(
      `/fixtures/players?fixture=${encodeURIComponent(matchExternalId)}`,
    );
    if (!body.ok) return body;
    try {
      return ok(
        await mapMatchPlayerStatisticsToCanonical(body.value, internalId, matchInternalId, {
          playerId: async (id) => {
            const resolved = await this.options.resolveIds.playerId?.(id);
            if (!resolved) throw new Error(`Unable to resolve player ${id}`);
            return resolved;
          },
          teamId: this.options.resolveIds.teamId,
        }),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Match player statistics mapping failed", { cause: message }));
    }
  }

  async getTeamInjuries(
    internalId: string,
    externalId: string,
  ): Promise<Result<InjuryReport, AppError>> {
    const match = /^team:(\d+):(\d{4})$/.exec(externalId);
    if (!match?.[1] || !match[2]) {
      return err(
        providerError("Team injuries external id must be team:{teamId}:{seasonYear}", {
          externalId,
        }),
      );
    }
    const body = await this.requestJson<UpstreamInjuriesResponse>(
      `/injuries?team=${encodeURIComponent(match[1])}&season=${encodeURIComponent(match[2])}`,
    );
    if (!body.ok) return body;
    try {
      const teamId = await this.options.resolveIds.teamId(Number(match[1]));
      return ok(
        await mapInjuriesToCanonical(
          body.value,
          internalId,
          { teamId },
          {
            playerId: async (id) => {
              const resolved = await this.options.resolveIds.playerId?.(id);
              if (!resolved) throw new Error(`Unable to resolve player ${id}`);
              return resolved;
            },
            teamId: this.options.resolveIds.teamId,
          },
        ),
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Team injuries mapping failed", { cause: message }));
    }
  }

  async getTrophies(
    internalId: string,
    externalId: string,
  ): Promise<Result<TrophyReport, AppError>> {
    const parsed = parseTrophyExternalId(externalId);
    if (!parsed) {
      return err(providerError("Trophy external id must be player|coach:{id}", { externalId }));
    }
    const body = await this.requestJson<UpstreamTrophiesResponse>(
      `/trophies?${parsed.subjectType}=${encodeURIComponent(parsed.id)}`,
    );
    if (!body.ok) return body;
    try {
      let subjectId: string;
      if (parsed.subjectType === "player") {
        const resolved = await this.options.resolveIds.playerId?.(Number(parsed.id));
        if (!resolved) throw new Error(`Unable to resolve player ${parsed.id}`);
        subjectId = resolved;
      } else {
        const resolved = await this.options.resolveIds.coachId?.(Number(parsed.id));
        if (!resolved) throw new Error(`Unable to resolve coach ${parsed.id}`);
        subjectId = resolved;
      }
      return ok(mapTrophiesToCanonical(body.value, internalId, parsed.subjectType, subjectId));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Trophies mapping failed", { cause: message }));
    }
  }

  async getSidelined(
    internalId: string,
    externalId: string,
  ): Promise<Result<SidelinedReport, AppError>> {
    const parsed = parseSidelinedExternalId(externalId);
    if (!parsed) {
      return err(providerError("Sidelined external id must be player|coach:{id}", { externalId }));
    }
    const body = await this.requestJson<UpstreamSidelinedResponse>(
      `/sidelined?${parsed.subjectType}=${encodeURIComponent(parsed.id)}`,
    );
    if (!body.ok) return body;
    try {
      if (parsed.subjectType === "player") {
        const playerId = await this.options.resolveIds.playerId?.(Number(parsed.id));
        if (!playerId) throw new Error(`Unable to resolve player ${parsed.id}`);
        return ok(mapSidelinedToCanonical(body.value, internalId, { playerId }));
      }
      const coachId = await this.options.resolveIds.coachId?.(Number(parsed.id));
      if (!coachId) throw new Error(`Unable to resolve coach ${parsed.id}`);
      return ok(mapSidelinedToCanonical(body.value, internalId, { coachId }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Sidelined mapping failed", { cause: message }));
    }
  }

  async getSeasonRounds(
    internalId: string,
    externalId: string,
  ): Promise<Result<SeasonRounds, AppError>> {
    const parsed = parseRoundsExternalId(externalId);
    if (!parsed) {
      return err(providerError("Rounds external id must be leagueId:seasonYear", { externalId }));
    }
    const body = await this.requestJson<UpstreamRoundsResponse>(
      `/fixtures/rounds?league=${encodeURIComponent(parsed.leagueId)}&season=${encodeURIComponent(parsed.seasonYear)}`,
    );
    if (!body.ok) return body;
    try {
      const seasonId = await this.options.resolveIds.seasonId(
        Number(parsed.leagueId),
        Number(parsed.seasonYear),
      );
      return ok(mapSeasonRoundsToCanonical(body.value, internalId, seasonId));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Season rounds mapping failed", { cause: message }));
    }
  }

  async search(query: string): Promise<Result<ProviderSearchHit[], AppError>> {
    const q = query.trim();
    if (q.length < 3) {
      return err(providerError("Search query must be at least 3 characters", { query: q }));
    }
    const encoded = encodeURIComponent(q);
    const [teams, leagues, players] = await Promise.all([
      this.requestJson<UpstreamTeamsSearchResponse>(`/teams?search=${encoded}`),
      this.requestJson<UpstreamLeaguesSearchResponse>(`/leagues?search=${encoded}`),
      this.requestJson<UpstreamPlayerProfilesSearchResponse>(
        `/players/profiles?search=${encoded}`,
      ),
    ]);

    // Soft-fail individual arms so one upstream miss does not empty the whole search.
    const hits: ProviderSearchHit[] = [];
    if (teams.ok) hits.push(...mapTeamsSearchHits(teams.value));
    if (leagues.ok) hits.push(...mapLeaguesSearchHits(leagues.value));
    if (players.ok) hits.push(...mapPlayerProfilesSearchHits(players.value));

    if (!teams.ok && !leagues.ok && !players.ok) {
      return err(teams.error);
    }

    // Cap to keep response small and quota-friendly for UUID binding.
    return ok(hits.slice(0, 40));
  }
}
