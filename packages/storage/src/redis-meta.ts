import { storageError } from "@football-api/core";
import type { MetaStore } from "./ports.js";

/** Minimal Redis client surface used by MetaStore (ioredis-compatible). */
export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode?: string, time?: number): Promise<unknown>;
  del(key: string): Promise<number>;
};

export class RedisMetaStore implements MetaStore {
  constructor(private readonly redis: RedisLike) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (cause) {
      throw storageError("Redis get failed", { key, cause: String(cause) });
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    try {
      if (options?.expirationTtl && options.expirationTtl > 0) {
        await this.redis.set(key, value, "EX", Math.floor(options.expirationTtl));
      } else {
        await this.redis.set(key, value);
      }
    } catch (cause) {
      throw storageError("Redis put failed", { key, cause: String(cause) });
    }
  }

  async putJson(key: string, value: unknown, options?: { expirationTtl?: number }): Promise<void> {
    await this.put(key, JSON.stringify(value), options);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (cause) {
      throw storageError("Redis delete failed", { key, cause: String(cause) });
    }
  }
}
