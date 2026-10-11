import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "./app.js";

// API foundation tests exercise route wiring without requiring an external Redis server.
vi.mock("redis", () => ({
  createClient: () => ({
    isOpen: true,
    on: () => undefined,
    connect: async () => undefined,
    ping: async () => "PONG",
    eval: async () => [1, 60],
    quit: async () => undefined,
  }),
}));

const env = {
  NODE_ENV: "test",
  APP_ENV: "local",
  LOG_LEVEL: "silent",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  DB_POOL_MAX: 10,
  DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/nexosophy",
  REDIS_URL: "redis://127.0.0.1:6379",
} as const;

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API foundation", () => {
  it("returns a typed liveness response without requiring dependencies", async () => {
    const app = await buildApp(env);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-request-id": "phase-00-health",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "api",
      status: "ok",
      requestId: "phase-00-health",
    });
  });

  it("normalizes unknown routes", async () => {
    const app = await buildApp(env);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/does-not-exist",
      headers: {
        "x-request-id": "phase-00-not-found",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found.",
        requestId: "phase-00-not-found",
      },
    });
  });

  it("keeps identity routes closed when no auth verifier is configured", async () => {
    const app = await buildApp(env);
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: {
        "x-request-id": "phase-02-no-auth",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
        requestId: "phase-02-no-auth",
      },
    });
  });
});
