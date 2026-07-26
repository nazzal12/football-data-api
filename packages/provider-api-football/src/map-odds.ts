import type { MatchOdds } from "@football-api/domain";
import { matchOddsSchema, parseCanonical } from "@football-api/domain";

export type UpstreamOddsResponse = {
  response: Array<{
    update?: string;
    bookmakers?: Array<{
      name: string;
      bets?: Array<{
        name: string;
        values?: Array<{ value: string; odd: string }>;
      }>;
    }>;
  }>;
};

export function mapOddsToCanonical(
  body: UpstreamOddsResponse,
  internalId: string,
  matchId: string,
): MatchOdds {
  const item = body.response?.[0];
  const bookmakers = [];
  for (const bm of item?.bookmakers ?? []) {
    const bets = [];
    for (const bet of bm.bets ?? []) {
      const values = [];
      for (const v of bet.values ?? []) {
        const odd = Number(v.odd);
        if (!Number.isFinite(odd) || odd <= 0) continue;
        values.push({ label: String(v.value), odd });
      }
      if (values.length) bets.push({ name: bet.name, values });
    }
    if (bets.length) bookmakers.push({ name: bm.name, bets });
  }
  const updatedAt = item?.update ? new Date(item.update).toISOString() : undefined;
  return parseCanonical(matchOddsSchema, {
    schemaVersion: 1,
    id: internalId,
    matchId,
    updatedAt,
    bookmakers,
  });
}
