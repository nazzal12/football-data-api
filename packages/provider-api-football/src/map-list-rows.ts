import { FEATURED_LEAGUE_EXTERNAL_IDS } from "@football-api/core";
import type { MatchPhase } from "@football-api/domain";
import type { ProviderMatchListRow } from "@football-api/provider";
import type { UpstreamFixtureItem } from "./upstream-types.js";

const FEATURED = new Set<string>(FEATURED_LEAGUE_EXTERNAL_IDS);

function mapPhase(statusShort: string): MatchPhase {
  const live = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
  const finished = new Set(["FT", "AET", "PEN", "AWD", "WO", "ABD"]);
  if (live.has(statusShort)) return "live";
  if (finished.has(statusShort)) return "finished";
  return "future";
}

function teamLogo(id: number, logo?: string | null): string | undefined {
  if (logo && /^https?:\/\//.test(logo)) return logo;
  return `https://media.api-sports.io/football/teams/${id}.png`;
}

function leagueLogo(id: number, logo?: string | null): string | undefined {
  if (logo && /^https?:\/\//.test(logo)) return logo;
  return `https://media.api-sports.io/football/leagues/${id}.png`;
}

export function mapFixturesToListRows(
  items: UpstreamFixtureItem[],
  opts?: { featuredOnly?: boolean; limit?: number },
): ProviderMatchListRow[] {
  let source = items;
  if (opts?.featuredOnly) {
    const featured = items.filter((item) => FEATURED.has(String(item.league.id)));
    // Sparse days (summer): fall back to worldwide so UI is not empty.
    source = featured.length > 0 ? featured : items;
  }

  const capped = opts?.limit != null ? source.slice(0, opts.limit) : source;
  return capped.map((item) => {
    const homeGoals = item.goals.home ?? item.score?.fulltime?.home ?? null;
    const awayGoals = item.goals.away ?? item.score?.fulltime?.away ?? null;
    const ph = item.score?.penalty?.home;
    const pa = item.score?.penalty?.away;
    return {
      matchExternalId: String(item.fixture.id),
      leagueExternalId: String(item.league.id),
      homeTeamExternalId: String(item.teams.home.id),
      awayTeamExternalId: String(item.teams.away.id),
      seasonYear: item.league.season,
      kickoffAt: new Date(item.fixture.date).toISOString(),
      phase: mapPhase(item.fixture.status.short),
      status: item.fixture.status.short,
      score:
        homeGoals != null && awayGoals != null
          ? {
              home: homeGoals,
              away: awayGoals,
              ...(ph != null && pa != null
                ? { penaltyHome: ph, penaltyAway: pa }
                : {}),
            }
          : undefined,
      minute: item.fixture.status.elapsed ?? undefined,
      homeName: item.teams.home.name,
      awayName: item.teams.away.name,
      homeLogoUrl: teamLogo(item.teams.home.id, item.teams.home.logo),
      awayLogoUrl: teamLogo(item.teams.away.id, item.teams.away.logo),
      leagueName: item.league.name,
      leagueLogoUrl: leagueLogo(item.league.id, item.league.logo),
    };
  });
}
