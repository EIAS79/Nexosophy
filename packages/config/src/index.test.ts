import { describe, expect, it } from "vitest";

import {
  parseApiEnv,
  parseOptionalClerkEnv,
  parseRealtimeEnv,
  parseWorkerEnv,
} from "./index.js";

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

  it("treats a fully absent Clerk configuration as disabled", () => {
    expect(parseOptionalClerkEnv({})).toBeNull();
  });

  it("rejects partially configured Clerk credentials", () => {
    expect(() =>
      parseOptionalClerkEnv({
        CLERK_SECRET_KEY: "sk_test_partial",
      }),
    ).toThrow();
  });

  it("parses and normalizes authorized Clerk parties", () => {
    const clerk = parseOptionalClerkEnv({
      CLERK_SECRET_KEY: "sk_test_example",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_JWT_KEY: "-----BEGIN PUBLIC KEY-----example-----END PUBLIC KEY-----",
      CLERK_WEBHOOK_SIGNING_SECRET: "whsec_example",
      CLERK_AUTHORIZED_PARTIES:
        "https://nexosophy.com, http://localhost:3000",
    });

    expect(clerk?.CLERK_AUTHORIZED_PARTIES).toEqual([
      "https://nexosophy.com",
      "http://localhost:3000",
    ]);
  });
});
