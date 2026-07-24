import type { AppError, Result } from "@football-api/core";
import { err, ok, providerError } from "@football-api/core";
import type { Match, Team } from "@football-api/domain";
import type { FootballProvider, QuotaSnapshot } from "@football-api/provider";
import { mapFixtureToMatch, parseQuotaHeaders } from "./map-match.js";
import type { IdResolver } from "./map-match.js";
import { type UpstreamTeamItem, mapTeamToCanonical } from "./map-team.js";
import type { UpstreamFixturesResponse } from "./upstream-types.js";

export type ApiFootballClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  resolveIds: IdResolver;
};

export class ApiFootballProvider implements FootballProvider {
  readonly name = "api-football";
  private quota: QuotaSnapshot | undefined;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: ApiFootballClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://v3.football.api-sports.io";
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
  }

  getQuota(): QuotaSnapshot | undefined {
    return this.quota;
  }

  async getMatch(internalId: string, externalId: string): Promise<Result<Match, AppError>> {
    try {
      const url = `${this.baseUrl}/fixtures?id=${encodeURIComponent(externalId)}`;
      const response = await this.fetchFn(url, {
        headers: { "x-apisports-key": this.options.apiKey },
      });
      this.quota = parseQuotaHeaders(response.headers, this.name, Date.now());

      if (response.status === 429) {
        return err(providerError("Provider rate limited", { status: 429 }));
      }
      if (!response.ok) {
        return err(providerError("Provider request failed", { status: response.status }));
      }

      const body = (await response.json()) as UpstreamFixturesResponse;
      const item = body.response?.[0];
      if (!item) {
        return err(providerError("Match not found upstream", { externalId }));
      }

      const match = await mapFixtureToMatch(item, internalId, this.options.resolveIds);
      return ok(match);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Provider transport error", { cause: message }));
    }
  }

  async getTeam(internalId: string, externalId: string): Promise<Result<Team, AppError>> {
    try {
      const url = `${this.baseUrl}/teams?id=${encodeURIComponent(externalId)}`;
      const response = await this.fetchFn(url, {
        headers: { "x-apisports-key": this.options.apiKey },
      });
      this.quota = parseQuotaHeaders(response.headers, this.name, Date.now());

      if (response.status === 429) {
        return err(providerError("Provider rate limited", { status: 429 }));
      }
      if (!response.ok) {
        return err(providerError("Provider request failed", { status: response.status }));
      }

      const body = (await response.json()) as { response?: UpstreamTeamItem[] };
      const item = body.response?.[0];
      if (!item) {
        return err(providerError("Team not found upstream", { externalId }));
      }

      const team = await mapTeamToCanonical(item, internalId, {
        venueId: async (id) => {
          const resolved = await this.options.resolveIds.venueId?.(id);
          return resolved;
        },
      });
      return ok(team);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err(providerError("Provider transport error", { cause: message }));
    }
  }
}
