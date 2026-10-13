import { describe, expect, it } from "vitest";
import { parseRRule } from "./recurrence.js";

describe("recurrence parsing — Phase 11", () => {
  it("accepts bounded weekly recurrence with BYDAY and COUNT", () => {
    expect(parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=8")).toMatchObject({
      freq: "WEEKLY",
      interval: 2,
      byDay: [1, 3, 5],
      count: 8,
    });
  });
  it("normalizes invalid days and rejects unsupported frequencies", () => {
    expect(parseRRule("FREQ=MONTHLY;BYMONTHDAY=1,15,32")).toMatchObject({
      freq: "MONTHLY",
      byMonthDay: [1, 15],
    });
    expect(() => parseRRule("FREQ=SECONDLY")).toThrow("UNSUPPORTED_RECURRENCE_RULE");
  });
  it("parses UTC end dates without changing the calendar instant", () => {
    expect(parseRRule("FREQ=DAILY;UNTIL=20261231T230000Z")?.until?.toISOString())
      .toBe("2026-12-31T23:00:00.000Z");
  });
});
