import type { Player } from "@football-api/domain";
import { parseCanonical, playerSchema } from "@football-api/domain";

export type UpstreamPlayerProfileItem = {
  player: {
    id: number;
    name: string;
    firstname?: string | null;
    lastname?: string | null;
    age?: number | null;
    birth?: { date?: string | null; country?: string | null };
    nationality?: string | null;
    height?: string | null;
    weight?: string | null;
    photo?: string | null;
  };
  statistics?: Array<{
    games?: { position?: string | null };
  }>;
};

export type UpstreamPlayersResponse = {
  response: UpstreamPlayerProfileItem[];
};

export async function mapPlayerToCanonical(
  item: UpstreamPlayerProfileItem,
  internalId: string,
  resolve: {
    countryId?: (name: string) => string | undefined | Promise<string | undefined>;
  },
): Promise<Player> {
  const p = item.player;
  const nationality = p.nationality ?? p.birth?.country ?? undefined;
  const photo = p.photo && /^https?:\/\//.test(p.photo) ? p.photo : undefined;
  return parseCanonical(playerSchema, {
    schemaVersion: 1,
    id: internalId,
    name: p.name,
    firstName: p.firstname ?? undefined,
    lastName: p.lastname ?? undefined,
    age: p.age ?? undefined,
    nationality: nationality ?? undefined,
    countryId: nationality ? await resolve.countryId?.(nationality) : undefined,
    dateOfBirth: p.birth?.date ?? undefined,
    height: p.height ?? undefined,
    weight: p.weight ?? undefined,
    position: item.statistics?.[0]?.games?.position ?? undefined,
    photoUrl: photo,
  });
}
