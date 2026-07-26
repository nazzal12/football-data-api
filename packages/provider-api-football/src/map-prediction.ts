import type { MatchPrediction } from "@football-api/domain";
import { matchPredictionSchema, parseCanonical } from "@football-api/domain";

export type UpstreamPredictionsResponse = {
  response: Array<{
    predictions?: {
      winner?: { id: number | null; name?: string | null; comment?: string | null };
      win_or_draw?: boolean;
      under_over?: string | null;
      goals?: { home?: string | null; away?: string | null };
      advice?: string | null;
      percent?: { home?: string | null; draw?: string | null; away?: string | null };
    };
    teams?: {
      home?: { id: number; last_5?: { form?: string | null } };
      away?: { id: number; last_5?: { form?: string | null } };
    };
  }>;
};

function parsePercent(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(String(value).replace("%", "").trim());
  return Number.isFinite(n) ? n : undefined;
}

export async function mapPredictionToCanonical(
  body: UpstreamPredictionsResponse,
  internalId: string,
  matchId: string,
  resolve: { teamId: (externalId: number) => string | Promise<string> },
): Promise<MatchPrediction> {
  const item = body.response?.[0];
  if (!item?.predictions) {
    throw new Error("Empty predictions response");
  }
  const p = item.predictions;
  const winnerId = p.winner?.id;
  return parseCanonical(matchPredictionSchema, {
    schemaVersion: 1,
    id: internalId,
    matchId,
    advice: p.advice ?? undefined,
    winnerTeamId: winnerId != null ? await resolve.teamId(winnerId) : undefined,
    winOrDraw: p.win_or_draw,
    underOver: p.under_over ?? undefined,
    goalsHome: p.goals?.home ?? undefined,
    goalsAway: p.goals?.away ?? undefined,
    percentHome: parsePercent(p.percent?.home),
    percentDraw: parsePercent(p.percent?.draw),
    percentAway: parsePercent(p.percent?.away),
    formHome: item.teams?.home?.last_5?.form ?? undefined,
    formAway: item.teams?.away?.last_5?.form ?? undefined,
  });
}
