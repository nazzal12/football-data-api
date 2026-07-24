import type { HttpCache, MetaStore, ObjectStore } from "./ports.js";

export class MemoryObjectStore implements ObjectStore {
  private readonly data = new Map<string, Uint8Array>();

  async get(key: string): Promise<Uint8Array | null> {
    return this.data.get(key) ?? null;
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    this.data.set(key, body);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export class MemoryMetaStore implements MetaStore {
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async putJson(key: string, value: unknown): Promise<void> {
    await this.put(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export class MemoryHttpCache implements HttpCache {
  private readonly data = new Map<string, Response>();

  private key(request: Request): string {
    return request.url;
  }

  async match(request: Request): Promise<Response | undefined> {
    const cached = this.data.get(this.key(request));
    return cached ? cached.clone() : undefined;
  }

  async put(request: Request, response: Response): Promise<void> {
    this.data.set(this.key(request), response.clone());
  }

  async delete(request: Request): Promise<boolean> {
    return this.data.delete(this.key(request));
  }
}
