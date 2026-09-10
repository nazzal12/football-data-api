/**
 * Export Workers KV namespace keys to a JSONL file (key + value).
 * Usage (from repo root, with wrangler auth):
 *   pnpm exec tsx scripts/export-kv-to-jsonl.ts > /tmp/kv.jsonl
 *
 * Env:
 *   CF_ACCOUNT_ID (default from wrangler.toml account)
 *   CF_KV_NAMESPACE_ID (default football-api-data id)
 */
import { execFileSync } from "node:child_process";

const accountId = process.env.CF_ACCOUNT_ID ?? "172e60bf5969fa2ef5e34f840c3b1045";
const namespaceId = process.env.CF_KV_NAMESPACE_ID ?? "47d3dcca27284017a3d6a1be1d2cb119";

function wrangler(args: string[]): string {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

type KeyRow = { name: string; expiration?: number };

async function main(): Promise<void> {
  let cursor: string | undefined;
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const args = [
      "kv",
      "key",
      "list",
      `--namespace-id=${namespaceId}`,
      "--remote",
      "--prefix=",
    ];
    if (cursor) args.push(`--cursor=${cursor}`);
    const raw = wrangler(args);
    const parsed = JSON.parse(raw) as KeyRow[] | { keys?: KeyRow[]; cursor?: string };
    const keys = Array.isArray(parsed) ? parsed : (parsed.keys ?? []);
    const nextCursor = Array.isArray(parsed) ? undefined : parsed.cursor;

    for (const row of keys) {
      const value = wrangler([
        "kv",
        "key",
        "get",
        row.name,
        `--namespace-id=${namespaceId}`,
        "--remote",
      ]);
      const out = {
        key: row.name,
        value,
        expiration: row.expiration,
        accountId,
      };
      process.stdout.write(`${JSON.stringify(out)}\n`);
      total += 1;
      if (total % 100 === 0) {
        console.error(`exported ${total} keys...`);
      }
    }

    if (!nextCursor || keys.length === 0) break;
    cursor = nextCursor;
  }
  console.error(`done, exported ${total} keys`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
