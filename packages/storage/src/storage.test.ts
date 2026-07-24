import { objectKey } from "@football-api/core";
import { metaKey } from "@football-api/core";
import { describe, expect, it } from "vitest";
import { MemoryMetaStore, MemoryObjectStore } from "./memory.js";

describe("storage fakes", () => {
  it("writes object then swaps metadata pointer", async () => {
    const objects = new MemoryObjectStore();
    const meta = new MemoryMetaStore();
    const objectId = "11111111-1111-4111-8111-111111111111";
    const key = objectKey("match", objectId, 1);
    const body = new TextEncoder().encode(JSON.stringify({ id: objectId }));

    await objects.put(key, body);
    await meta.putJson(metaKey("match", objectId), {
      objectType: "match",
      objectId,
      freshnessClass: "live",
      controlState: "fresh",
      r2Key: key,
      generation: 1,
    });

    const stored = await objects.get(key);
    const pointer = await meta.getJson<{ r2Key: string; generation: number }>(
      metaKey("match", objectId),
    );
    expect(stored).not.toBeNull();
    expect(pointer?.r2Key).toBe(key);
    expect(pointer?.generation).toBe(1);
  });
});
