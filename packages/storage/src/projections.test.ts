import { createId } from "@football-api/core";
import { describe, expect, it } from "vitest";
import {
  MemoryMetaStore,
  MemoryObjectStore,
  cacheMaxAgeForPhase,
  getMatchListProjection,
  putMatchListProjection,
} from "./index.js";

describe("projections", () => {
  it("stores and loads match list projection", async () => {
    const objects = new MemoryObjectStore();
    const meta = new MemoryMetaStore();
    const ids = [createId(), createId()];
    const projectionId = createId();
    await putMatchListProjection(objects, meta, {
      projectionId,
      key: "date:2026-01-01",
      matchIds: ids,
    });
    const loaded = await getMatchListProjection(objects, meta, "date:2026-01-01");
    expect(loaded?.matchIds).toEqual(ids);
  });

  it("exposes cache TTL hints by phase", () => {
    expect(cacheMaxAgeForPhase("live")).toBeLessThan(cacheMaxAgeForPhase("historical"));
  });
});
