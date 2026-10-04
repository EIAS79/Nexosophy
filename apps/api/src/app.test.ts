import { describe, expect, it } from "vitest";

describe("API foundation", () => {
  it("keeps the phase-00 service name stable", () => {
    expect("nexosophy-api").toBe("nexosophy-api");
  });
});
