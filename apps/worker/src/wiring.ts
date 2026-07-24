import { ConsoleLogger, SystemClock, loadConfig } from "@football-api/core";
import { KvIdBridge } from "@football-api/provider";
import { ApiFootballProvider } from "@football-api/provider-api-football";
import { CacheApiHttpCache, KvMetaStore, R2ObjectStore } from "@football-api/storage";
import type { WorkerBindings } from "./env.js";
import { PersistentIdResolver } from "./ids.js";
import { Orchestrator } from "./orchestrator.js";

export function createServices(env: WorkerBindings) {
  const config = loadConfig(env);
  const logger = new ConsoleLogger(config.logLevel);
  const meta = new KvMetaStore(env.META);
  const objects = new R2ObjectStore(env.OBJECTS);
  const cache = CacheApiHttpCache.fromDefault();
  const resolver = new PersistentIdResolver(meta);
  const bridge = new KvIdBridge(meta, "api-football");

  const provider = new ApiFootballProvider({
    apiKey: env.API_SPORTS_KEY ?? "",
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

  return { orchestrator, resolver, meta, objects, logger, config };
}

export function createOrchestrator(env: WorkerBindings): Orchestrator {
  return createServices(env).orchestrator;
}
