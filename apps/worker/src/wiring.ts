import { ConsoleLogger, SystemClock, loadConfig } from "@football-api/core";
import { KvIdBridge } from "@football-api/provider";
import { ApiFootballProvider } from "@football-api/provider-api-football";
import {
  CacheApiHttpCache,
  KvMetaStore,
  R2ObjectStore,
  type HttpCache,
  type MetaStore,
  type ObjectStore,
} from "@football-api/storage";
import type { WorkerBindings } from "./env.js";
import { PersistentIdResolver } from "./ids.js";
import { Orchestrator } from "./orchestrator.js";

/** Platform-agnostic service deps (Workers KV/R2 or Node Redis/FS). */
export type RuntimeEnv = {
  meta: MetaStore;
  objects: ObjectStore;
  cache: HttpCache;
  API_SPORTS_KEY?: string;
  ADMIN_TOKEN?: string;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  ACCESS_GUARD?: string;
  ALLOWED_CF_WORKERS?: string;
  ALLOWED_SITE_HOSTS?: string;
};

export function isWorkerBindings(env: WorkerBindings | RuntimeEnv): env is WorkerBindings {
  return "META" in env && env.META != null;
}

export function toRuntimeEnv(env: WorkerBindings | RuntimeEnv): RuntimeEnv {
  if (!isWorkerBindings(env)) return env;
  return {
    meta: new KvMetaStore(env.META),
    objects: new R2ObjectStore(env.OBJECTS),
    cache: CacheApiHttpCache.fromDefault(),
    API_SPORTS_KEY: env.API_SPORTS_KEY,
    ADMIN_TOKEN: env.ADMIN_TOKEN,
    ENVIRONMENT: env.ENVIRONMENT,
    LOG_LEVEL: env.LOG_LEVEL,
    ACCESS_GUARD: env.ACCESS_GUARD,
    ALLOWED_CF_WORKERS: env.ALLOWED_CF_WORKERS,
    ALLOWED_SITE_HOSTS: env.ALLOWED_SITE_HOSTS,
  };
}

export function createServices(env: WorkerBindings | RuntimeEnv) {
  const runtime = toRuntimeEnv(env);
  const config = loadConfig({
    ENVIRONMENT: runtime.ENVIRONMENT,
    LOG_LEVEL: runtime.LOG_LEVEL,
    API_SPORTS_KEY: runtime.API_SPORTS_KEY,
  });
  const logger = new ConsoleLogger(config.logLevel);
  const meta = runtime.meta;
  const objects = runtime.objects;
  const cache = runtime.cache;
  const resolver = new PersistentIdResolver(meta);
  const bridge = new KvIdBridge(meta, "api-football");

  const provider = new ApiFootballProvider({
    apiKey: runtime.API_SPORTS_KEY ?? "",
    resolveIds: resolver.asMapperResolvers(),
  });

  const ids = {
    toInternal: (ref: {
      provider: string;
      externalType: string;
      externalId: string;
    }) => bridge.toInternal(ref),
    bind: (
      ref: { provider: string; externalType: string; externalId: string },
      internalId: string,
    ) => bridge.bind(ref, internalId),
    toExternal: (internalId: string) => resolver.toExternal(internalId),
    ensure: (externalType: string, externalId: string) => resolver.ensure(externalType, externalId),
  };

  const orchestrator = new Orchestrator({
    objects,
    meta,
    cache,
    provider,
    ids,
    clock: new SystemClock(),
    logger,
  });

  return { orchestrator, resolver, meta, objects, logger, config, runtime };
}

export function createOrchestrator(env: WorkerBindings | RuntimeEnv): Orchestrator {
  return createServices(env).orchestrator;
}
