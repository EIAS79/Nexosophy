import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const env = {
  NODE_ENV: "test",
  APP_ENV: "local",
  LOG_LEVEL: "silent",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/nexosophy",
  REDIS_URL: "redis://127.0.0.1:6379",
} as const;

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));

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
});
