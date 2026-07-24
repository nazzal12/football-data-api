import type { AppError, Clock, Logger, Result } from "@football-api/core";
import { createId, err, notFoundError, ok, sha256Hex, stableStringify } from "@football-api/core";
import { metaKey, objectKey, quotaKey } from "@football-api/core";
import type { Match, Team } from "@football-api/domain";
import { matchSchema, parseCanonical, teamSchema } from "@football-api/domain";
import {
  applyFailedRefresh,
  applySuccessfulRefresh,
  decide,
  policyFor,
  withLease,
} from "@football-api/lifecycle";
import type { FootballProvider, IdBridge, QuotaSnapshot } from "@football-api/provider";
import type { HttpCache, MetaStore, ObjectMetadata, ObjectStore } from "@football-api/storage";

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

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  /** Resolve or create internal id for an upstream match, then load via normal path. */
  async getMatchByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetMatchResult, AppError>> {
    let internalId = await this.deps.ids.toInternal({
      provider: this.deps.provider.name,
      externalType: "match",
      externalId,
    });
    if (!internalId) {
      if (!this.deps.ids.ensure) {
        return err(notFoundError("No id mapping and ensure() unavailable", { externalId }));
      }
      internalId = await this.deps.ids.ensure("match", externalId);
    }
    return this.getMatch(request, internalId);
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
    const quotaAvailable = isQuotaAvailable(quota);

    const action = decide({
      meta,
      nowMs,
      policy,
      hasServableObject: current !== null,
      quotaAvailable,
    });

    if (action.type === "serve" && current) {
      if (action.fillCache) {
        await this.fillCache(request, current, policy.cacheTtlSeconds);
      }
      return ok({
        match: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if (action.type === "error") {
      if (current) {
        return ok({
          match: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(notFoundError("Match unavailable", { reason: action.reason, id: internalId }));
    }

    if (action.type === "wait") {
      if (action.swr && current) {
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
      if (current) {
        return ok({
          match: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(notFoundError("Match refresh in progress", { id: internalId }));
    }

    return this.refreshMatch(request, internalId, meta, current, policy, nowMs, mKey);
  }

  async getTeam(request: Request, internalId: string): Promise<Result<GetTeamResult, AppError>> {
    const cached = await this.deps.cache.match(request);
    if (cached) {
      const body = await cached.json();
      return ok({
        team: parseCanonical(teamSchema, body),
        cacheHit: true,
        refreshed: false,
        cacheTtlSeconds: 0,
      });
    }

    if (!this.deps.provider.getTeam) {
      return err(notFoundError("Team provider not implemented"));
    }

    const mKey = metaKey("team", internalId);
    const meta = await this.deps.meta.getJson<ObjectMetadata>(mKey);
    let current: Team | null = null;
    if (meta?.r2Key) {
      const bytes = await this.deps.objects.get(meta.r2Key);
      if (bytes) {
        current = parseCanonical(teamSchema, JSON.parse(textDecoder.decode(bytes)));
      }
    }

    const nowMs = this.deps.clock.nowMs();
    const policy = policyFor("team", undefined, nowMs);
    const quota = await this.deps.meta.getJson<QuotaSnapshot>(quotaKey(this.deps.provider.name));
    const action = decide({
      meta,
      nowMs,
      policy,
      hasServableObject: current !== null,
      quotaAvailable: isQuotaAvailable(quota),
    });

    // Cold miss must retry even if a previous attempt left failed/backoff metadata.
    const effectiveAction =
      current === null && action.type === "error" ? { type: "refresh" as const, swr: false, acquireLease: true } : action;

    if (effectiveAction.type === "serve" && current) {
      if (effectiveAction.fillCache) await this.fillCache(request, current, policy.cacheTtlSeconds);
      return ok({
        team: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if ((effectiveAction.type === "error" || effectiveAction.type === "wait") && current) {
      return ok({
        team: current,
        cacheHit: false,
        refreshed: false,
        cacheTtlSeconds: policy.cacheTtlSeconds,
      });
    }

    if (effectiveAction.type !== "refresh") {
      return err(notFoundError("Team unavailable", { id: internalId }));
    }

    const owner = createId();
    await this.deps.meta.putJson(
      mKey,
      withLease(meta, "team", internalId, owner, nowMs, policy.leaseTtlMs, "static"),
    );

    const externalId = this.deps.ids.toExternal ? await this.deps.ids.toExternal(internalId) : null;
    if (!externalId) {
      return err(notFoundError("No external id mapping for team", { id: internalId }));
    }

    const result = await this.deps.provider.getTeam(internalId, externalId);
    const providerQuota = this.deps.provider.getQuota?.();
    if (providerQuota) {
      await this.deps.meta.putJson(quotaKey(this.deps.provider.name), providerQuota);
    }
    if (!result.ok) {
      await this.deps.meta.putJson(
        mKey,
        applyFailedRefresh({
          previous: meta,
          objectType: "team",
          objectId: internalId,
          nowMs: this.deps.clock.nowMs(),
          errorClass: result.error.code,
          backoffMs: 30_000,
        }),
      );
      if (current) {
        return ok({
          team: current,
          cacheHit: false,
          refreshed: false,
          cacheTtlSeconds: policy.cacheTtlSeconds,
        });
      }
      return err(result.error);
    }

    const team = result.value;
    const hash = await sha256Hex(stableStringify(team));
    const same = meta?.contentHash === hash;
    const nextGeneration = same ? (meta?.generation ?? 1) : (meta?.generation ?? 0) + 1;
    const r2Key = same && meta?.r2Key ? meta.r2Key : objectKey("team", internalId, nextGeneration);
    if (!same) {
      await this.deps.objects.put(r2Key, textEncoder.encode(JSON.stringify(team)));
    }
    await this.deps.meta.putJson(
      mKey,
      applySuccessfulRefresh({
        previous: meta,
        objectType: "team",
        objectId: internalId,
        freshnessClass: "static",
        r2Key,
        generation: nextGeneration,
        contentHash: hash,
        nowMs: this.deps.clock.nowMs(),
        policy,
      }),
    );
    await this.fillCache(request, team, policy.cacheTtlSeconds);
    return ok({
      team,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: policy.cacheTtlSeconds,
    });
  }

  async getTeamByExternal(
    request: Request,
    externalId: string,
  ): Promise<Result<GetTeamResult, AppError>> {
    let internalId = await this.deps.ids.toInternal({
      provider: this.deps.provider.name,
      externalType: "team",
      externalId,
    });
    if (!internalId) {
      if (!this.deps.ids.ensure) {
        return err(notFoundError("No id mapping and ensure() unavailable", { externalId }));
      }
      internalId = await this.deps.ids.ensure("team", externalId);
    }
    return this.getTeam(request, internalId);
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
      const failed = applyFailedRefresh({
        previous: meta,
        objectType: "match",
        objectId: internalId,
        nowMs,
        errorClass: "NOT_FOUND",
        backoffMs: 30_000,
      });
      await this.deps.meta.putJson(mKey, failed);
      return err(notFoundError("No external id mapping for match", { id: internalId }));
    }

    const result = await this.deps.provider.getMatch(internalId, externalId);
    const providerQuota = this.deps.provider.getQuota?.();
    if (providerQuota) {
      await this.deps.meta.putJson(quotaKey(this.deps.provider.name), providerQuota);
    }

    if (!result.ok) {
      const failed = applyFailedRefresh({
        previous: meta,
        objectType: "match",
        objectId: internalId,
        nowMs: this.deps.clock.nowMs(),
        errorClass: result.error.code,
        backoffMs: 30_000,
      });
      await this.deps.meta.putJson(mKey, failed);
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

    const freshMeta = applySuccessfulRefresh({
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
    });
    await this.deps.meta.putJson(mKey, freshMeta);
    await this.fillCache(request, match, policy.cacheTtlSeconds);

    this.deps.logger.info("match.refresh.success", {
      id: internalId,
      phase: match.phase,
      noop: same,
      generation: freshMeta.generation,
    });

    return ok({
      match,
      cacheHit: false,
      refreshed: true,
      cacheTtlSeconds: policy.cacheTtlSeconds,
    });
  }

  private async fillCache(request: Request, body: Match | Team, ttlSeconds: number): Promise<void> {
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
