import { describe, expect, it } from "vitest";

import { canAuthenticateInternalAccount, safeReturnTo } from "./index.js";

describe("safeReturnTo", () => {
  it("preserves internal relative paths", () => {
    expect(safeReturnTo("/app/notes?from=search#result")).toBe(
      "/app/notes?from=search#result",
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "javascript:alert(1)",
    "data:text/html,hello",
    "/app\\evil",
    "/app\nSet-Cookie:bad",
  ])("rejects unsafe return target %s", (value) => {
    expect(safeReturnTo(value)).toBe("/app");
  });
});

describe("internal account authentication state", () => {
  it.each(["pending_onboarding", "active", "deletion_requested"] as const)(
    "allows %s to maintain an authenticated session",
    (state) => {
      expect(canAuthenticateInternalAccount(state)).toBe(true);
    },
  );

  it.each(["suspended", "deletion_pending", "deleted"] as const)(
    "denies %s even if the external provider still has a valid session",
    (state) => {
      expect(canAuthenticateInternalAccount(state)).toBe(false);
    },
  );
});
