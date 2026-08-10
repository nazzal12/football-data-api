import { describe, expect, it } from "vitest";
import {
  mapLeaguesSearchHits,
  mapPlayerProfilesSearchHits,
  mapTeamsSearchHits,
} from "./map-search.js";

describe("map-search", () => {
  it("maps team hits", () => {
    const hits = mapTeamsSearchHits({
      response: [
        { team: { id: 33, name: "Manchester United", logo: "https://example.com/mu.png" } },
        { team: { id: 1 } },
      ],
    });
    expect(hits).toEqual([
      {
        type: "team",
        externalId: "33",
        displayName: "Manchester United",
        logoUrl: "https://example.com/mu.png",
      },
    ]);
  });

  it("maps league and player hits", () => {
    expect(
      mapLeaguesSearchHits({
        response: [{ league: { id: 39, name: "Premier League" } }],
      }),
    ).toEqual([
      { type: "competition", externalId: "39", displayName: "Premier League" },
    ]);
    expect(
      mapPlayerProfilesSearchHits({
        response: [{ player: { id: 276, name: "Neymar", photo: "https://example.com/n.png" } }],
      }),
    ).toEqual([
      {
        type: "player",
        externalId: "276",
        displayName: "Neymar",
        logoUrl: "https://example.com/n.png",
      },
    ]);
  });
});
