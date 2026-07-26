import type { TrophyReport } from "@football-api/domain";
import { parseCanonical, trophyReportSchema } from "@football-api/domain";

export type UpstreamTrophiesResponse = {
  response: Array<{
    league?: string | null;
    country?: string | null;
    season?: string | null;
    place?: string | null;
  }>;
};

export function mapTrophiesToCanonical(
  body: UpstreamTrophiesResponse,
  internalId: string,
  subjectType: "player" | "coach",
  subjectId: string,
): TrophyReport {
  const trophies = (body.response ?? []).map((t) => ({
    place: t.place ?? undefined,
    season: t.season ?? undefined,
    competitionName: t.league ?? undefined,
    country: t.country ?? undefined,
  }));
  return parseCanonical(trophyReportSchema, {
    schemaVersion: 1,
    id: internalId,
    subjectType,
    subjectId,
    trophies,
  });
}

/** External trophy key: "player:{id}" | "coach:{id}" (API-Football has no team trophies param). */
export function parseTrophyExternalId(externalId: string): {
  subjectType: "player" | "coach";
  id: string;
} | null {
  const match = /^(player|coach):(\d+)$/.exec(externalId);
  if (!match?.[1] || !match[2]) return null;
  return { subjectType: match[1] as "player" | "coach", id: match[2] };
}
