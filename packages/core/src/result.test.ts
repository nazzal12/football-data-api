import { describe, expect, it } from "vitest";
import { FrozenClock } from "./clock.js";
import { createId, isId } from "./ids.js";
import { err, isOk, map, ok, unwrapOr } from "./result.js";

describe("Result", () => {
  it("maps ok values", () => {
    const result = map(ok(2), (n) => n * 2);
    expect(isOk(result)).toBe(true);
    if (result.ok) expect(result.value).toBe(4);
  });

  it("unwrapOr uses fallback on err", () => {
    expect(unwrapOr(err("x"), 10)).toBe(10);
  });
});

describe("ids", () => {
  it("creates valid uuid v4", () => {
    const id = createId();
    expect(isId(id)).toBe(true);
  });
});

describe("FrozenClock", () => {
  it("advances time", () => {
    const clock = new FrozenClock("2026-01-01T00:00:00.000Z");
    clock.advance(5_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:05.000Z");
  });
});
