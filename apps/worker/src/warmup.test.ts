import { describe, expect, it } from "vitest";
import { warmupModeForCron } from "./warmup.js";

describe("warmupModeForCron", () => {
  it("maps catalog cron to catalog mode", () => {
    expect(warmupModeForCron("0 */5 * * *")).toBe("catalog");
  });

  it("maps frequent cron to dates mode", () => {
    expect(warmupModeForCron("*/5 * * * *")).toBe("dates");
  });
});
