import { idMapKey } from "@football-api/core";
import { MemoryMetaStore } from "@football-api/storage";
import { describe, expect, it } from "vitest";
import { PersistentIdResolver } from "./ids.js";

class CountingMeta extends MemoryMetaStore {
  gets = 0;
  puts = 0;

  override async get(key: string): Promise<string | null> {
    this.gets += 1;
    return super.get(key);
  }

  override async put(key: string, value: string): Promise<void> {
    this.puts += 1;
    return super.put(key, value);
  }
}

describe("PersistentIdResolver packs", () => {
  it("maps hundreds of teams with a handful of KV ops", async () => {
    const meta = new CountingMeta();
    const resolver = new PersistentIdResolver(meta);

    const ids = new Set<string>();
    for (let i = 1; i <= 200; i += 1) {
      ids.add(await resolver.ensure("team", i));
    }
    await resolver.flush();

    expect(ids.size).toBe(200);
    expect(meta.gets).toBeLessThanOrEqual(4);
    expect(meta.puts).toBeLessThanOrEqual(4);

    const again = new PersistentIdResolver(meta);
    expect(await again.ensure("team", 1)).toBe([...ids][0]);
    expect(await again.toExternal([...ids][0] as string)).toBe("1");
  });

  it("round-trips bind through flush", async () => {
    const meta = new MemoryMetaStore();
    const resolver = new PersistentIdResolver(meta);
    await resolver.bind("match", "1208021", "074db8fe-cb0b-4cc4-b1fd-6ae0f0ed3c68");
    await resolver.flush();

    const loaded = new PersistentIdResolver(meta);
    expect(await loaded.toInternal("match", "1208021")).toBe(
      "074db8fe-cb0b-4cc4-b1fd-6ae0f0ed3c68",
    );
    expect(await loaded.toExternal("074db8fe-cb0b-4cc4-b1fd-6ae0f0ed3c68")).toBe("1208021");
    expect(idMapKey("api-football", "pack", "match")).toBe("idmap:api-football:pack:match");
  });

  it("coalesces parallel ensure() into one KV get per pack", async () => {
    const meta = new CountingMeta();
    const resolver = new PersistentIdResolver(meta);
    await Promise.all(Array.from({ length: 40 }, (_, i) => resolver.ensure("team", i + 1)));
    await resolver.flush();
    expect(meta.gets).toBeLessThanOrEqual(4);
    expect(meta.puts).toBeLessThanOrEqual(4);
  });
});
