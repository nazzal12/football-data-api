import type { ObjectType } from "./constants.js";

export type ControlState = "absent" | "fresh" | "stale" | "refreshing" | "failed";

export type ObjectMetadata = {
  objectType: ObjectType;
  objectId: string;
  phase?: string;
  freshnessClass: string;
  controlState: ControlState;
  r2Key?: string;
  generation?: number;
  contentHash?: string;
  softExpireAt?: number;
  hardExpireAt?: number;
  lastRefreshedAt?: number;
  lastObservedAt?: number;
  leaseOwner?: string;
  leaseExpireAt?: number;
  nextRefreshEarliestAt?: number;
  failureCount?: number;
  lastErrorClass?: string;
  retryAfterAt?: number;
  publicVersion?: string;
};
