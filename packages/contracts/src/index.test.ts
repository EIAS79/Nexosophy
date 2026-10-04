import { describe, expect, it } from "vitest";

import { apiErrorSchema, healthResponseSchema } from "./index.js";

describe("shared API contracts", () => {
  it("accepts a valid health response", () => {
    const parsed = healthResponseSchema.parse({
      service: "api",
      status: "ok",
      version: "0.0.0",
      timestamp: "2026-10-04T09:30:00.000Z",
      requestId: "req-1",
    });

    expect(parsed.status).toBe("ok");
  });

  it("rejects an unknown service status", () => {
    expect(() =>
      healthResponseSchema.parse({
        service: "api",
        status: "unknown",
        version: "0.0.0",
        timestamp: "2026-10-04T09:30:00.000Z",
      }),
    ).toThrow();
  });

  it("requires a stable machine-readable error code", () => {
    const parsed = apiErrorSchema.parse({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
        requestId: "req-2",
      },
    });

    expect(parsed.error.code).toBe("VALIDATION_ERROR");
  });
});
