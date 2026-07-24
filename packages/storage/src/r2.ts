import { storageError } from "@football-api/core";
import type { ObjectStore } from "./ports.js";

export class R2ObjectStore implements ObjectStore {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const obj = await this.bucket.get(key);
      if (!obj) return null;
      const buffer = await obj.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (cause) {
      throw storageError("R2 get failed", { key, cause: String(cause) });
    }
  }

  async put(
    key: string,
    body: Uint8Array,
    options?: { httpMetadata?: Record<string, string> },
  ): Promise<void> {
    try {
      await this.bucket.put(key, body, {
        httpMetadata: options?.httpMetadata
          ? { contentType: options.httpMetadata.contentType }
          : { contentType: "application/json" },
      });
    } catch (cause) {
      throw storageError("R2 put failed", { key, cause: String(cause) });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.bucket.delete(key);
    } catch (cause) {
      throw storageError("R2 delete failed", { key, cause: String(cause) });
    }
  }
}
