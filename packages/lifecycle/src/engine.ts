import type { ControlState, FreshnessClass, ObjectMetadata, ObjectType } from "@football-api/core";
import { MS } from "@football-api/core";
import type { MatchPhase } from "@football-api/domain";

export type RefreshAction =
  | { type: "serve"; from: "r2"; fillCache: boolean }
  | { type: "refresh"; swr: boolean; acquireLease: boolean }
  | { type: "wait"; swr: boolean }
  | { type: "error"; reason: "hard_expired" | "failed_backoff" | "quota" | "absent_unrecoverable" };

export type PolicyPack = {
  softTtlMs: number;
  hardTtlMs: number | null;
  minRefreshIntervalMs: number;
  leaseTtlMs: number;
  swrAllowed: boolean;
  cacheTtlSeconds: number;
};

export function matchPolicy(phase: MatchPhase, nowMs: number, kickoffAtMs?: number): PolicyPack {
  switch (phase) {
    case "live":
      // User-driven only — 5s freshness; no cron. No request ⇒ no refresh.
      return {
        softTtlMs: 5 * MS.SECOND,
        hardTtlMs: 30 * MS.SECOND,
        minRefreshIntervalMs: 5 * MS.SECOND,
        leaseTtlMs: 4 * MS.SECOND,
        swrAllowed: true,
        cacheTtlSeconds: 5,
      };
    case "finished":
    case "historical":
      // Terminal — keep forever; never refresh after the finished snapshot is stored.
      return {
        softTtlMs: 365 * MS.DAY,
        hardTtlMs: null,
        minRefreshIntervalMs: MS.DAY,
        leaseTtlMs: 30 * MS.SECOND,
        swrAllowed: true,
        cacheTtlSeconds: 86_400,
      };
    case "future": {
      // Soft-expire at kickoff so the next user request flips into live data
      // (not the stale pre-match cron snapshot).
      let softTtlMs = 5 * MS.HOUR;
      if (kickoffAtMs !== undefined) {
        const until = kickoffAtMs - nowMs;
        softTtlMs = until <= 0 ? 0 : Math.min(softTtlMs, until);
      }
      return {
        softTtlMs,
        hardTtlMs: MS.DAY,
        minRefreshIntervalMs: MS.MINUTE,
        leaseTtlMs: 20 * MS.SECOND,
        swrAllowed: true,
        cacheTtlSeconds: Math.max(1, Math.min(300, Math.floor(softTtlMs / 1000) || 1)),
      };
    }
  }
}

/** Live match-list projection — short Cache-Control; never warmed by cron. */
export function liveListPolicy(): PolicyPack {
  return {
    softTtlMs: 5 * MS.SECOND,
    hardTtlMs: 30 * MS.SECOND,
    minRefreshIntervalMs: 5 * MS.SECOND,
    leaseTtlMs: 4 * MS.SECOND,
    swrAllowed: true,
    cacheTtlSeconds: 5,
  };
}

/**
 * Today/tomorrow date lists — refresh every 5 minutes so cards track
 * kickoff → live → finished. Past dates stay immutable.
 */
export function dateListPolicy(racing: boolean): PolicyPack {
  if (!racing) return tablePolicy(false);
  return {
    softTtlMs: 5 * MS.MINUTE,
    hardTtlMs: 30 * MS.MINUTE,
    minRefreshIntervalMs: 30 * MS.SECOND,
    leaseTtlMs: 20 * MS.SECOND,
    swrAllowed: true,
    cacheTtlSeconds: 60,
  };
}

export function staticPolicy(): PolicyPack {
  return {
    softTtlMs: 7 * MS.DAY,
    hardTtlMs: null,
    minRefreshIntervalMs: MS.HOUR,
    leaseTtlMs: 30 * MS.SECOND,
    swrAllowed: true,
    cacheTtlSeconds: 86_400,
  };
}

export function tablePolicy(racing: boolean): PolicyPack {
  return racing
    ? {
        // Align with 5-hour catalog/date cron cadence.
        softTtlMs: 5 * MS.HOUR,
        hardTtlMs: 24 * MS.HOUR,
        minRefreshIntervalMs: 5 * MS.MINUTE,
        leaseTtlMs: 30 * MS.SECOND,
        swrAllowed: true,
        cacheTtlSeconds: 300,
      }
    : {
        softTtlMs: 365 * MS.DAY,
        hardTtlMs: null,
        minRefreshIntervalMs: MS.DAY,
        leaseTtlMs: 30 * MS.SECOND,
        swrAllowed: true,
        cacheTtlSeconds: 86_400,
      };
}

export function policyFor(
  objectType: ObjectType,
  phase: string | undefined,
  nowMs: number,
  extras?: { kickoffAtMs?: number; racing?: boolean },
): PolicyPack {
  if (objectType === "match") {
    return matchPolicy((phase as MatchPhase) ?? "future", nowMs, extras?.kickoffAtMs);
  }
  if (
    objectType === "standing" ||
    objectType === "statistics" ||
    objectType === "prediction" ||
    objectType === "odds" ||
    objectType === "injury"
  ) {
    return tablePolicy(extras?.racing ?? true);
  }
  if (objectType === "squad" || objectType === "h2h" || objectType === "leaders" || objectType === "coach") {
    return staticPolicy();
  }
  if (objectType === "transfer" || objectType === "trophy" || objectType === "sidelined") {
    return tablePolicy(extras?.racing ?? false);
  }
  if (objectType === "rounds") {
    return staticPolicy();
  }
  return staticPolicy();
}

export function resolveControlState(meta: ObjectMetadata | null, nowMs: number): ControlState {
  if (!meta) return "absent";
  if (meta.controlState === "refreshing") {
    if (meta.leaseExpireAt !== undefined && nowMs > meta.leaseExpireAt) {
      return meta.r2Key ? "stale" : "absent";
    }
    return "refreshing";
  }
  if (meta.controlState === "failed") return "failed";
  if (meta.softExpireAt !== undefined && nowMs >= meta.softExpireAt) return "stale";
  if (meta.controlState === "stale") return "stale";
  return "fresh";
}

export type DecideInput = {
  meta: ObjectMetadata | null;
  nowMs: number;
  policy: PolicyPack;
  hasServableObject: boolean;
  quotaAvailable: boolean;
};

export function decide(input: DecideInput): RefreshAction {
  const { meta, nowMs, policy, hasServableObject, quotaAvailable } = input;
  const state = resolveControlState(meta, nowMs);

  // Finished / historical matches are immutable once stored — never refresh.
  if (
    hasServableObject &&
    meta?.objectType === "match" &&
    (meta.phase === "finished" || meta.phase === "historical")
  ) {
    return { type: "serve", from: "r2", fillCache: true };
  }

  if (state === "fresh" && hasServableObject) {
    return { type: "serve", from: "r2", fillCache: true };
  }

  if (state === "refreshing") {
    return { type: "wait", swr: policy.swrAllowed && hasServableObject };
  }

  if (state === "failed") {
    if (meta?.retryAfterAt !== undefined && nowMs < meta.retryAfterAt) {
      if (hasServableObject && policy.swrAllowed) {
        return { type: "serve", from: "r2", fillCache: false };
      }
      return { type: "error", reason: "failed_backoff" };
    }
  }

  const hardExpired =
    policy.hardTtlMs !== null &&
    meta?.hardExpireAt !== undefined &&
    nowMs >= meta.hardExpireAt &&
    !hasServableObject;

  if (hardExpired) {
    return { type: "error", reason: "hard_expired" };
  }

  if (!quotaAvailable && hasServableObject && policy.swrAllowed) {
    return { type: "serve", from: "r2", fillCache: true };
  }

  if (!quotaAvailable && !hasServableObject) {
    return { type: "error", reason: "quota" };
  }

  if (
    meta?.nextRefreshEarliestAt !== undefined &&
    nowMs < meta.nextRefreshEarliestAt &&
    hasServableObject
  ) {
    return { type: "serve", from: "r2", fillCache: true };
  }

  if (state === "absent" && !hasServableObject) {
    return { type: "refresh", swr: false, acquireLease: true };
  }

  return {
    type: "refresh",
    swr: policy.swrAllowed && hasServableObject,
    acquireLease: true,
  };
}

export function applySuccessfulRefresh(args: {
  previous: ObjectMetadata | null;
  objectType: ObjectType;
  objectId: string;
  phase?: string;
  freshnessClass: FreshnessClass;
  r2Key: string;
  generation: number;
  contentHash: string;
  nowMs: number;
  policy: PolicyPack;
}): ObjectMetadata {
  return {
    objectType: args.objectType,
    objectId: args.objectId,
    phase: args.phase,
    freshnessClass: args.freshnessClass,
    controlState: "fresh",
    r2Key: args.r2Key,
    generation: args.generation,
    contentHash: args.contentHash,
    softExpireAt: args.nowMs + args.policy.softTtlMs,
    hardExpireAt: args.policy.hardTtlMs === null ? undefined : args.nowMs + args.policy.hardTtlMs,
    lastRefreshedAt: args.nowMs,
    lastObservedAt: args.nowMs,
    nextRefreshEarliestAt: args.nowMs + args.policy.minRefreshIntervalMs,
    failureCount: 0,
    leaseOwner: undefined,
    leaseExpireAt: undefined,
    lastErrorClass: undefined,
    retryAfterAt: undefined,
    publicVersion: String(args.generation),
  };
}

export function applyFailedRefresh(args: {
  previous: ObjectMetadata | null;
  objectType: ObjectType;
  objectId: string;
  nowMs: number;
  errorClass: string;
  backoffMs: number;
}): ObjectMetadata {
  const failureCount = (args.previous?.failureCount ?? 0) + 1;
  return {
    ...(args.previous ?? {
      objectType: args.objectType,
      objectId: args.objectId,
      freshnessClass: "static",
      controlState: "failed",
    }),
    controlState: "failed",
    failureCount,
    lastErrorClass: args.errorClass,
    retryAfterAt: args.nowMs + args.backoffMs * failureCount,
    leaseOwner: undefined,
    leaseExpireAt: undefined,
  };
}

export function withLease(
  meta: ObjectMetadata | null,
  objectType: ObjectType,
  objectId: string,
  owner: string,
  nowMs: number,
  leaseTtlMs: number,
  freshnessClass: FreshnessClass,
): ObjectMetadata {
  return {
    ...(meta ?? {
      objectType,
      objectId,
      freshnessClass,
      controlState: "refreshing",
    }),
    controlState: "refreshing",
    leaseOwner: owner,
    leaseExpireAt: nowMs + leaseTtlMs,
  };
}
