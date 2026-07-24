import { createId, idMapKey } from "@football-api/core";
import type { MetaStore } from "@football-api/storage";

const PROVIDER = "api-football";

/**
 * Ensures stable internal UUIDs for provider external ids, persisted in KV.
 */
export class PersistentIdResolver {
  constructor(private readonly meta: MetaStore) {}

  async ensure(externalType: string, externalId: string | number): Promise<string> {
    const ext = String(externalId);
    const forwardKey = idMapKey(PROVIDER, externalType, ext);
    const existing = await this.meta.get(forwardKey);
    if (existing) return existing;

    const internalId = createId();
    await this.meta.put(forwardKey, internalId);
    await this.meta.put(idMapKey(PROVIDER, "internal", internalId), ext);
    // typed reverse for disambiguation when needed
    await this.meta.put(idMapKey(PROVIDER, `${externalType}-by-internal`, internalId), ext);
    return internalId;
  }

  async toExternal(internalId: string): Promise<string | null> {
    return this.meta.get(idMapKey(PROVIDER, "internal", internalId));
  }

  async toInternal(externalType: string, externalId: string): Promise<string | null> {
    return this.meta.get(idMapKey(PROVIDER, externalType, externalId));
  }

  async bind(externalType: string, externalId: string, internalId: string): Promise<void> {
    await this.meta.put(idMapKey(PROVIDER, externalType, externalId), internalId);
    await this.meta.put(idMapKey(PROVIDER, "internal", internalId), externalId);
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
