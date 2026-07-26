import type { Coach } from "@football-api/domain";
import { coachSchema, parseCanonical } from "@football-api/domain";

export type UpstreamCoachItem = {
  id: number;
  name: string;
  firstname?: string | null;
  lastname?: string | null;
  nationality?: string | null;
  photo?: string | null;
  birth?: { date?: string | null };
  team?: { id?: number | null } | null;
  career?: Array<{
    team?: { id?: number | null };
    start?: string | null;
    end?: string | null;
  }>;
};

export type UpstreamCoachsResponse = {
  response: UpstreamCoachItem[];
};

export async function mapCoachToCanonical(
  item: UpstreamCoachItem,
  internalId: string,
  resolve: { teamId: (externalId: number) => string | Promise<string> },
): Promise<Coach> {
  const career = [];
  for (const entry of item.career ?? []) {
    if (entry.team?.id == null) continue;
    career.push({
      teamId: await resolve.teamId(entry.team.id),
      start: entry.start ?? undefined,
      end: entry.end ?? undefined,
    });
  }
  const photo = item.photo && /^https?:\/\//.test(item.photo) ? item.photo : undefined;
  return parseCanonical(coachSchema, {
    schemaVersion: 1,
    id: internalId,
    name: item.name,
    firstName: item.firstname ?? undefined,
    lastName: item.lastname ?? undefined,
    nationality: item.nationality ?? undefined,
    dateOfBirth: item.birth?.date ?? undefined,
    photoUrl: photo,
    teamId: item.team?.id != null ? await resolve.teamId(item.team.id) : undefined,
    career,
  });
}
