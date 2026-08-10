import { describe, expect, it } from "vitest";
import { decideAccess, hostAllowed, isAccessGuardEnabled } from "./access.js";

const prod = { ENVIRONMENT: "production" };

function req(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://football-api.example${path}`, { headers });
}

describe("access guard", () => {
  it("is off outside production and when ACCESS_GUARD=off", () => {
    expect(isAccessGuardEnabled({})).toBe(false);
    expect(isAccessGuardEnabled({ ENVIRONMENT: "development" })).toBe(false);
    expect(isAccessGuardEnabled({ ENVIRONMENT: "production", ACCESS_GUARD: "off" })).toBe(
      false,
    );
    expect(isAccessGuardEnabled(prod)).toBe(true);
  });

  it("allows health without credentials", () => {
    expect(decideAccess(req("/health"), prod).allowed).toBe(true);
  });

  it("allows Dart app user-agent", () => {
    const d = decideAccess(req("/v1/projections/matches/live", { "user-agent": "Dart/3.11 (dart:io)" }), prod);
    expect(d).toEqual({ allowed: true, reason: "dart-app" });
  });

  it("allows verfutbollibre.net site Worker via cf-worker", () => {
    const d = decideAccess(req("/v1/teams/x", { "cf-worker": "verfutbollibre.net" }), prod);
    expect(d).toEqual({ allowed: true, reason: "cf-worker" });
  });

  it("rejects other cf-worker hosts by default", () => {
    const d = decideAccess(req("/v1/teams/x", { "cf-worker": "evil.example" }), prod);
    expect(d.allowed).toBe(false);
  });

  it("allows browser Origin/Referer from the site (media, client fetch)", () => {
    expect(
      decideAccess(
        req("/v1/media/teams/1.png", { origin: "https://verfutbollibre.net" }),
        prod,
      ).reason,
    ).toBe("origin");
    expect(
      decideAccess(
        req("/v1/media/teams/1.png", {
          referer: "https://www.verfutbollibre.net/partido/1",
        }),
        prod,
      ).reason,
    ).toBe("referer");
  });

  it("blocks random crawlers and bare curl", () => {
    expect(
      decideAccess(
        req("/v1/matches/x", {
          "user-agent":
            "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
        }),
        prod,
      ).allowed,
    ).toBe(false);
    expect(decideAccess(req("/v1/matches/x", { "user-agent": "curl/8.13.0" }), prod).allowed).toBe(
      false,
    );
    expect(decideAccess(req("/v1/matches/x"), prod).allowed).toBe(false);
  });

  it("allows admin-token header through (auth checked later)", () => {
    expect(
      decideAccess(req("/v1/id-maps", { "x-admin-token": "secret" }), prod).reason,
    ).toBe("admin-token");
  });

  it("hostAllowed matches apex and subdomains", () => {
    expect(hostAllowed("verfutbollibre.net", ["verfutbollibre.net"])).toBe(true);
    expect(hostAllowed("www.verfutbollibre.net", ["verfutbollibre.net"])).toBe(true);
    expect(hostAllowed("evilverfutbollibre.net", ["verfutbollibre.net"])).toBe(false);
  });
});
