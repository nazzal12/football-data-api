import { objectKey, projectionKey } from "@football-api/core";
import { type MatchListProjection, SCHEMA_VERSION } from "@football-api/domain";
import type { MetaStore, ObjectStore } from "./ports.js";

/**
 * Projection helpers — list endpoints read these documents instead of N+1 R2 gets.
 */
export async function putMatchListProjection(
  objects: ObjectStore,
  meta: MetaStore,
  args: {
    projectionId: string;
    key: string;
    matchIds: string[];
    generation?: number;
  },
): Promise<void> {
  const generation = args.generation ?? 1;
  const doc: MatchListProjection = {
    schemaVersion: SCHEMA_VERSION,
    id: args.projectionId,
    kind: "match_list",
    key: args.key,
    matchIds: args.matchIds,
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
      return 10;
    case "finished":
      return 60;
    case "historical":
      return 86_400;
    default:
      return 300;
  }
}
