import { MS } from "@football-api/core";
import { describe, expect, it } from "vitest";
import { decide, matchPolicy, resolveControlState } from "./engine.js";

describe("lifecycle decide", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z");

  it("serves fresh objects", () => {
    const action = decide({
      meta: {
        objectType: "match",
        objectId: "m1",
        freshnessClass: "live",
        controlState: "fresh",
        softExpireAt: now + MS.MINUTE,
        r2Key: "k",
      },
      nowMs: now,
      policy: matchPolicy("live", now),
      hasServableObject: true,
      quotaAvailable: true,
    });
    expect(action).toEqual({ type: "serve", from: "r2", fillCache: true });
  });

  it("uses SWR when stale", () => {
    const action = decide({
      meta: {
        objectType: "match",
        objectId: "m1",
        freshnessClass: "live",
        controlState: "stale",
        softExpireAt: now - 1,
        r2Key: "k",
      },
      nowMs: now,
      policy: matchPolicy("live", now),
      hasServableObject: true,
      quotaAvailable: true,
    });
    expect(action.type).toBe("refresh");
    if (action.type === "refresh") expect(action.swr).toBe(true);
  });

  it("backs off on failed state", () => {
    const action = decide({
      meta: {
        objectType: "match",
        objectId: "m1",
        freshnessClass: "live",
        controlState: "failed",
        retryAfterAt: now + MS.MINUTE,
      },
      nowMs: now,
      policy: matchPolicy("live", now),
      hasServableObject: false,
      quotaAvailable: true,
    });
    expect(action).toEqual({ type: "error", reason: "failed_backoff" });
  });

  it("serves last-known when quota exhausted", () => {
    const action = decide({
      meta: {
        objectType: "match",
        objectId: "m1",
        freshnessClass: "live",
        controlState: "stale",
        r2Key: "k",
      },
      nowMs: now,
      policy: matchPolicy("live", now),
      hasServableObject: true,
      quotaAvailable: false,
    });
    expect(action.type).toBe("serve");
  });

  it("lazily marks soft-expired as stale", () => {
    const state = resolveControlState(
      {
        objectType: "match",
        objectId: "m1",
        freshnessClass: "future",
        controlState: "fresh",
        softExpireAt: now - 1,
      },
      now,
    );
    expect(state).toBe("stale");
  });

  it("shrinks future TTL near kickoff", () => {
    const far = matchPolicy("future", now, now + 2 * MS.DAY);
    const near = matchPolicy("future", now, now + 30 * MS.MINUTE);
    expect(near.softTtlMs).toBeLessThan(far.softTtlMs);
  });
});
