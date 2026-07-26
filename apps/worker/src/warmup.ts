import {
  FEATURED_LEAGUE_EXTERNAL_IDS,
  PROVIDER_FIXTURE_TIMEZONE,
} from "@football-api/core";
import type { WorkerBindings } from "./env.js";
import { createServices } from "./wiring.js";

/** Latin America calendar for date-bucketed fixture lists (API-Football timezone). */
export const PROVIDER_TIMEZONE = PROVIDER_FIXTURE_TIMEZONE;

const PUBLIC_ORIGIN = "https://football-api.nazzalkausar12.workers.dev";

function syntheticRequest(path: string): Request {
  return new Request(`${PUBLIC_ORIGIN}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}

/** Calendar YYYY-MM-DD in a named IANA timezone. */
export function ymdInTimeZone(nowMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + deltaDays);
  return new Date(utc).toISOString().slice(0, 10);
}

/**
 * Catalog / date-list warmup only.
 * - Does NOT touch live projections or live matches (user-driven, 5s TTL).
 * - Date lists may include finished fixtures in `items`, but orchestrator will not
 *   overwrite finished/historical match objects once frozen.
 */
export async function runWarmup(
  env: WorkerBindings,
): Promise<{ ok: true; steps: string[] }> {
  const { orchestrator, logger } = createServices(env);
  const steps: string[] = [];
  const nowMs = Date.now();

  const warmProjection = async (key: string) => {
    const httpPath = key.startsWith("date:")
      ? `/v1/projections/matches/by-date/${key.slice(5)}`
      : `/v1/projections/matches/${key}`;
    const result = await orchestrator.getMatchListProjection(
      syntheticRequest(httpPath),
      key,
    );
    if (!result.ok) {
      steps.push(`projection ${key} FAIL ${result.error.code}`);
      logger.warn("warmup.projection_fail", { key, code: result.error.code });
      return;
    }
    steps.push(
      `projection ${key} ok items=${result.value.projection.items?.length ?? 0}`,
    );
  };

  const todayLatam = ymdInTimeZone(nowMs, PROVIDER_TIMEZONE);
  for (const ymd of [
    shiftYmd(todayLatam, -1),
    todayLatam,
    shiftYmd(todayLatam, 1),
  ]) {
    await warmProjection(`date:${ymd}`);
  }

  const seasonYear = (() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: PROVIDER_TIMEZONE,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date(nowMs));
    const year = Number(parts.find((p) => p.type === "year")?.value ?? "2026");
    const month = Number(parts.find((p) => p.type === "month")?.value ?? "7");
    return month >= 7 ? year : year - 1;
  })();

  // Teams + tournaments (featured competitions + standings seed teams).
  for (const leagueId of FEATURED_LEAGUE_EXTERNAL_IDS.slice(0, 10)) {
    const path = `/v1/competitions/by-external/${leagueId}`;
    const result = await orchestrator.getCompetitionByExternal(
      syntheticRequest(path),
      leagueId,
    );
    if (!result.ok) {
      steps.push(`competition ${leagueId} FAIL`);
      continue;
    }
    steps.push(`competition ${leagueId} ok`);

    const standings = await orchestrator.getStandingsByExternal(
      syntheticRequest(`/v1/standings/by-external/${leagueId}/${seasonYear}`),
      `${leagueId}:${seasonYear}`,
    );
    if (!standings.ok) {
      steps.push(`standings ${leagueId}/${seasonYear} FAIL`);
    } else {
      steps.push(`standings ${leagueId}/${seasonYear} ok`);
      // Warm team stubs from table rows (logos/names) — static, not live.
      for (const row of standings.value.standings.rows.slice(0, 16)) {
        const teamPath = `/v1/teams/${row.teamId}`;
        const team = await orchestrator.getTeam(
          syntheticRequest(teamPath),
          row.teamId,
        );
        if (team.ok) steps.push(`team ${row.teamId.slice(0, 8)} ok`);
      }
    }
  }

  logger.info("warmup.done", { steps: steps.length });
  return { ok: true, steps };
}
