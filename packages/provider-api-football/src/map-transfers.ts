import type { TransferReport } from "@football-api/domain";
import { parseCanonical, transferReportSchema } from "@football-api/domain";

export type UpstreamTransfersResponse = {
  response: Array<{
    player?: { id: number };
    transfers?: Array<{
      date?: string | null;
      type?: string | null;
      teams?: {
        in?: { id?: number | null };
        out?: { id?: number | null };
      };
    }>;
    update?: string;
  }>;
};

export async function mapTransfersToCanonical(
  body: UpstreamTransfersResponse,
  internalId: string,
  scope: { teamId?: string; playerId?: string },
  resolve: {
    playerId: (externalId: number) => string | Promise<string>;
    teamId: (externalId: number) => string | Promise<string>;
  },
): Promise<TransferReport> {
  const transfers = [];
  const blocks = (body.response ?? []).slice(0, 40);
  for (const block of blocks) {
    const playerExternalId = block.player?.id;
    if (playerExternalId == null) continue;
    const playerId = await resolve.playerId(playerExternalId);
    const recent = [...(block.transfers ?? [])]
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
      .slice(0, 5);
    for (const t of recent) {
      transfers.push({
        playerId,
        date: t.date ?? undefined,
        type: t.type ?? undefined,
        fromTeamId: t.teams?.out?.id != null ? await resolve.teamId(t.teams.out.id) : undefined,
        toTeamId: t.teams?.in?.id != null ? await resolve.teamId(t.teams.in.id) : undefined,
      });
    }
  }
  transfers.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return parseCanonical(transferReportSchema, {
    schemaVersion: 1,
    id: internalId,
    teamId: scope.teamId,
    playerId: scope.playerId,
    transfers: transfers.slice(0, 100),
  });
}

/** External transfer key: "team:{id}" or "player:{id}" */
export function parseTransferExternalId(
  externalId: string,
): { scope: "team" | "player"; id: string } | null {
  const match = /^(team|player):(\d+)$/.exec(externalId);
  if (!match?.[1] || !match[2]) return null;
  return { scope: match[1] as "team" | "player", id: match[2] };
}
