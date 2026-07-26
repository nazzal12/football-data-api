import type { HeadToHead } from "@football-api/domain";
import { headToHeadSchema, parseCanonical } from "@football-api/domain";

export type UpstreamH2HResponse = {
  response: Array<{ fixture: { id: number } }>;
};

export async function mapH2HToCanonical(
  body: UpstreamH2HResponse,
  internalId: string,
  teamAId: string,
  teamBId: string,
  resolveMatchId: (externalId: number) => string | Promise<string>,
): Promise<HeadToHead> {
  const matchIds = [];
  for (const item of (body.response ?? []).slice(0, 20)) {
    matchIds.push(await resolveMatchId(item.fixture.id));
  }
  return parseCanonical(headToHeadSchema, {
    schemaVersion: 1,
    id: internalId,
    teamAId,
    teamBId,
    matchIds,
  });
}

/** External H2H key: "{teamA}:{teamB}" sorted numerically ascending. */
export function parseH2HExternalId(externalId: string): { teamA: string; teamB: string } | null {
  const match = /^(\d+)-(\d+)$/.exec(externalId);
  if (!match?.[1] || !match[2]) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return a < b
    ? { teamA: String(a), teamB: String(b) }
    : { teamA: String(b), teamB: String(a) };
}

export function h2hExternalId(teamA: string | number, teamB: string | number): string {
  const a = Number(teamA);
  const b = Number(teamB);
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
