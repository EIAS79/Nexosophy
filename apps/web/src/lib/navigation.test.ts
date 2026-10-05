import { describe, expect, it } from "vitest";

import { appNavigation, mobileNavigation, publicNavigation } from "./navigation";

describe("navigation contracts", () => {
  it("keeps public navigation links unique", () => {
    expect(new Set(publicNavigation.map((item) => item.href)).size).toBe(publicNavigation.length);
  });

  it("keeps application navigation links unique", () => {
    expect(new Set(appNavigation.map((item) => item.href)).size).toBe(appNavigation.length);
  });

  it("limits phone bottom navigation to five primary destinations", () => {
    expect(mobileNavigation.length).toBeLessThanOrEqual(5);
  });
});
