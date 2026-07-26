import type { AppError, Result } from "@football-api/core";
import { notFoundError, ok } from "@football-api/core";
import type { Match } from "@football-api/domain";
import type { FootballProvider, QuotaSnapshot } from "./port.js";

export class FakeFootballProvider implements FootballProvider {
  readonly name = "fake";
  callCount = 0;
  private quota: QuotaSnapshot | undefined;
  private readonly matches = new Map<string, Match>();
  private readonly matchesByDate = new Map<string, string[]>();
  private delayMs = 0;
  private error: AppError | null = null;

  setMatch(externalId: string, match: Match): void {
    this.matches.set(externalId, match);
  }

  setMatchesByDate(date: string, externalIds: string[]): void {
    this.matchesByDate.set(date, externalIds);
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  setError(error: AppError | null): void {
    this.error = error;
  }

  setQuota(quota: QuotaSnapshot | undefined): void {
    this.quota = quota;
  }

  getQuota(): QuotaSnapshot | undefined {
    return this.quota;
  }

  async getMatch(_internalId: string, externalId: string): Promise<Result<Match, AppError>> {
    this.callCount += 1;
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    if (this.error) return { ok: false, error: this.error };
    const match = this.matches.get(externalId);
    if (!match) {
      return { ok: false, error: notFoundError("Match not found in fake provider") };
    }
    return ok(match);
  }

  async listMatchExternalIdsByDate(date: string): Promise<Result<string[], AppError>> {
    this.callCount += 1;
    if (this.error) return { ok: false, error: this.error };
    return ok(this.matchesByDate.get(date) ?? []);
  }
}
