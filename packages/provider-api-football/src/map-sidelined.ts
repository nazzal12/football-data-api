import type { SidelinedReport } from "@football-api/domain";
import { parseCanonical, sidelinedReportSchema } from "@football-api/domain";

export type UpstreamSidelinedResponse = {
  response: Array<{
    type?: string | null;
    start?: string | null;
    end?: string | null;
  }>;
};

export function mapSidelinedToCanonical(
  body: UpstreamSidelinedResponse,
  internalId: string,
  scope: { playerId?: string; coachId?: string },
): SidelinedReport {
  return parseCanonical(sidelinedReportSchema, {
    schemaVersion: 1,
    id: internalId,
    playerId: scope.playerId,
    coachId: scope.coachId,
    entries: (body.response ?? []).map((e) => ({
      type: e.type ?? undefined,
      start: e.start ?? undefined,
      end: e.end ?? undefined,
    })),
  });
}

/** External sidelined key: "player:{id}" | "coach:{id}" */
export function parseSidelinedExternalId(externalId: string): {
  subjectType: "player" | "coach";
  id: string;
} | null {
  const match = /^(player|coach):(\d+)$/.exec(externalId);
  if (!match?.[1] || !match[2]) return null;
  return { subjectType: match[1] as "player" | "coach", id: match[2] };
}
