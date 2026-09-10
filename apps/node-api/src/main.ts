import { mkdir } from "node:fs/promises";
import { serve } from "@hono/node-server";
import { FsObjectStore } from "@football-api/storage/fs";
import { MemoryHttpCache, RedisMetaStore } from "@football-api/storage";
import {
  app,
  configureWarmupOrigin,
  runWarmup,
  warmupModeForCron,
  type RuntimeEnv,
} from "@football-api/worker/node";
import Redis from "ioredis";
import cron from "node-cron";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env ${name}`);
  return v;
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? "8787");
  const host = process.env.HOST ?? "127.0.0.1";
  const redisUrl = required("REDIS_URL", "redis://127.0.0.1:6379");
  const objectsDir = required("OBJECTS_DIR", "/var/lib/football-api/objects");
  const publicBase = required(
    "PUBLIC_BASE_URL",
    `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`,
  );

  await mkdir(objectsDir, { recursive: true });
  configureWarmupOrigin(publicBase);

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  await redis.connect();

  const env: RuntimeEnv = {
    meta: new RedisMetaStore(redis),
    objects: new FsObjectStore(objectsDir),
    cache: new MemoryHttpCache(),
    API_SPORTS_KEY: process.env.API_SPORTS_KEY,
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
    ENVIRONMENT: process.env.ENVIRONMENT ?? "production",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
    ACCESS_GUARD: process.env.ACCESS_GUARD,
    ALLOWED_CF_WORKERS: process.env.ALLOWED_CF_WORKERS,
    ALLOWED_SITE_HOSTS: process.env.ALLOWED_SITE_HOSTS,
  };

  const executionCtx = {
    waitUntil(promise: Promise<unknown>) {
      void promise;
    },
    passThroughOnException() {},
  } as never;

  // Date lists every 5 minutes; catalog every 5 hours (same as wrangler.toml).
  // Set DISABLE_CRON=1 on dual-run staging to avoid duplicate API-Sports usage vs CF Worker.
  const cronDisabled = /^(1|true|yes|on)$/i.test(process.env.DISABLE_CRON ?? "");
  if (cronDisabled) {
    console.log(JSON.stringify({ msg: "cron disabled (DISABLE_CRON)", publicBase }));
  } else {
    cron.schedule("*/5 * * * *", () => {
      const mode = warmupModeForCron("*/5 * * * *");
      void runWarmup(env, { mode }).catch((err) => console.error("warmup dates failed", err));
    });
    cron.schedule("0 */5 * * *", () => {
      const mode = warmupModeForCron("0 */5 * * *");
      void runWarmup(env, { mode }).catch((err) => console.error("warmup catalog failed", err));
    });
  }

  serve(
    {
      fetch: (request) => app.fetch(request, env, executionCtx),
      port,
      hostname: host,
    },
    (info) => {
      console.log(
        JSON.stringify({
          msg: "football-api node listening",
          address: `${info.address}:${info.port}`,
          publicBase,
        }),
      );
    },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
