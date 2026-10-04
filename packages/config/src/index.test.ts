import { describe, expect, it } from "vitest";

import { parseApiEnv, parseRealtimeEnv, parseWorkerEnv } from "./index.js";

const base = {
  NODE_ENV: "test",
  APP_ENV: "local",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://user:password@localhost:5432/nexosophy",
  REDIS_URL: "redis://localhost:6379",
} as const;

describe("environment configuration", () => {
  it("parses API defaults", () => {
    const env = parseApiEnv(base);

    expect(env.API_HOST).toBe("0.0.0.0");
    expect(env.API_PORT).toBe(4000);
  });

  it("parses worker defaults", () => {
    const env = parseWorkerEnv(base);

    expect(env.WORKER_CONCURRENCY).toBe(5);
    expect(env.WORKER_HEALTH_PORT).toBe(4200);
  });

  it("parses realtime defaults", () => {
    const env = parseRealtimeEnv(base);

    expect(env.REALTIME_PORT).toBe(4100);
  });

  it("rejects a missing database URL", () => {
    expect(() =>
      parseApiEnv({
        ...base,
        DATABASE_URL: undefined,
      }),
    ).toThrow();
  });
});
