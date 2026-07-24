export interface ObjectStore {
  get(key: string): Promise<Uint8Array | null>;
  put(
    key: string,
    body: Uint8Array,
    options?: { httpMetadata?: Record<string, string> },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface MetaStore {
  get(key: string): Promise<string | null>;
  getJson<T>(key: string): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  putJson(key: string, value: unknown, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface HttpCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
}
