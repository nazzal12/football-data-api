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
  FEATURED_LEAGUE_EXTERNAL_IDS,
  notFoundError,
  ok,
  PROVIDER_FIXTURE_TIMEZONE,
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
  MatchListItem,
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
  SearchResult,
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
  searchResultSchema,
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
  dateListPolicy,
  decide,
  policyFor,
  staticPolicy,
  liveListPolicy,
  tablePolicy,
  withLease,
  type PolicyPack,
} from "@football-api/lifecycle";
import type {
  FootballProvider,
  IdBridge,
  ProviderMatchListRow,
  QuotaSnapshot,
} from "@football-api/provider";
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
    flush?(): Promise<void>;
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
  /** Soft-expired: caller should `waitUntil` this without blocking the response. */
  backgroundRefresh?: () => Promise<void>;
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

export type GetSearchResult = {
  search: SearchResult;
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
    try {
      return await this.getMatchUnflushed(request, internalId);
    } finally {
      await this.deps.ids.flush?.();
    }
  }

  private async getMatchUnflushed(
    request: Request,
    internalId: string,
  ): Promise<Result<GetMatchResult, AppError>> {
    // Sub-resource callers (events/statistics/lineups) pass their own Request.
    // Always key Cache API by the match URL so bodies never collide.
    const cacheRequest = this.resourceCacheRequest(request, `/v1/matches/${internalId}`);
    const respond = async (
      match: Match,
      opts: { cacheHit: boolean; refreshed: boolean; cacheTtlSeconds?: number },
    ): Promise<Result<GetMatchResult, AppError>> => {
      const nowMs = this.deps.clock.nowMs();
      const coerced = coerceStaleLiveMatch(match, nowMs);
      const policy = policyFor("match", coerced.phase, nowMs, {
        kickoffAtMs: Date.parse(coerced.kickoffAt),
      });
      if (coerced.phase !== match.phase) {
        // Drop stuck "live" from edge so later hits don't re-poison clients.
        await this.fillCache(cacheRequest, coerced, policy.cacheTtlSeconds);
      }
      return ok({
        match: coerced,
        cacheHit: opts.cacheHit,
        refreshed: opts.refreshed,
        cacheTtlSeconds: opts.cacheTtlSeconds ?? policy.cacheTtlSeconds,
      });
    };

    const cached = await this.deps.cache.match(cacheRequest);
    if (cached) {
      try {
        const match = parseCanonical(matchSchema, await cached.json());
        const nowMs = this.deps.clock.nowMs();
        // Never short-circuit live from Cache API — CF/edge can hold bodies past
        // max-age and clients then see a clock that jumps backward vs the live list.
        if (match.phase !== "live") {
          const pastKickoffFuture =
            match.phase === "future" && Date.parse(match.kickoffAt) <= nowMs;
          if (!pastKickoffFuture && !matchEventsNeedDisplayNames(match)) {
            return respond(match, { cacheHit: true, refreshed: false });
          }
        }
      } catch {
        // Corrupt or wrong-typed edge entry — fall through to R2 / refresh.
      }
    }

    const mKey = metaKey("match", internalId);
    let meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    let current: Match | null = null;
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        try {
          current = parseCanonical(matchSchema, JSON.parse(textDecoder.decode(bytes)));
        } catch {
          current = null;
        }
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
    let effectiveAction =
      current === null && (action.type === "error" || action.type === "wait")
        ? { type: "refresh" as const, swr: false, acquireLease: true }
        : action;

    if (
      current &&
      matchEventsNeedDisplayNames(current) &&
      isQuotaAvailable(quota) &&
      (effectiveAction.type === "serve" || effectiveAction.type === "wait")
    ) {
      effectiveAction = { type: "refresh", swr: false, acquireLease: true };
    }

    // Kickoff passed but snapshot still "future" — force refresh into live/finished.
    if (
      current &&
      current.phase === "future" &&
      Date.parse(current.kickoffAt) <= nowMs &&
      isQuotaAvailable(quota) &&
      (effectiveAction.type === "serve" || effectiveAction.type === "wait")
    ) {
      effectiveAction = { type: "refresh", swr: true, acquireLease: true };
    }

    if (effectiveAction.type === "serve" && current) {
      if ("fillCache" in effectiveAction && effectiveAction.fillCache) {
        await this.fillCache(cacheRequest, current, policy.cacheTtlSeconds);
      }
      return respond(current, { cacheHit: false, refreshed: false });
    }

    if (effectiveAction.type === "error") {
      if (current) {
        return respond(current, { cacheHit: false, refreshed: false });
      }
      return err(notFoundError("Match unavailable", { id: internalId }));
    }

    if (effectiveAction.type === "wait") {
      if (current) {
        return respond(current, { cacheHit: false, refreshed: false });
      }
      await new Promise((r) => setTimeout(r, 25));
      meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
      if (meta?.r2Key) {
        const bytes = await this.deps.objects.get(meta.r2Key);
        if (bytes) {
          try {
            return respond(
              parseCanonical(matchSchema, JSON.parse(textDecoder.decode(bytes))),
              { cacheHit: false, refreshed: false },
            );
          } catch {
            /* fall through */
          }
        }
      }
      return err(notFoundError("Match refresh in progress", { id: internalId }));
    }

    return this.refreshMatch(cacheRequest, internalId, meta, current, policy, nowMs, mKey);
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
   * Soft-expired lists with existing R2 data return immediately (SWR) and expose
   * `backgroundRefresh` for the HTTP layer to `waitUntil`.
   */
  async getMatchListProjection(
    request: Request,
    key: string,
    opts?: { forceRefresh?: boolean },
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

    const nowMs = this.deps.clock.nowMs();
    const today = calendarDateInTz(nowMs, PROVIDER_FIXTURE_TIMEZONE);
    const racing =
      (parsed.kind === "date" && parsed.date >= today) ||
      parsed.kind === "league" ||
      parsed.kind === "team";
    // Live: 5s. Today/tomorrow date lists: 5m. League/team: 5h. Past dates: forever.
    const policy =
      parsed.kind === "live"
        ? liveListPolicy()
        : parsed.kind === "date"
          ? dateListPolicy(racing)
          : tablePolicy(racing);

    // Live lists must not be served from the edge Cache API alone — a HIT skips
    // soft-TTL / rebuild and can pin multi-day-stale "live" cards forever.
    if (!opts?.forceRefresh && parsed.kind !== "live") {
      const cached = await this.deps.cache.match(request);
      if (cached) {
        try {
          return ok({
            projection: parseCanonical(matchListProjectionSchema, await cached.json()),
            cacheHit: true,
            refreshed: false,
            cacheTtlSeconds: policy.cacheTtlSeconds,
          });
        } catch {
          /* fall through */
        }
      }
    }

    const pKey = projectionKey("match_list", key);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(pKey);
    const current = await loadMatchListProjectionDoc(this.deps.objects, this.deps.meta, key);
    const quota = await this.deps.meta.getJson<QuotaSnapshot>(quotaKey(this.deps.provider.name));
    const action = decide({
      meta,
      nowMs,
      policy,
      hasServableObject: current !== null,
      quotaAvailable: isQuotaAvailable(quota),
    });
    let effectiveAction =
      current === null && (action.type === "error" || action.type === "wait")
        ? { type: "refresh" as const, swr: false, acquireLease: true }
        : action;

    // Honor tighter policies against older softExpireAt (e.g. date lists 5h → 5m).
    if (
      current &&
      meta?.lastRefreshedAt !== undefined &&
      nowMs >= meta.lastRefreshedAt + policy.softTtlMs &&
      isQuotaAvailable(quota) &&
      (effectiveAction.type === "serve" ||
        effectiveAction.type === "wait" ||
        effectiveAction.type === "error")
    ) {
      effectiveAction = { type: "refresh", swr: true, acquireLease: true };
    }

    if (opts?.forceRefresh && isQuotaAvailable(quota)) {
      effectiveAction = { type: "refresh", swr: false, acquireLease: true };
    }

    if (effectiveAction.type === "serve" && current) {
      if (parsed.kind === "live") {
        const sanitized = sanitizeLiveProjection(current, nowMs);
        const before = current.items?.length ?? current.matchIds.length;
        const after = sanitized.items?.length ?? sanitized.matchIds.length;
        // Stale snapshot filtered to empty/partial — rebuild from provider now.
        if (after < before && isQuotaAvailable(quota)) {
          effectiveAction = { type: "refresh", swr: false, acquireLease: true };
        } else {
          if ("fillCache" in effectiveAction && effectiveAction.fillCache) {
            await this.fillCache(request, sanitized, policy.cacheTtlSeconds);
          }
          return ok({
            projection: sanitized,
            cacheHit: false,
            refreshed: false,
            cacheTtlSeconds: policy.cacheTtlSeconds,
          });
        }
      } else {
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
    }

    if ((effectiveAction.type === "error" || effectiveAction.type === "wait") && current) {
      const projection =
        parsed.kind === "live" ? sanitizeLiveProjection(current, nowMs) : current;
      return ok({
        projection,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if (effectiveAction.type !== "refresh") {
      return err(notFoundError("Match list projection unavailable", { key }));
    }

    // Soft-expired but we have a projection: serve immediately, refresh in background.
    // Exception: live lists — never SWR-serve potentially day-old cards; block on rebuild.
    if (effectiveAction.swr && current && !opts?.forceRefresh && parsed.kind !== "live") {
      await this.fillCache(request, current, policy.cacheTtlSeconds);
      return ok({
        projection: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
        backgroundRefresh: () =>
          this.rebuildMatchListProjection({
            request,
            key,
            parsed,
            policy,
            meta,
            current,
          }).then(() => undefined),
      });
    }

    try {
      return await this.rebuildMatchListProjection({
        request,
        key,
        parsed,
        policy,
        meta,
        current,
      });
    } finally {
      await this.deps.ids.flush?.();
    }
  }

  private async rebuildMatchListProjection(args: {
    request: Request;
    key: string;
    parsed: NonNullable<ReturnType<typeof parseMatchListProjectionKey>>;
    policy: PolicyPack;
    meta: ObjectMetadata | null;
    current: MatchListProjection | null;
  }): Promise<Result<GetMatchListResult, AppError>> {
    try {
    const { request, key, parsed, policy, meta, current } = args;
    const pKey = projectionKey("match_list", key);
    const nowMs = this.deps.clock.nowMs();
    const owner = createId();
    const projectionId = meta?.objectId ?? createId();
    await this.deps.meta.putJson(
      pKey,
      withLease(meta, "projection", projectionId, owner, nowMs, policy.leaseTtlMs, "table"),
    );

    const listed = await this.listProjectionRows(parsed);
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
        const projection =
          parsed.kind === "live"
            ? sanitizeLiveProjection(current, this.deps.clock.nowMs())
            : current;
        return ok({
          projection,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(listed.error);
    }

    const matchIds: string[] = [];
    const items: MatchListItem[] = [];
    try {
      // Soft ceiling guards Worker CPU/KV on extreme worldwide days; clients use items[].
      const capped = listed.value.slice(0, 800);
      const chunkSize = 32;
      for (let i = 0; i < capped.length; i += chunkSize) {
        const chunk = capped.slice(i, i + chunkSize);
        const built = await Promise.all(
          chunk.map(async (row) => {
            // Id-only fallback (fake/tests): resolve match UUID, skip card warm.
            if (row.leagueExternalId === "0") {
              const matchId = await this.ensureExternal("match", row.matchExternalId);
              if (!matchId.ok) throw matchId.error;
              return { matchId: matchId.value, item: null as MatchListItem | null };
            }
            const ids = await this.resolveListRowIds(row);
            if (!ids.ok) throw ids.error;
            const { matchId, competitionId, homeTeamId, awayTeamId } = ids.value;
            // Skip R2 stub warm on list refresh — card fields live on the projection item.
            // Detail routes hydrate snapshots on demand; cron warms featured leagues.
            const item: MatchListItem = {
              matchId,
              competitionId,
              homeTeamId,
              awayTeamId,
              kickoffAt: row.kickoffAt,
              phase: row.phase,
              status: row.status,
              score: row.score,
              minute: row.minute,
              homeName: row.homeName,
              awayName: row.awayName,
              homeLogoUrl: row.homeLogoUrl,
              awayLogoUrl: row.awayLogoUrl,
              competitionName: row.leagueName,
              competitionLogoUrl: row.leagueLogoUrl,
              externalId: row.matchExternalId,
              homeExternalId: row.homeTeamExternalId,
              awayExternalId: row.awayTeamExternalId,
              competitionExternalId: row.leagueExternalId,
            };
            return { matchId, item };
          }),
        );
        for (const row of built) {
          matchIds.push(row.matchId);
          if (row.item) items.push(row.item);
        }

        // Featured leagues first so clients don't rely solely on local sort.
        const featured = FEATURED_LEAGUE_EXTERNAL_IDS as readonly string[];
        const demoted = (name?: string | null) => {
          const n = (name ?? "").toLowerCase();
          return (
            n.includes("friendly") ||
            n.includes("friendlies") ||
            n.includes("amistoso") ||
            n.includes("amistosos")
          );
        };
        items.sort((a, b) => {
          const aDemoted = demoted(a.competitionName);
          const bDemoted = demoted(b.competitionName);
          if (aDemoted !== bDemoted) return aDemoted ? 1 : -1;
          const ai = a.competitionExternalId
            ? featured.indexOf(a.competitionExternalId)
            : -1;
          const bi = b.competitionExternalId
            ? featured.indexOf(b.competitionExternalId)
            : -1;
          const ar = ai >= 0 ? ai : featured.length + 1;
          const br = bi >= 0 ? bi : featured.length + 1;
          if (ar !== br) return ar - br;
          return Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt);
        });
        matchIds.length = 0;
        matchIds.push(...items.map((i) => i.matchId));
      }

      // Live: drop absurd leftovers (finished games stuck as live from a bad snapshot).
      if (parsed.kind === "live") {
        const now = this.deps.clock.nowMs();
        const kept: MatchListItem[] = [];
        const keptIds: string[] = [];
        for (const item of items) {
          if (!isPlausibleLiveListItem(item, now)) continue;
          kept.push(item);
          keptIds.push(item.matchId);
        }
        items.length = 0;
        items.push(...kept);
        matchIds.length = 0;
        matchIds.push(...keptIds);
      }
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause) {
        return err(cause as AppError);
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Failed to resolve match ids for projection", { cause: message }));
    }

    const hash = await sha256Hex(stableStringify({ key, matchIds, items }));
    const same = meta?.contentHash === hash;
    const nextGeneration = same ? (meta?.generation ?? 1) : (meta?.generation ?? 0) + 1;
    const r2Key =
      same && meta?.r2Key ? meta.r2Key : objectKey("projection", projectionId, nextGeneration);
    if (!same) {
      await putMatchListProjection(this.deps.objects, this.deps.meta, {
        projectionId,
        key,
        matchIds,
        items,
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
      ...(items.length > 0 ? { items } : {}),
    };
    await this.fillCache(request, projection, policy.cacheTtlSeconds);
    return ok({
      projection,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: policy.cacheTtlSeconds,
    });
    } finally {
      await this.deps.ids.flush?.();
    }
  }

  async getMatchEvents(
    request: Request,
    matchId: string,
  ): Promise<Result<GetMatchEventsResult, AppError>> {
    const loaded = await this.getMatch(request, matchId);
    if (!loaded.ok) return loaded;
    const isLive = loaded.value.match.phase === "live";
    // Live matches always re-fetch events; finished/future can reuse snapshot.
    if (
      (!isLive && loaded.value.match.events.length > 0) ||
      !this.deps.provider.getMatchEvents
    ) {
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
    if (!events.ok) {
      // Soft-serve snapshot events (or empty) instead of 502 — clients otherwise
      // hammer retries and burn the rest of the quota while live list stays healthy.
      const cached = loaded.value.match.events;
      return ok({
        matchId,
        events: cached,
        cacheHit: true,
        refreshed: false,
        cacheTtlSeconds: Math.min(15, loaded.value.cacheTtlSeconds || 5),
      });
    }
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
    const matchLoaded = await this.getMatch(request, matchId);
    if (!matchLoaded.ok) return matchLoaded;
    const externalId = this.deps.ids.toExternal
      ? await this.deps.ids.toExternal(matchId)
      : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for match", { id: matchId }));
    }
    // Prefixed external key avoids colliding with other "statistics" objects and
    // bypasses any corrupt R2 blobs previously stored under the bare fixture id.
    const statsId = await this.ensureExternal("statistics", `matchstats:${externalId}`);
    if (!statsId.ok) return statsId;
    const result = await this.loadStaticResource({
      request,
      internalId: statsId.value,
      objectType: "statistics",
      schema: matchStatisticsSchema,
      freshnessClass: "table",
      label: "Match statistics",
      matchPhase: matchLoaded.value.match.phase,
      // Always pass the fixture id upstream — not the prefixed statistics key.
      fetch: (id, _ext) => this.deps.provider.getMatchStatistics!(id, matchId, externalId),
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

  /**
   * Live text search — not R2-persisted. Binds UUIDs for each hit so clients can
   * navigate with internal ids immediately.
   */
  async search(
    request: Request,
    query: string,
  ): Promise<Result<GetSearchResult, AppError>> {
    const q = query.trim();
    if (q.length < 3) {
      return err(validationError("Search query must be at least 3 characters", { query: q }));
    }
    if (!this.deps.provider.search) {
      return err(notFoundError("Search provider not implemented"));
    }

    const cached = await this.deps.cache.match(request);
    if (cached) {
      const search = parseCanonical(searchResultSchema, await cached.json());
      return ok({
        search,
        cacheHit: true,
        refreshed: false,
        cacheTtlSeconds: 300,
      });
    }

    const listed = await this.deps.provider.search(q);
    const providerQuota = this.deps.provider.getQuota?.();
    if (providerQuota) {
      await this.deps.meta.putJson(quotaKey(this.deps.provider.name), providerQuota);
    }
    if (!listed.ok) return listed;

    const results = [];
    for (const hit of listed.value) {
      const externalType =
        hit.type === "competition" ? "competition" : hit.type === "team" ? "team" : "player";
      const id = await this.ensureExternal(externalType, hit.externalId);
      if (!id.ok) continue;
      results.push({
        type: hit.type,
        id: id.value,
        externalId: hit.externalId,
        displayName: hit.displayName,
        ...(hit.logoUrl ? { logoUrl: hit.logoUrl } : {}),
      });
    }

    const search = parseCanonical(searchResultSchema, {
      schemaVersion: 1,
      id: createId(),
      query: q,
      results,
    });

    await this.fillCache(request, search, 300);
    return ok({
      search,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: 300,
    });
  }

  private async listProjectionRows(
    parsed:
      | { kind: "date"; date: string }
      | { kind: "league"; leagueId: string; seasonYear: string }
      | { kind: "team"; teamId: string; seasonYear: string }
      | { kind: "live" },
  ): Promise<Result<ProviderMatchListRow[], AppError>> {
    if (parsed.kind === "date") {
      if (this.deps.provider.listMatchRowsByDate) {
        return this.deps.provider.listMatchRowsByDate(parsed.date);
      }
      if (!this.deps.provider.listMatchExternalIdsByDate) {
        return err(notFoundError("Match list provider not implemented"));
      }
      const ids = await this.deps.provider.listMatchExternalIdsByDate(parsed.date);
      if (!ids.ok) return ids;
      return ok(ids.value.map((matchExternalId) => this.stubRow(matchExternalId)));
    }
    if (parsed.kind === "league") {
      if (this.deps.provider.listMatchRowsByLeagueSeason) {
        return this.deps.provider.listMatchRowsByLeagueSeason(
          parsed.leagueId,
          parsed.seasonYear,
        );
      }
      if (!this.deps.provider.listMatchExternalIdsByLeagueSeason) {
        return err(notFoundError("League match list provider not implemented"));
      }
      const ids = await this.deps.provider.listMatchExternalIdsByLeagueSeason(
        parsed.leagueId,
        parsed.seasonYear,
      );
      if (!ids.ok) return ids;
      return ok(ids.value.map((matchExternalId) => this.stubRow(matchExternalId)));
    }
    if (parsed.kind === "team") {
      if (this.deps.provider.listMatchRowsByTeamSeason) {
        return this.deps.provider.listMatchRowsByTeamSeason(
          parsed.teamId,
          parsed.seasonYear,
        );
      }
      if (!this.deps.provider.listMatchExternalIdsByTeamSeason) {
        return err(notFoundError("Team match list provider not implemented"));
      }
      const ids = await this.deps.provider.listMatchExternalIdsByTeamSeason(
        parsed.teamId,
        parsed.seasonYear,
      );
      if (!ids.ok) return ids;
      return ok(ids.value.map((matchExternalId) => this.stubRow(matchExternalId)));
    }
    if (this.deps.provider.listLiveMatchRows) {
      return this.deps.provider.listLiveMatchRows();
    }
    if (!this.deps.provider.listLiveMatchExternalIds) {
      return err(notFoundError("Live match list provider not implemented"));
    }
    const ids = await this.deps.provider.listLiveMatchExternalIds();
    if (!ids.ok) return ids;
    return ok(ids.value.map((matchExternalId) => this.stubRow(matchExternalId)));
  }

  private stubRow(matchExternalId: string): ProviderMatchListRow {
    return {
      matchExternalId,
      leagueExternalId: "0",
      homeTeamExternalId: "0",
      awayTeamExternalId: "0",
      seasonYear: new Date().getUTCFullYear(),
      kickoffAt: new Date(0).toISOString(),
      phase: "future",
      status: "NS",
      homeName: "Home",
      awayName: "Away",
      leagueName: "Competition",
    };
  }

  private async resolveListRowIds(row: ProviderMatchListRow): Promise<
    Result<
      {
        matchId: string;
        competitionId: string;
        homeTeamId: string;
        awayTeamId: string;
        seasonId: string;
      },
      AppError
    >
  > {
    const [matchId, competitionId, homeTeamId, awayTeamId, seasonId] = await Promise.all([
      this.ensureExternal("match", row.matchExternalId),
      this.ensureExternal("competition", row.leagueExternalId),
      this.ensureExternal("team", row.homeTeamExternalId),
      this.ensureExternal("team", row.awayTeamExternalId),
      this.ensureExternal("season", `${row.leagueExternalId}:${row.seasonYear}`),
    ]);
    if (!matchId.ok) return matchId;
    if (!competitionId.ok) return competitionId;
    if (!homeTeamId.ok) return homeTeamId;
    if (!awayTeamId.ok) return awayTeamId;
    if (!seasonId.ok) return seasonId;
    return ok({
      matchId: matchId.value,
      competitionId: competitionId.value,
      homeTeamId: homeTeamId.value,
      awayTeamId: awayTeamId.value,
      seasonId: seasonId.value,
    });
  }

  /** Best-effort team card cache — never overwrites a richer existing document. */
  private async persistTeamStub(
    teamId: string,
    name: string,
    logoUrl?: string,
  ): Promise<void> {
    if (teamId.length < 8) return;
    const tKey = metaKey("team", teamId);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(tKey);
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        try {
          const existing = parseCanonical(
            teamSchema,
            JSON.parse(textDecoder.decode(bytes)),
          );
          if (existing.logoUrl || !logoUrl) return;
        } catch {
          /* replace below */
        }
      }
    }
    const team: Team = {
      schemaVersion: 1,
      id: teamId,
      name,
      ...(logoUrl ? { logoUrl } : {}),
    };
    const generation = (meta?.generation ?? 0) + 1;
    const r2Key = objectKey("team", teamId, generation);
    await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(team)));
    const nowMs = this.deps.clock.nowMs();
    const policy = staticPolicy();
    await this.deps.meta.putJson(
      tKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "team",
        objectId: teamId,
        freshnessClass: "static",
        r2Key,
        generation,
        contentHash: await sha256Hex(stableStringify(team)),
        nowMs,
        policy,
      }),
    );
  }

  private async persistCompetitionStub(
    competitionId: string,
    name: string,
    logoUrl?: string,
  ): Promise<void> {
    if (competitionId.length < 8) return;
    const cKey = metaKey("competition", competitionId);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(cKey);
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        try {
          const existing = parseCanonical(
            competitionSchema,
            JSON.parse(textDecoder.decode(bytes)),
          );
          if (existing.logoUrl || !logoUrl) return;
        } catch {
          /* replace below */
        }
      }
    }
    const competition: Competition = {
      schemaVersion: 1,
      id: competitionId,
      name,
      format: "league",
      isLeague: true,
      ...(logoUrl ? { logoUrl } : {}),
    };
    const generation = (meta?.generation ?? 0) + 1;
    const r2Key = objectKey("competition", competitionId, generation);
    await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(competition)));
    const nowMs = this.deps.clock.nowMs();
    const policy = staticPolicy();
    await this.deps.meta.putJson(
      cKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "competition",
        objectId: competitionId,
        freshnessClass: "static",
        r2Key,
        generation,
        contentHash: await sha256Hex(stableStringify(competition)),
        nowMs,
        policy,
      }),
    );
  }

  private async persistMatchSnapshot(matchId: string, match: Match): Promise<void> {
    const mKey = metaKey("match", matchId);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    // Finished / historical are frozen forever — cron/date lists must not rewrite them.
    if (meta?.phase === "finished" || meta?.phase === "historical") {
      return;
    }
    // List-row warmups often omit events/lineups — keep richer snapshot fields.
    let next = match;
    if (meta?.r2Key && (match.events.length === 0 || match.lineups.length === 0)) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        const prev = parseCanonical(matchSchema, JSON.parse(textDecoder.decode(bytes)));
        next = {
          ...match,
          venueId: match.venueId ?? prev.venueId,
          events: match.events.length > 0 ? match.events : prev.events,
          lineups: match.lineups.length > 0 ? match.lineups : prev.lineups,
        };
      }
    }
    const generation = (meta?.generation ?? 0) + 1;
    const r2Key = objectKey("match", matchId, generation);
    await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(next)));
    const hash = await sha256Hex(stableStringify(next));
    const nowMs = this.deps.clock.nowMs();
    const policy = policyFor("match", next.phase, nowMs, {
      kickoffAtMs: Date.parse(next.kickoffAt),
    });
    await this.deps.meta.putJson(
      mKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "match",
        objectId: matchId,
        phase: next.phase,
        freshnessClass:
          next.phase === "live"
            ? "live"
            : next.phase === "future"
              ? "edition"
              : next.phase === "finished" || next.phase === "historical"
                ? "static"
                : "table",
        r2Key,
        generation,
        contentHash: hash,
        nowMs,
        policy,
      }),
    );
    await this.deps.ids.flush?.();
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
    /** When set, align sub-resource TTL with parent match phase (live=5s, finished=forever). */
    matchPhase?: Match["phase"];
    fetch: (internalId: string, externalId: string) => Promise<Result<T, AppError>>;
  }): Promise<Result<ResourceResult<T>, AppError>> {
    const nowMs = this.deps.clock.nowMs();
    const policy =
      args.matchPhase === "live"
        ? liveListPolicy()
        : args.matchPhase === "finished" || args.matchPhase === "historical"
          ? tablePolicy(false)
          : policyFor(args.objectType, undefined, nowMs, {
              racing: args.freshnessClass === "table",
            });

    // Live match sub-resources must not be served from a longer pre-match edge cache.
    const cached =
      args.matchPhase === "live" ? undefined : await this.deps.cache.match(args.request);
    if (cached) {
      try {
        const data = parseCanonical(args.schema, await cached.json());
        const missingLogo =
          (args.objectType === "team" || args.objectType === "competition") &&
          !(data as { logoUrl?: string }).logoUrl;
        const missingLeaderNames =
          args.objectType === "leaders" && leadersNeedDisplayNames(data);
        if (!missingLogo && !missingLeaderNames) {
          return ok({
            data,
            cacheHit: true,
            refreshed: false,
            cacheTtlSeconds: policy.cacheTtlSeconds,
          });
        }
      } catch {
        // Stale/corrupt edge cache — fall through to R2 / refresh.
      }
    }

    const mKey = metaKey(args.objectType, args.internalId);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    let current: T | null = null;
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        try {
          current = parseCanonical(args.schema, JSON.parse(textDecoder.decode(bytes)));
        } catch {
          current = null;
        }
      }
    }
    const quota = await this.deps.meta.getJson<QuotaSnapshot>(quotaKey(this.deps.provider.name));
    const action = decide({
      meta,
      nowMs,
      policy,
      hasServableObject: current !== null,
      quotaAvailable: isQuotaAvailable(quota),
    });
    let effectiveAction =
      current === null && (action.type === "error" || action.type === "wait")
        ? { type: "refresh" as const, swr: false, acquireLease: true }
        : action;

    const missingLogo =
      current != null &&
      (args.objectType === "team" || args.objectType === "competition") &&
      !(current as { logoUrl?: string }).logoUrl &&
      isQuotaAvailable(quota);
    const missingLeaderNames =
      current != null &&
      args.objectType === "leaders" &&
      leadersNeedDisplayNames(current) &&
      isQuotaAvailable(quota);
    if (
      (missingLogo || missingLeaderNames) &&
      (effectiveAction.type === "serve" || effectiveAction.type === "wait")
    ) {
      effectiveAction = { type: "refresh", swr: false, acquireLease: true };
    }

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
        const coerced = coerceStaleLiveMatch(current, this.deps.clock.nowMs());
        return ok({
          match: coerced,
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
        const coerced = coerceStaleLiveMatch(current, this.deps.clock.nowMs());
        return ok({
          match: coerced,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(result.error);
    }

    const match = coerceStaleLiveMatch(result.value, this.deps.clock.nowMs());
    // Policy must follow the *refreshed* phase (future→live must become 5s, not 5h).
    const refreshedAt = this.deps.clock.nowMs();
    const nextPolicy = policyFor("match", match.phase, refreshedAt, {
      kickoffAtMs: Date.parse(match.kickoffAt),
    });
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
        nowMs: refreshedAt,
        policy: nextPolicy,
      }),
    );
    await this.fillCache(request, match, nextPolicy.cacheTtlSeconds);
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
      cacheTtlSeconds: nextPolicy.cacheTtlSeconds,
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

  /** Rewrite pathname so Cache API keys stay on the canonical resource URL. */
  private resourceCacheRequest(request: Request, pathname: string): Request {
    const url = new URL(request.url);
    url.pathname = pathname;
    url.search = "";
    return new Request(url.toString(), { method: "GET", headers: request.headers });
  }
}

function isQuotaAvailable(quota: QuotaSnapshot | null): boolean {
  if (!quota) return true;
  if (quota.dailyRemaining !== undefined && quota.dailyRemaining <= 0) return false;
  if (quota.minuteRemaining !== undefined && quota.minuteRemaining <= 0) return false;
  return true;
}

/** Kickoff window for a still-live fixture (pre-kick buffer + FT/ET/pens). */
const LIVE_KICKOFF_MAX_AGE_MS = 5 * 60 * 60 * 1000;
const LIVE_KICKOFF_FUTURE_SLACK_MS = 15 * 60 * 1000;

function isPlausibleLiveListItem(
  item: Pick<MatchListItem, "phase" | "kickoffAt">,
  nowMs: number,
): boolean {
  if (item.phase !== "live") return false;
  const kickoffMs = Date.parse(item.kickoffAt);
  if (Number.isNaN(kickoffMs)) return false;
  const age = nowMs - kickoffMs;
  return age >= -LIVE_KICKOFF_FUTURE_SLACK_MS && age <= LIVE_KICKOFF_MAX_AGE_MS;
}

/** Coerce stuck live match snapshots past the plausible window to finished. */
function coerceStaleLiveMatch(match: Match, nowMs: number): Match {
  if (match.phase !== "live") return match;
  if (isPlausibleLiveListItem(match, nowMs)) return match;
  const raw = match.status.toUpperCase();
  const finishedStatus =
    raw === "P" || raw === "PEN" || raw.includes("PEN")
      ? "PEN"
      : raw === "ET" || raw === "BT" || raw === "AET"
        ? "AET"
        : "FT";
  return {
    ...match,
    phase: "finished",
    status: finishedStatus,
    minute:
      match.minute ??
      (finishedStatus === "PEN" || finishedStatus === "AET" ? 120 : 90),
  };
}

function sanitizeLiveProjection(
  projection: MatchListProjection,
  nowMs: number,
): MatchListProjection {
  const items = (projection.items ?? []).filter((item) =>
    isPlausibleLiveListItem(item, nowMs),
  );
  const matchIds = items.map((i) => i.matchId);
  return { ...projection, items, matchIds };
}

/** YYYY-MM-DD in the fixture timezone (not UTC). */
function calendarDateInTz(nowMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
}

function matchEventsNeedDisplayNames(match: Match): boolean {
  return match.events.some(
    (e) =>
      (e.playerId != null && !e.playerName) ||
      (e.assistPlayerId != null && !e.assistPlayerName) ||
      (e.teamId != null && !e.teamName),
  );
}

function leadersNeedDisplayNames(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const rows = (data as { rows?: Array<{ playerName?: string }> }).rows;
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((r) => !r.playerName);
}
