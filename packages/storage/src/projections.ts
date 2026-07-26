import { objectKey, projectionKey } from "@football-api/core";
import {
  type MatchListItem,
  type MatchListProjection,
  SCHEMA_VERSION,
} from "@football-api/domain";
import type { MetaStore, ObjectStore } from "./ports.js";

/**
 * Projection helpers — list endpoints read these documents instead of N+1 R2 gets.
 */
export function parseMatchListProjectionKey(
  key: string,
):
  | { kind: "date"; date: string }
  | { kind: "league"; leagueId: string; seasonYear: string }
  | { kind: "team"; teamId: string; seasonYear: string }
  | { kind: "live" }
  | null {
  const date = /^date:(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (date?.[1]) return { kind: "date", date: date[1] };
  const league = /^league:(\d+):(\d{4})$/.exec(key);
  if (league?.[1] && league[2]) {
    return { kind: "league", leagueId: league[1], seasonYear: league[2] };
  }
  const team = /^team:(\d+):(\d{4})$/.exec(key);
  if (team?.[1] && team[2]) {
    return { kind: "team", teamId: team[1], seasonYear: team[2] };
  }
  if (key === "live") return { kind: "live" };
  return null;
}

export async function putMatchListProjection(
  objects: ObjectStore,
  meta: MetaStore,
  args: {
    projectionId: string;
    key: string;
    matchIds: string[];
    items?: MatchListItem[];
    generation?: number;
    softExpireAt?: number;
    hardExpireAt?: number | null;
    lastRefreshedAt?: number;
    contentHash?: string;
  },
): Promise<void> {
  const generation = args.generation ?? 1;
  const doc: MatchListProjection = {
    schemaVersion: SCHEMA_VERSION,
    id: args.projectionId,
    kind: "match_list",
    key: args.key,
    matchIds: args.matchIds,
    ...(args.items && args.items.length > 0 ? { items: args.items } : {}),
  };
  const r2Key = objectKey("projection", args.projectionId, generation);
  await objects.put(r2Key, new TextEncoder().encode(JSON.stringify(doc)));
  await meta.putJson(projectionKey("match_list", args.key), {
    objectType: "projection",
    objectId: args.projectionId,
    freshnessClass: "table",
    controlState: "fresh",
    r2Key,
    generation,
    ...(args.contentHash ? { contentHash: args.contentHash } : {}),
    ...(args.lastRefreshedAt !== undefined ? { lastRefreshedAt: args.lastRefreshedAt } : {}),
    ...(args.softExpireAt !== undefined ? { softExpireAt: args.softExpireAt } : {}),
    ...(args.hardExpireAt !== undefined
      ? { hardExpireAt: args.hardExpireAt ?? undefined }
      : {}),
  });
}

export async function getMatchListProjection(
  objects: ObjectStore,
  meta: MetaStore,
  key: string,
): Promise<MatchListProjection | null> {
  const pointer = await meta.getJson<{ r2Key?: string }>(projectionKey("match_list", key));
  if (!pointer?.r2Key) return null;
  const bytes = await objects.get(pointer.r2Key);
  if (!bytes) return null;
  return JSON.parse(new TextDecoder().decode(bytes)) as MatchListProjection;
}

/** Suggested Cache-Control max-age by match phase (performance tuning). */
export function cacheMaxAgeForPhase(phase: string): number {
  switch (phase) {
    case "live":
      return 5;
    case "finished":
    case "historical":
      return 86_400;
    default:
      return 300;
  }
}
