import { idMapKey } from "@football-api/core";
import type { ExternalRef, IdBridge } from "./port.js";

/** Minimal meta port so provider does not depend on @football-api/storage. */
export type ProviderMetaStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

export class KvIdBridge implements IdBridge {
  constructor(
    private readonly meta: ProviderMetaStore,
    private readonly provider: string,
  ) {}

  async toInternal(ref: ExternalRef): Promise<string | null> {
    return this.meta.get(idMapKey(ref.provider, ref.externalType, ref.externalId));
  }

  async bind(ref: ExternalRef, internalId: string): Promise<void> {
    await this.meta.put(idMapKey(ref.provider, ref.externalType, ref.externalId), internalId);
    await this.meta.put(idMapKey(this.provider, "internal", internalId), ref.externalId);
  }

  async toExternal(internalId: string): Promise<string | null> {
    return this.meta.get(idMapKey(this.provider, "internal", internalId));
  }
}

export class MemoryIdBridge implements IdBridge {
  private readonly forward = new Map<string, string>();
  private readonly reverse = new Map<string, string>();

  private fk(ref: ExternalRef): string {
    return `${ref.provider}:${ref.externalType}:${ref.externalId}`;
  }

  async toInternal(ref: ExternalRef): Promise<string | null> {
    return this.forward.get(this.fk(ref)) ?? null;
  }

  async bind(ref: ExternalRef, internalId: string): Promise<void> {
    this.forward.set(this.fk(ref), internalId);
    this.reverse.set(internalId, ref.externalId);
  }

  async toExternal(internalId: string): Promise<string | null> {
    return this.reverse.get(internalId) ?? null;
  }
}
