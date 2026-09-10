/**
 * Import JSONL from export-kv-to-jsonl.ts into Redis.
 * Usage:
 *   REDIS_URL=redis://127.0.0.1:6379 pnpm exec tsx scripts/import-kv-jsonl-to-redis.ts < kv.jsonl
 */
import { createInterface } from "node:readline";
import Redis from "ioredis";

async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const redis = new Redis(redisUrl);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as { key: string; value: string; expiration?: number };
    if (row.expiration && row.expiration > 0) {
      const ttl = row.expiration - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis.set(row.key, row.value, "EX", ttl);
      else await redis.set(row.key, row.value);
    } else {
      await redis.set(row.key, row.value);
    }
    n += 1;
    if (n % 500 === 0) console.error(`imported ${n}...`);
  }
  await redis.quit();
  console.error(`done, imported ${n} keys`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
