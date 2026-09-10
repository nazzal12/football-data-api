import { describe, expect, it } from "vitest";
import { RedisMetaStore, type RedisLike } from "./redis-meta.js";

function memoryRedis(): RedisLike & { store: Map<string, { value: string; exp?: number }> } {
  const store = new Map<string, { value: string; exp?: number }>();
  return {
    store,
    async get(key) {
      const row = store.get(key);
      if (!row) return null;
      if (row.exp !== undefined && Date.now() >= row.exp) {
        store.delete(key);
        return null;
      }
      return row.value;
    },
    async set(key, value, expiryMode?, time?) {
      const exp =
        expiryMode === "EX" && typeof time === "number"
          ? Date.now() + time * 1000
          : undefined;
      store.set(key, { value, exp });
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

describe("RedisMetaStore", () => {
  it("round-trips strings and json", async () => {
    const redis = memoryRedis();
    const meta = new RedisMetaStore(redis);
    await meta.put("a", "1");
    expect(await meta.get("a")).toBe("1");
    await meta.putJson("b", { ok: true });
    expect(await meta.getJson<{ ok: boolean }>("b")).toEqual({ ok: true });
    await meta.delete("a");
    expect(await meta.get("a")).toBeNull();
  });

  it("supports expirationTtl via EX", async () => {
    const redis = memoryRedis();
    const meta = new RedisMetaStore(redis);
    await meta.put("temp", "x", { expirationTtl: 60 });
    expect(redis.store.get("temp")?.exp).toBeTypeOf("number");
  });
});
