import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { storageError } from "@football-api/core";
import type { ObjectStore } from "./ports.js";

/**
 * Local-disk ObjectStore (R2 replacement for Node).
 * Keys are stored as files under rootDir; path separators in keys become directories.
 */
export class FsObjectStore implements ObjectStore {
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    const normalized = key.replace(/^\/+/, "").replace(/\.\./g, "");
    const full = path.resolve(this.rootDir, normalized);
    if (!full.startsWith(path.resolve(this.rootDir))) {
      throw storageError("FS object key escapes root", { key });
    }
    return full;
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const buf = await readFile(this.resolve(key));
      return new Uint8Array(buf);
    } catch (cause) {
      const err = cause as NodeJS.ErrnoException;
      if (err?.code === "ENOENT") return null;
      throw storageError("FS get failed", { key, cause: String(cause) });
    }
  }

  async put(
    key: string,
    body: Uint8Array,
    _options?: { httpMetadata?: Record<string, string> },
  ): Promise<void> {
    try {
      const full = this.resolve(key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
    } catch (cause) {
      throw storageError("FS put failed", { key, cause: String(cause) });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.resolve(key), { force: true });
    } catch (cause) {
      throw storageError("FS delete failed", { key, cause: String(cause) });
    }
  }
}
