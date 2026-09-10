export type { HttpCache, MetaStore, ObjectStore } from "./ports.js";
export type { ControlState, ObjectMetadata } from "@football-api/core";
export {
  idMapKey,
  metaKey,
  objectKey,
  projectionKey,
  quotaKey,
  slugIndexKey,
} from "@football-api/core";
export { MemoryHttpCache, MemoryMetaStore, MemoryObjectStore } from "./memory.js";
export { R2ObjectStore } from "./r2.js";
export { KvMetaStore } from "./kv.js";
export { CacheApiHttpCache } from "./cache.js";
export { RedisMetaStore, type RedisLike } from "./redis-meta.js";
// FsObjectStore is Node-only — import from @football-api/storage/fs
export {
  cacheMaxAgeForPhase,
  getMatchListProjection,
  parseMatchListProjectionKey,
  putMatchListProjection,
} from "./projections.js";
