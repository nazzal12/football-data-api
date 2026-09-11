import { createId, idMapKey } from "@football-api/core";
import type { MetaStore } from "@football-api/storage";

const PROVIDER = "api-football";

function packKey(kind: string): string {
  return idMapKey(PROVIDER, "pack", kind);
}

/**
 * Ensures stable internal UUIDs for provider external ids.
 *
 * Maps are stored as one KV JSON pack per entity type (plus a reverse pack)
 * so a date/live list does a handful of KV ops instead of 4 KV ops per entity.
 * That stays under Cloudflare Free's 50 subrequests-per-invocation limit.
 */
export class PersistentIdResolver {
  private readonly packs = new Map<string, Record<string, string>>();
  private readonly loaded = new Set<string>();
  private readonly dirty = new Set<string>();
  private readonly inflight = new Map<string, Promise<Record<string, string>>>();

  constructor(private readonly meta: MetaStore) {}

  private async loadPack(kind: string): Promise<Record<string, string>> {
    const cached = this.packs.get(kind);
    if (cached && this.loaded.has(kind)) return cached;
    const pending = this.inflight.get(kind);
    if (pending) return pending;
    const task = (async () => {
      const data = (await this.meta.getJson<Record<string, string>>(packKey(kind))) ?? {};
      this.packs.set(kind, data);
      this.loaded.add(kind);
      this.inflight.delete(kind);
      return data;
    })();
    this.inflight.set(kind, task);
    try {
      return await task;
    } catch (error) {
      this.inflight.delete(kind);
      throw error;
    }
  }

  async ensure(externalType: string, externalId: string | number): Promise<string> {
    const ext = String(externalId);
    const forward = await this.loadPack(externalType);
    const existing = forward[ext];
    if (existing) return existing;

    const internalId = createId();
    forward[ext] = internalId;
    const reverse = await this.loadPack("reverse");
    reverse[internalId] = ext;
    this.dirty.add(externalType);
    this.dirty.add("reverse");
    return internalId;
  }

  async toExternal(internalId: string): Promise<string | null> {
    const reverse = await this.loadPack("reverse");
    return reverse[internalId] ?? null;
  }

  async toInternal(externalType: string, externalId: string): Promise<string | null> {
    const forward = await this.loadPack(externalType);
    return forward[String(externalId)] ?? null;
  }

  async bind(externalType: string, externalId: string, internalId: string): Promise<void> {
    const ext = String(externalId);
    const forward = await this.loadPack(externalType);
    forward[ext] = internalId;
    const reverse = await this.loadPack("reverse");
    reverse[internalId] = ext;
    this.dirty.add(externalType);
    this.dirty.add("reverse");
  }

  async flush(): Promise<void> {
    if (this.dirty.size === 0) return;
    const kinds = [...this.dirty];
    this.dirty.clear();
    for (const kind of kinds) {
      const pack = this.packs.get(kind);
      if (pack) await this.meta.putJson(packKey(kind), pack);
    }
  }

  asMapperResolvers() {
    return {
      teamId: (externalId: number) => this.ensure("team", externalId),
      seasonId: (competitionExternalId: number, seasonYear: number) =>
        this.ensure("season", `${competitionExternalId}:${seasonYear}`),
      competitionId: (externalId: number) => this.ensure("competition", externalId),
      matchId: (externalId: number) => this.ensure("match", externalId),
      coachId: (externalId: number) => this.ensure("coach", externalId),
      venueId: async (externalId: number) => this.ensure("venue", externalId),
      playerId: async (externalId: number) => this.ensure("player", externalId),
      countryId: async (name: string) => this.ensure("country", name.toLowerCase()),
    };
  }
}
