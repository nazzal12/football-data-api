/**
 * Internal provider response shapes — never exported from package index.
 * Field names mirror upstream only inside this module.
 */

export type UpstreamFixtureItem = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string; elapsed: number | null };
    venue?: { id: number | null; name: string | null; city: string | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    season: number;
    logo?: string | null;
  };
  teams: {
    home: { id: number; name: string; logo?: string | null };
    away: { id: number; name: string; logo?: string | null };
  };
  goals: { home: number | null; away: number | null };
  score?: {
    fulltime?: { home: number | null; away: number | null };
  };
  events?: Array<{
    time: { elapsed: number | null; extra: number | null };
    team: { id: number; name?: string | null };
    player: { id: number | null; name?: string | null };
    assist: { id: number | null; name?: string | null };
    type: string;
    detail: string;
  }>;
};

export type UpstreamFixturesResponse = {
  response: UpstreamFixtureItem[];
};
