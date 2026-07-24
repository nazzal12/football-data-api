import type { HttpCache } from "./ports.js";

export class CacheApiHttpCache implements HttpCache {
  constructor(private readonly cache: Cache) {}

  static fromDefault(): CacheApiHttpCache {
    // caches.default is available in the Workers runtime
    const store = (caches as unknown as { default: Cache }).default;
    return new CacheApiHttpCache(store);
  }

  async match(request: Request): Promise<Response | undefined> {
    const matched = await this.cache.match(request);
    return matched ?? undefined;
  }

  async put(request: Request, response: Response): Promise<void> {
    await this.cache.put(request, response);
  }

  async delete(request: Request): Promise<boolean> {
    return this.cache.delete(request);
  }
}
