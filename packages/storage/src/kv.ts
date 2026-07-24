import { storageError } from "@football-api/core";
import type { MetaStore } from "./ports.js";

export class KvMetaStore implements MetaStore {
  constructor(private readonly kv: KVNamespace) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.kv.get(key);
    } catch (cause) {
      throw storageError("KV get failed", { key, cause: String(cause) });
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    try {
      await this.kv.put(
        key,
        value,
        options?.expirationTtl ? { expirationTtl: options.expirationTtl } : undefined,
      );
    } catch (cause) {
      throw storageError("KV put failed", { key, cause: String(cause) });
    }
  }

  async putJson(key: string, value: unknown, options?: { expirationTtl?: number }): Promise<void> {
    await this.put(key, JSON.stringify(value), options);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (cause) {
      throw storageError("KV delete failed", { key, cause: String(cause) });
    }
  }
}
