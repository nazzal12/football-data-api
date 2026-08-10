import type { ProviderSearchHit } from "@football-api/provider";

export type UpstreamTeamsSearchResponse = {
  response?: Array<{
    team?: {
      id?: number;
      name?: string | null;
      logo?: string | null;
    };
  }>;
};

export type UpstreamLeaguesSearchResponse = {
  response?: Array<{
    league?: {
      id?: number;
      name?: string | null;
      logo?: string | null;
    };
  }>;
};

export type UpstreamPlayerProfilesSearchResponse = {
  response?: Array<{
    player?: {
      id?: number;
      name?: string | null;
      photo?: string | null;
    };
  }>;
};

function logoOrUndefined(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

export function mapTeamsSearchHits(body: UpstreamTeamsSearchResponse): ProviderSearchHit[] {
  const out: ProviderSearchHit[] = [];
  for (const row of body.response ?? []) {
    const id = row.team?.id;
    const name = row.team?.name?.trim();
    if (id == null || !name) continue;
    out.push({
      type: "team",
      externalId: String(id),
      displayName: name,
      logoUrl: logoOrUndefined(row.team?.logo),
    });
  }
  return out;
}

export function mapLeaguesSearchHits(body: UpstreamLeaguesSearchResponse): ProviderSearchHit[] {
  const out: ProviderSearchHit[] = [];
  for (const row of body.response ?? []) {
    const id = row.league?.id;
    const name = row.league?.name?.trim();
    if (id == null || !name) continue;
    out.push({
      type: "competition",
      externalId: String(id),
      displayName: name,
      logoUrl: logoOrUndefined(row.league?.logo),
    });
  }
  return out;
}

export function mapPlayerProfilesSearchHits(
  body: UpstreamPlayerProfilesSearchResponse,
): ProviderSearchHit[] {
  const out: ProviderSearchHit[] = [];
  for (const row of body.response ?? []) {
    const id = row.player?.id;
    const name = row.player?.name?.trim();
    if (id == null || !name) continue;
    out.push({
      type: "player",
      externalId: String(id),
      displayName: name,
      logoUrl: logoOrUndefined(row.player?.photo),
    });
  }
  return out;
}
