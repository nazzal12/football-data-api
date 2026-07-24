import type {
  AppError,
  Clock,
  FreshnessClass,
  Logger,
  ObjectType,
  Result,
} from "@football-api/core";
import {
  createId,
  err,
  notFoundError,
  ok,
  providerError,
  sha256Hex,
  stableStringify,
  validationError,
} from "@football-api/core";
import { metaKey, objectKey, projectionKey, quotaKey } from "@football-api/core";
import type {
  Coach,
  Competition,
  Country,
  HeadToHead,
  InjuryReport,
  Match,
  MatchEvent,
  MatchListProjection,
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
} from "@football-api/domain";
import {
  coachSchema,
  competitionSchema,
  countrySchema,
  headToHeadSchema,
  injuryReportSchema,
  matchListProjectionSchema,
  matchOddsSchema,
  matchPlayerStatisticsSchema,
  matchPredictionSchema,
  matchSchema,
  matchStatisticsSchema,
  parseCanonical,
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
} from "@football-api/domain";
import {
  applyFailedRefresh,
  applySuccessfulRefresh,
  decide,
  policyFor,
  staticPolicy,
  tablePolicy,
  withLease,
} from "@football-api/lifecycle";
import type { FootballProvider, IdBridge, QuotaSnapshot } from "@football-api/provider";
import type { HttpCache, MetaStore, ObjectMetadata, ObjectStore } from "@football-api/storage";
import {
  getMatchListProjection as loadMatchListProjectionDoc,
  parseMatchListProjectionKey,
  putMatchListProjection,
} from "@football-api/storage";
import type { z } from "zod";

export type OrchestratorDeps = {
  objects: ObjectStore;
  meta: MetaStore;
  cache: HttpCache;
  provider: FootballProvider;
  ids: IdBridge & {
    toExternal?(internalId: string): Promise<string | null>;
    ensure?(externalType: string, externalId: string): Promise<string>;
  };
  clock: Clock;
  logger: Logger;
};

export type GetMatchResult = {
  match: Match;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetTeamResult = {
  team: Team;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetCompetitionResult = {
  competition: Competition;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetSeasonResult = {
  season: Season;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetStandingsResult = {
  standings: Standings;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchListResult = {
  projection: MatchListProjection;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchEventsResult = {
  matchId: string;
  events: MatchEvent[];
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchLineupsResult = {
  matchId: string;
  lineups: Match["lineups"];
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchStatisticsResult = {
  statistics: MatchStatistics;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchPredictionResult = {
  prediction: MatchPrediction;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetSquadResult = {
  squad: Squad;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchOddsResult = {
  odds: MatchOdds;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchInjuriesResult = {
  injuries: InjuryReport;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetHeadToHeadResult = {
  h2h: HeadToHead;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetSeasonLeadersResult = {
  leaders: SeasonLeaders;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetPlayerResult = {
  player: Player;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetCoachResult = {
  coach: Coach;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetTransferReportResult = {
  transfers: TransferReport;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetTeamSeasonStatisticsResult = {
  statistics: TeamSeasonStatistics;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetCountryResult = {
  country: Country;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetVenueResult = {
  venue: Venue;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetMatchPlayerStatisticsResult = {
  statistics: MatchPlayerStatistics;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetTrophyReportResult = {
  trophies: TrophyReport;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetSidelinedReportResult = {
  sidelined: SidelinedReport;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetSeasonRoundsResult = {
  rounds: SeasonRounds;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

export type GetInjuryReportResult = {
  injuries: InjuryReport;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

type ResourceResult<T> = {
  data: T;
  cacheHit: boolean;
  refreshed: boolean;
  cacheTtlSeconds: number;
};

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async getMatchByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetMatchResult, AppError>> {
    const internalId = await this.ensureExternal("match", externalId);
    if (!internalId.ok) return internalId;
    return this.getMatch(request, internalId.value);
  }

  async getMatch(request: Request, internalId: string): Promise<Result<GetMatchResult, AppError>> {
    const cached = await this.deps.cache.match(request);
    if (cached) {
      const body = await cached.json();
      return ok({
        match: parseCanonical(matchSchema, body),
        cacheHit: true,
        refreshed: false,
        cacheTtlSeconds: 0,
      });
    }

    const mKey = metaKey("match", internalId);
    let meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    let current: Match | null = null;
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        current = parseCanonical(matchSchema, JSON.parse(textDecoder.decode(bytes)));
      }
    }

    const nowMs = this.deps.clock.nowMs();
    const phase = current?.phase ?? (meta?.phase as Match["phase"] | undefined) ?? "future";
    const policy = policyFor("match", phase, nowMs, {
      kickoffAtMs: current ? Date.parse(current.kickoffAt) : undefined,
    });
    const quota = await this.deps.meta.getJson<QuotaSnapshot>(quotaKey(this.deps.provider.name));
    const action = decide({
      meta,
      nowMs,
      policy,
      hasServableObject: current !== null,
      quotaAvailable: isQuotaAvailable(quota),
    });
    const effectiveAction =
      current === null && (action.type === "error" || action.type === "wait")
        ? { type: "refresh" as const, swr: false, acquireLease: true }
        : action;

    if (effectiveAction.type === "serve" && current) {
      if ("fillCache" in effectiveAction && effectiveAction.fillCache) {
        await this.fillCache(request, current, policy.cacheTtlSeconds);
      }
      return ok({
        match: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if (effectiveAction.type === "error") {
      if (current) {
        return ok({
          match: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(notFoundError("Match unavailable", { id: internalId }));
    }

    if (effectiveAction.type === "wait") {
      if (current) {
        return ok({
          match: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      await new Promise((r) => setTimeout(r, 25));
      meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
      if (meta?.r2Key) {
        const bytes = await this.deps.objects.get(meta.r2Key);
        if (bytes) {
          return ok({
            match: parseCanonical(matchSchema, JSON.parse(textDecoder.decode(bytes))),
            cacheHit: false,
            refreshed: false,
            cacheTtlSeconds: policy.cacheTtlSeconds,
          });
        }
      }
      return err(notFoundError("Match refresh in progress", { id: internalId }));
    }

    return this.refreshMatch(request, internalId, meta, current, policy, nowMs, mKey);
  }

  async getTeam(request: Request, internalId: string): Promise<Result<GetTeamResult, AppError>> {
    if (!this.deps.provider.getTeam) {
      return err(notFoundError("Team provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "team",
      schema: teamSchema,
      freshnessClass: "static",
      label: "Team",
      fetch: (id, ext) => this.deps.provider.getTeam!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      team: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getTeamByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetTeamResult, AppError>> {
    const internalId = await this.ensureExternal("team", externalId);
    if (!internalId.ok) return internalId;
    return this.getTeam(request, internalId.value);
  }

  async getCompetition(
    request: Request,
    internalId: string,
  ): Promise<Result<GetCompetitionResult, AppError>> {
    if (!this.deps.provider.getCompetition) {
      return err(notFoundError("Competition provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "competition",
      schema: competitionSchema,
      freshnessClass: "static",
      label: "Competition",
      fetch: (id, ext) => this.deps.provider.getCompetition!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      competition: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getCompetitionByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetCompetitionResult, AppError>> {
    const internalId = await this.ensureExternal("competition", externalId);
    if (!internalId.ok) return internalId;
    return this.getCompetition(request, internalId.value);
  }

  async getSeason(
    request: Request,
    internalId: string,
  ): Promise<Result<GetSeasonResult, AppError>> {
    if (!this.deps.provider.getSeason) {
      return err(notFoundError("Season provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "season",
      schema: seasonSchema,
      freshnessClass: "static",
      label: "Season",
      fetch: (id, ext) => this.deps.provider.getSeason!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      season: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getSeasonByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetSeasonResult, AppError>> {
    const internalId = await this.ensureExternal("season", externalId);
    if (!internalId.ok) return internalId;
    return this.getSeason(request, internalId.value);
  }

  async getStandings(
    request: Request,
    internalId: string,
  ): Promise<Result<GetStandingsResult, AppError>> {
    if (!this.deps.provider.getStandings) {
      return err(notFoundError("Standings provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "standing",
      schema: standingsSchema,
      freshnessClass: "table",
      label: "Standings",
      fetch: (id, ext) => this.deps.provider.getStandings!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      standings: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getStandingsByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetStandingsResult, AppError>> {
    const internalId = await this.ensureExternal("standing", externalId);
    if (!internalId.ok) return internalId;
    return this.getStandings(request, internalId.value);
  }

  /**
   * Match-list projection refresh-on-read.
   * Key format: `date:YYYY-MM-DD` (e.g. date:2024-08-16).
   */
  async getMatchListProjection(
    request: Request,
    key: string,
  ): Promise<Result<GetMatchListResult, AppError>> {
    const parsed = parseMatchListProjectionKey(key);
    if (!parsed) {
      return err(
        validationError(
          "Projection key must be date:YYYY-MM-DD, league:ID:YEAR, team:ID:YEAR, or live",
          { key },
        ),
      );
    }

    const cached = await this.deps.cache.match(request);
    if (cached) {
      return ok({
        projection: parseCanonical(matchListProjectionSchema, await cached.json()),
        cacheHit: true,
        refreshed: false,
        cacheTtlSeconds: 0,
      });
    }

    const pKey = projectionKey("match_list", key);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(pKey);
    const current = await loadMatchListProjectionDoc(this.deps.objects, this.deps.meta, key);
    const nowMs = this.deps.clock.nowMs();
    const today = new Date(nowMs).toISOString().slice(0, 10);
    const racing =
      parsed.kind === "live" ||
      (parsed.kind === "date" && parsed.date >= today) ||
      parsed.kind === "league" ||
      parsed.kind === "team";
    const policy = tablePolicy(racing);
    const quota = await this.deps.meta.getJson<QuotaSnapshot>(quotaKey(this.deps.provider.name));
    const action = decide({
      meta,
      nowMs,
      policy,
      hasServableObject: current !== null,
      quotaAvailable: isQuotaAvailable(quota),
    });
    const effectiveAction =
      current === null && (action.type === "error" || action.type === "wait")
        ? { type: "refresh" as const, swr: false, acquireLease: true }
        : action;

    if (effectiveAction.type === "serve" && current) {
      if ("fillCache" in effectiveAction && effectiveAction.fillCache) {
        await this.fillCache(request, current, policy.cacheTtlSeconds);
      }
      return ok({
        projection: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if ((effectiveAction.type === "error" || effectiveAction.type === "wait") && current) {
      return ok({
        projection: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if (effectiveAction.type !== "refresh") {
      return err(notFoundError("Match list projection unavailable", { key }));
    }

    const owner = createId();
    const projectionId = meta?.objectId ?? createId();
    await this.deps.meta.putJson(
      pKey,
      withLease(meta, "projection", projectionId, owner, nowMs, policy.leaseTtlMs, "table"),
    );

    let listed: Result<string[], AppError>;
    if (parsed.kind === "date") {
      if (!this.deps.provider.listMatchExternalIdsByDate) {
        return err(notFoundError("Match list provider not implemented"));
      }
      listed = await this.deps.provider.listMatchExternalIdsByDate(parsed.date);
    } else if (parsed.kind === "league") {
      if (!this.deps.provider.listMatchExternalIdsByLeagueSeason) {
        return err(notFoundError("League match list provider not implemented"));
      }
      listed = await this.deps.provider.listMatchExternalIdsByLeagueSeason(
        parsed.leagueId,
        parsed.seasonYear,
      );
    } else if (parsed.kind === "team") {
      if (!this.deps.provider.listMatchExternalIdsByTeamSeason) {
        return err(notFoundError("Team match list provider not implemented"));
      }
      listed = await this.deps.provider.listMatchExternalIdsByTeamSeason(
        parsed.teamId,
        parsed.seasonYear,
      );
    } else {
      if (!this.deps.provider.listLiveMatchExternalIds) {
        return err(notFoundError("Live match list provider not implemented"));
      }
      listed = await this.deps.provider.listLiveMatchExternalIds();
    }
    const providerQuota = this.deps.provider.getQuota?.();
    if (providerQuota) {
      await this.deps.meta.putJson(quotaKey(this.deps.provider.name), providerQuota);
    }
    if (!listed.ok) {
      await this.deps.meta.putJson(
        pKey,
        applyFailedRefresh({
          previous: meta,
          objectType: "projection",
          objectId: projectionId,
          nowMs: this.deps.clock.nowMs(),
          errorClass: listed.error.code,
          backoffMs: 30_000,
        }),
      );
      if (current) {
        return ok({
          projection: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(listed.error);
    }

    const matchIds: string[] = [];
    try {
      const chunkSize = 40;
      for (let i = 0; i < listed.value.length; i += chunkSize) {
        const chunk = listed.value.slice(i, i + chunkSize);
        const resolved = await Promise.all(
          chunk.map(async (externalId) => {
            const internalId = await this.ensureExternal("match", externalId);
            if (!internalId.ok) throw internalId.error;
            return internalId.value;
          }),
        );
        matchIds.push(...resolved);
      }
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause) {
        return err(cause as AppError);
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Failed to resolve match ids for projection", { cause: message }));
    }

    const hash = await sha256Hex(stableStringify({ key, matchIds }));
    const same = meta?.contentHash === hash;
    const nextGeneration = same ? (meta?.generation ?? 1) : (meta?.generation ?? 0) + 1;
    const r2Key =
      same && meta?.r2Key ? meta.r2Key : objectKey("projection", projectionId, nextGeneration);
    if (!same) {
      await putMatchListProjection(this.deps.objects, this.deps.meta, {
        projectionId,
        key,
        matchIds,
        generation: nextGeneration,
      });
    }
    await this.deps.meta.putJson(
      pKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "projection",
        objectId: projectionId,
        freshnessClass: "table",
        r2Key,
        generation: nextGeneration,
        contentHash: hash,
        nowMs: this.deps.clock.nowMs(),
        policy,
      }),
    );

    const projection: MatchListProjection = {
      schemaVersion: 1,
      id: projectionId,
      kind: "match_list",
      key,
      matchIds,
    };
    await this.fillCache(request, projection, policy.cacheTtlSeconds);
    return ok({
      projection,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: policy.cacheTtlSeconds,
    });
  }

  async getMatchEvents(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchEventsResult, AppError>> {
    const loaded = await this.getMatch(request, matchId);
    if (!loaded.ok) return loaded;
    if (loaded.value.match.events.length > 0 || !this.deps.provider.getMatchEvents) {
      return ok({
        matchId,
        events: loaded.value.match.events,
        cacheHit: loaded.value.cacheHit,
        refreshed: false,
        cacheTtlSeconds: loaded.value.cacheTtlSeconds,
      });
    }
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    const events = await this.deps.provider.getMatchEvents(externalId);
    if (!events.ok) return events;
    const next = { ...loaded.value.match, events: events.value };
    await this.persistMatchSnapshot(matchId, next);
    return ok({
      matchId,
      events: events.value,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: loaded.value.cacheTtlSeconds,
    });
  }

  async getMatchLineups(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchLineupsResult, AppError>> {
    const loaded = await this.getMatch(request, matchId);
    if (!loaded.ok) return loaded;
    if (loaded.value.match.lineups.length > 0 || !this.deps.provider.getMatchLineups) {
      return ok({
        matchId,
        lineups: loaded.value.match.lineups,
        cacheHit: loaded.value.cacheHit,
        refreshed: false,
        cacheTtlSeconds: loaded.value.cacheTtlSeconds,
      });
    }
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    const lineups = await this.deps.provider.getMatchLineups(externalId);
    if (!lineups.ok) return lineups;
    const next = { ...loaded.value.match, lineups: lineups.value };
    await this.persistMatchSnapshot(matchId, next);
    return ok({
      matchId,
      lineups: lineups.value,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: loaded.value.cacheTtlSeconds,
    });
  }

  async getMatchStatistics(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchStatisticsResult, AppError>> {
    if (!this.deps.provider.getMatchStatistics) {
      return err(notFoundError("Match statistics provider not implemented"));
    }
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    const statsId = await this.ensureExternal("statistics", externalId);
    if (!statsId.ok) return statsId;
    const result = await this.loadStaticResource({
      request,
      internalId: statsId.value,
      objectType: "statistics",
      schema: matchStatisticsSchema,
      freshnessClass: "table",
      label: "Match statistics",
      fetch: (id, ext) => this.deps.provider.getMatchStatistics!(id, matchId, ext),
    });
    if (!result.ok) return result;
    return ok({
      statistics: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getMatchPrediction(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchPredictionResult, AppError>> {
    if (!this.deps.provider.getMatchPrediction) {
      return err(notFoundError("Match prediction provider not implemented"));
    }
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    const predictionId = await this.ensureExternal("prediction", externalId);
    if (!predictionId.ok) return predictionId;
    const result = await this.loadStaticResource({
      request,
      internalId: predictionId.value,
      objectType: "prediction",
      schema: matchPredictionSchema,
      freshnessClass: "table",
      label: "Match prediction",
      fetch: (id, ext) => this.deps.provider.getMatchPrediction!(id, matchId, ext),
    });
    if (!result.ok) return result;
    return ok({
      prediction: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getMatchOdds(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchOddsResult, AppError>> {
    if (!this.deps.provider.getMatchOdds) {
      return err(notFoundError("Match odds provider not implemented"));
    }
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    const oddsId = await this.ensureExternal("odds", externalId);
    if (!oddsId.ok) return oddsId;
    const result = await this.loadStaticResource({
      request,
      internalId: oddsId.value,
      objectType: "odds",
      schema: matchOddsSchema,
      freshnessClass: "table",
      label: "Match odds",
      fetch: (id, ext) => this.deps.provider.getMatchOdds!(id, matchId, ext),
    });
    if (!result.ok) return result;
    return ok({
      odds: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getMatchInjuries(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchInjuriesResult, AppError>> {
    if (!this.deps.provider.getMatchInjuries) {
      return err(notFoundError("Match injuries provider not implemented"));
    }
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    const injuryId = await this.ensureExternal("injury", `match:${externalId}`);
    if (!injuryId.ok) return injuryId;
    const result = await this.loadStaticResource({
      request,
      internalId: injuryId.value,
      objectType: "injury",
      schema: injuryReportSchema,
      freshnessClass: "table",
      label: "Match injuries",
      fetch: (id, _ext) => this.deps.provider.getMatchInjuries!(id, matchId, externalId),
    });
    if (!result.ok) return result;
    return ok({
      injuries: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getHeadToHead(
    request: Request,
    externalId: string,
  ): Promise<Result<GetHeadToHeadResult, AppError>> {
    if (!this.deps.provider.getHeadToHead) {
      return err(notFoundError("H2H provider not implemented"));
    }
    const internalId = await this.ensureExternal("h2h", externalId);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "h2h",
      schema: headToHeadSchema,
      freshnessClass: "static",
      label: "Head to head",
      fetch: (id, ext) => this.deps.provider.getHeadToHead!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      h2h: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getSeasonLeaders(
    request: Request,
    externalId: string,
  ): Promise<Result<GetSeasonLeadersResult, AppError>> {
    if (!this.deps.provider.getSeasonLeaders) {
      return err(notFoundError("Season leaders provider not implemented"));
    }
    const internalId = await this.ensureExternal("leaders", externalId);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "leaders",
      schema: seasonLeadersSchema,
      freshnessClass: "static",
      label: "Season leaders",
      fetch: (id, ext) => this.deps.provider.getSeasonLeaders!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      leaders: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getSquad(
    request: Request,
    internalId: string,
  ): Promise<Result<GetSquadResult, AppError>> {
    if (!this.deps.provider.getSquad) {
      return err(notFoundError("Squad provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "squad",
      schema: squadSchema,
      freshnessClass: "static",
      label: "Squad",
      fetch: (id, ext) => this.deps.provider.getSquad!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      squad: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getSquadByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetSquadResult, AppError>> {
    const internalId = await this.ensureExternal("squad", externalId);
    if (!internalId.ok) return internalId;
    return this.getSquad(request, internalId.value);
  }

  async getPlayer(
    request: Request,
    internalId: string,
  ): Promise<Result<GetPlayerResult, AppError>> {
    if (!this.deps.provider.getPlayer) {
      return err(notFoundError("Player provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "player",
      schema: playerSchema,
      freshnessClass: "static",
      label: "Player",
      fetch: (id, ext) => this.deps.provider.getPlayer!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      player: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getPlayerByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetPlayerResult, AppError>> {
    const internalId = await this.ensureExternal("player", externalId);
    if (!internalId.ok) return internalId;
    return this.getPlayer(request, internalId.value);
  }

  async getCoach(
    request: Request,
    internalId: string,
  ): Promise<Result<GetCoachResult, AppError>> {
    if (!this.deps.provider.getCoach) {
      return err(notFoundError("Coach provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "coach",
      schema: coachSchema,
      freshnessClass: "static",
      label: "Coach",
      fetch: (id, ext) => this.deps.provider.getCoach!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      coach: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getCoachByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetCoachResult, AppError>> {
    const internalId = await this.ensureExternal("coach", externalId);
    if (!internalId.ok) return internalId;
    return this.getCoach(request, internalId.value);
  }

  async getTeamCoachByExternal(
    request: Request,
    teamExternalId: string,
  ): Promise<Result<GetCoachResult, AppError>> {
    if (!this.deps.provider.getCoachByTeam) {
      return err(notFoundError("Team coach provider not implemented"));
    }
    const fetched = await this.deps.provider.getCoachByTeam("", teamExternalId);
    if (!fetched.ok) return fetched;
    const coach = fetched.value;
    const mKey = metaKey("coach", coach.id);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        const cached = parseCanonical(coachSchema, JSON.parse(textDecoder.decode(bytes)));
        const policy = staticPolicy();
        await this.fillCache(request, cached, policy.cacheTtlSeconds);
        return ok({
          coach: cached,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
    }
    const policy = staticPolicy();
    const generation = (meta?.generation ?? 0) + 1;
    const r2Key = objectKey("coach", coach.id, generation);
    const hash = await sha256Hex(stableStringify(coach));
    await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(coach)));
    await this.deps.meta.putJson(
      mKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "coach",
        objectId: coach.id,
        freshnessClass: "static",
        r2Key,
        generation,
        contentHash: hash,
        nowMs: this.deps.clock.nowMs(),
        policy,
      }),
    );
    await this.fillCache(request, coach, policy.cacheTtlSeconds);
    return ok({
      coach,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: policy.cacheTtlSeconds,
    });
  }

  async getTransfersByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetTransferReportResult, AppError>> {
    if (!this.deps.provider.getTransfers) {
      return err(notFoundError("Transfers provider not implemented"));
    }
    const internalId = await this.ensureExternal("transfer", externalId);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "transfer",
      schema: transferReportSchema,
      freshnessClass: "table",
      label: "Transfers",
      fetch: (id, ext) => this.deps.provider.getTransfers!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      transfers: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getTeamSeasonStatisticsByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetTeamSeasonStatisticsResult, AppError>> {
    if (!this.deps.provider.getTeamSeasonStatistics) {
      return err(notFoundError("Team season statistics provider not implemented"));
    }
    const internalId = await this.ensureExternal("statistics", `teamseason:${externalId}`);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "statistics",
      schema: teamSeasonStatisticsSchema,
      freshnessClass: "table",
      label: "Team season statistics",
      fetch: (id, _ext) => this.deps.provider.getTeamSeasonStatistics!(id, externalId),
    });
    if (!result.ok) return result;
    return ok({
      statistics: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getCountryByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetCountryResult, AppError>> {
    if (!this.deps.provider.getCountry) {
      return err(notFoundError("Country provider not implemented"));
    }
    const internalId = await this.ensureExternal("country", externalId.toLowerCase());
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "country",
      schema: countrySchema,
      freshnessClass: "static",
      label: "Country",
      fetch: (id, ext) => this.deps.provider.getCountry!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      country: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getVenue(
    request: Request,
    internalId: string,
  ): Promise<Result<GetVenueResult, AppError>> {
    if (!this.deps.provider.getVenue) {
      return err(notFoundError("Venue provider not implemented"));
    }
    const result = await this.loadStaticResource({
      request,
      internalId,
      objectType: "venue",
      schema: venueSchema,
      freshnessClass: "static",
      label: "Venue",
      fetch: (id, ext) => this.deps.provider.getVenue!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      venue: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getVenueByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetVenueResult, AppError>> {
    const internalId = await this.ensureExternal("venue", externalId);
    if (!internalId.ok) return internalId;
    return this.getVenue(request, internalId.value);
  }

  async getMatchPlayerStatistics(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchPlayerStatisticsResult, AppError>> {
    if (!this.deps.provider.getMatchPlayerStatistics) {
      return err(notFoundError("Match player statistics provider not implemented"));
    }
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    const statsId = await this.ensureExternal("statistics", `matchplayers:${externalId}`);
    if (!statsId.ok) return statsId;
    const result = await this.loadStaticResource({
      request,
      internalId: statsId.value,
      objectType: "statistics",
      schema: matchPlayerStatisticsSchema,
      freshnessClass: "table",
      label: "Match player statistics",
      fetch: (id, _ext) =>
        this.deps.provider.getMatchPlayerStatistics!(id, matchId, externalId),
    });
    if (!result.ok) return result;
    return ok({
      statistics: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getTeamInjuriesByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetInjuryReportResult, AppError>> {
    if (!this.deps.provider.getTeamInjuries) {
      return err(notFoundError("Team injuries provider not implemented"));
    }
    const internalId = await this.ensureExternal("injury", externalId);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "injury",
      schema: injuryReportSchema,
      freshnessClass: "table",
      label: "Team injuries",
      fetch: (id, ext) => this.deps.provider.getTeamInjuries!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      injuries: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getTrophiesByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetTrophyReportResult, AppError>> {
    if (!this.deps.provider.getTrophies) {
      return err(notFoundError("Trophies provider not implemented"));
    }
    const internalId = await this.ensureExternal("trophy", externalId);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "trophy",
      schema: trophyReportSchema,
      freshnessClass: "table",
      label: "Trophies",
      fetch: (id, ext) => this.deps.provider.getTrophies!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      trophies: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getSidelinedByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetSidelinedReportResult, AppError>> {
    if (!this.deps.provider.getSidelined) {
      return err(notFoundError("Sidelined provider not implemented"));
    }
    const internalId = await this.ensureExternal("sidelined", externalId);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "sidelined",
      schema: sidelinedReportSchema,
      freshnessClass: "table",
      label: "Sidelined",
      fetch: (id, ext) => this.deps.provider.getSidelined!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      sidelined: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  async getSeasonRoundsByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetSeasonRoundsResult, AppError>> {
    if (!this.deps.provider.getSeasonRounds) {
      return err(notFoundError("Season rounds provider not implemented"));
    }
    const internalId = await this.ensureExternal("rounds", externalId);
    if (!internalId.ok) return internalId;
    const result = await this.loadStaticResource({
      request,
      internalId: internalId.value,
      objectType: "rounds",
      schema: seasonRoundsSchema,
      freshnessClass: "static",
      label: "Season rounds",
      fetch: (id, ext) => this.deps.provider.getSeasonRounds!(id, ext),
    });
    if (!result.ok) return result;
    return ok({
      rounds: result.value.data,
      cacheHit: result.value.cacheHit,
      refreshed: result.value.refreshed,
      cacheTtlSeconds: result.value.cacheTtlSeconds,
    });
  }

  private async persistMatchSnapshot(matchId: string, match: Match): Promise<void> {
    const mKey = metaKey("match", matchId);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    const generation = (meta?.generation ?? 0) + 1;
    const r2Key = objectKey("match", matchId, generation);
    await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(match)));
    const hash = await sha256Hex(stableStringify(match));
    const nowMs = this.deps.clock.nowMs();
    const policy = policyFor("match", match.phase, nowMs, {
      kickoffAtMs: Date.parse(match.kickoffAt),
    });
    await this.deps.meta.putJson(
      mKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "match",
        objectId: matchId,
        phase: match.phase,
        freshnessClass:
          match.phase === "live" ? "live" : match.phase === "future" ? "edition" : "table",
        r2Key,
        generation,
        contentHash: hash,
        nowMs,
        policy,
      }),
    );
  }

  private async ensureExternal(
    externalType: string,
    externalId: string,
  ): Promise<Result<string, AppError>> {
    let internalId = await this.deps.ids.toInternal({
      provider: this.deps.provider.name,
      externalType,
      externalId,
    });
    if (!internalId) {
      if (!this.deps.ids.ensure) {
        return err(notFoundError("No id mapping and ensure() unavailable", { externalId }));
      }
      internalId = await this.deps.ids.ensure(externalType, externalId);
    }
    return ok(internalId);
  }

  private async loadStaticResource<T>(args: {
    request: Request;
    internalId: string;
    objectType: ObjectType;
    schema: z.ZodType<T>;
    freshnessClass: FreshnessClass;
    label: string;
    fetch: (internalId: string, externalId: string) => Promise<Result<T, AppError>>;
  }): Promise<Result<ResourceResult<T>, AppError>> {
    const cached = await this.deps.cache.match(args.request);
    if (cached) {
      return ok({
        data: parseCanonical(args.schema, await cached.json()),
        cacheHit: true,
        refreshed: false,
        cacheTtlSeconds: 0,
      });
    }

    const mKey = metaKey(args.objectType, args.internalId);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    let current: T | null = null;
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        current = parseCanonical(args.schema, JSON.parse(textDecoder.decode(bytes)));
      }
    }

    const nowMs = this.deps.clock.nowMs();
    const policy = policyFor(args.objectType, undefined, nowMs, {
      racing: args.freshnessClass === "table",
    });
    const quota = await this.deps.meta.getJson<QuotaSnapshot>(quotaKey(this.deps.provider.name));
    const action = decide({
      meta,
      nowMs,
      policy,
      hasServableObject: current !== null,
      quotaAvailable: isQuotaAvailable(quota),
    });
    const effectiveAction =
      current === null && (action.type === "error" || action.type === "wait")
        ? { type: "refresh" as const, swr: false, acquireLease: true }
        : action;

    if (effectiveAction.type === "serve" && current) {
      if ("fillCache" in effectiveAction && effectiveAction.fillCache) {
        await this.fillCache(args.request, current, policy.cacheTtlSeconds);
      }
      return ok({
        data: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if ((effectiveAction.type === "error" || effectiveAction.type === "wait") && current) {
      return ok({
        data: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if (effectiveAction.type !== "refresh") {
      return err(notFoundError(`${args.label} unavailable`, { id: args.internalId }));
    }

    const owner = createId();
    await this.deps.meta.putJson(
      mKey,
      withLease(
        meta,
        args.objectType,
        args.internalId,
        owner,
        nowMs,
        policy.leaseTtlMs,
        args.freshnessClass,
      ),
    );

    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(args.internalId)
      : null;
    if (!externalId) {
      return err(
        notFoundError(`No external id mapping for ${args.label.toLowerCase()}`, {
          id: args.internalId,
        }),
      );
    }

    const result = await args.fetch(args.internalId, externalId).catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Provider fetch threw", { cause: message })) as Result<
        T,
        AppError
      >;
    });
    const providerQuota = this.deps.provider.getQuota?.();
    if (providerQuota) {
      await this.deps.meta.putJson(quotaKey(this.deps.provider.name), providerQuota);
    }
    if (!result.ok) {
      await this.deps.meta.putJson(
        mKey,
        applyFailedRefresh({
          previous: meta,
          objectType: args.objectType,
          objectId: args.internalId,
          nowMs: this.deps.clock.nowMs(),
          errorClass: result.error.code,
          backoffMs: 30_000,
        }),
      );
      if (current) {
        return ok({
          data: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(result.error);
    }

    const data = result.value;
    const hash = await sha256Hex(stableStringify(data));
    const same = meta?.contentHash === hash;
    const nextGeneration = same ? (meta?.generation ?? 1) : (meta?.generation ?? 0) + 1;
    const r2Key =
      same && meta?.r2Key
        ? meta.r2Key
        : objectKey(args.objectType, args.internalId, nextGeneration);
    if (!same) {
      await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(data)));
    }
    await this.deps.meta.putJson(
      mKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: args.objectType,
        objectId: args.internalId,
        freshnessClass: args.freshnessClass,
        r2Key,
        generation: nextGeneration,
        contentHash: hash,
        nowMs: this.deps.clock.nowMs(),
        policy,
      }),
    );
    await this.fillCache(args.request, data, policy.cacheTtlSeconds);
    return ok({
      data,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: policy.cacheTtlSeconds,
    });
  }

  private async refreshMatch(
    request: Request,
    internalId: string,
    meta: ObjectMetadata | null,
    current: Match | null,
    policy: ReturnType<typeof policyFor>,
    nowMs: number,
    mKey: string,
  ): Promise<Result<GetMatchResult, AppError>> {
    const owner = createId();
    await this.deps.meta.putJson(
      mKey,
      withLease(meta, "match", internalId, owner, nowMs, policy.leaseTtlMs, "live"),
    );
    const afterLease = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    if (afterLease?.leaseOwner && afterLease.leaseOwner !== owner) {
      if (current) {
        return ok({
          match: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(notFoundError("Match refresh coalesced", { id: internalId }));
    }

    const externalId = this.deps.ids.toExternal ? await this.deps.ids.toExternal(internalId) : null;
    if (!externalId) {
      await this.deps.meta.putJson(
        mKey,
        applyFailedRefresh({
          previous: meta,
          objectType: "match",
          objectId: internalId,
          nowMs,
          errorClass: "NOT_FOUND",
          backoffMs: 30_000,
        }),
      );
      return err(notFoundError("No external id mapping for match", { id: internalId }));
    }

    const result = await this.deps.provider.getMatch(internalId, externalId);
    const providerQuota = this.deps.provider.getQuota?.();
    if (providerQuota) {
      await this.deps.meta.putJson(quotaKey(this.deps.provider.name), providerQuota);
    }

    if (!result.ok) {
      await this.deps.meta.putJson(
        mKey,
        applyFailedRefresh({
          previous: meta,
          objectType: "match",
          objectId: internalId,
          nowMs: this.deps.clock.nowMs(),
          errorClass: result.error.code,
          backoffMs: 30_000,
        }),
      );
      if (current) {
        return ok({
          match: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(result.error);
    }

    const match = result.value;
    const hash = await sha256Hex(stableStringify(match));
    const same = meta?.contentHash === hash;
    const nextGeneration = same ? (meta?.generation ?? 1) : (meta?.generation ?? 0) + 1;
    const r2Key = same && meta?.r2Key ? meta.r2Key : objectKey("match", internalId, nextGeneration);
    if (!same) {
      await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(match)));
    }
    await this.deps.meta.putJson(
      mKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "match",
        objectId: internalId,
        phase: match.phase,
        freshnessClass:
          match.phase === "live" ? "live" : match.phase === "future" ? "edition" : "table",
        r2Key,
        generation: nextGeneration,
        contentHash: hash,
        nowMs: this.deps.clock.nowMs(),
        policy,
      }),
    );
    await this.fillCache(request, match, policy.cacheTtlSeconds);
    this.deps.logger.info("match.refresh.success", {
      id: internalId,
      phase: match.phase,
      noop: same,
      generation: nextGeneration,
    });
    return ok({
      match,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: policy.cacheTtlSeconds,
    });
  }

  private async fillCache(
    request: Request,
    body: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    await this.deps.cache.put(
      request,
      new Response(JSON.stringify(body), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${ttlSeconds}`,
        },
      }),
    );
  }
}

function isQuotaAvailable(quota: QuotaSnapshot | null): boolean {
  if (!quota) return true;
  if (quota.dailyRemaining !== undefined && quota.dailyRemaining <= 0) return false;
  if (quota.minuteRemaining !== undefined && quota.minuteRemaining <= 0) return false;
  return true;
}
