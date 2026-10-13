import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createNexosophyAuth } from "./owned-auth.js";

const pool = new Pool({ connectionString: "postgresql://127.0.0.1:5432/nexosophy_test" });
afterAll(async () => pool.end());

const basicConfig = {
  NODE_ENV: "test",
  APP_ENV: "local",
  NEXOSOPHY_AUTH_SECRET: "test-isolation-secret-replace-in-runtime-123456789",
  NEXOSOPHY_AUTH_URL: "http://localhost:3000",
};

describe("Nexosophy-owned auth environment", () => {
  it("rejects missing or insufficiently long secrets", () => {
    expect(() => createNexosophyAuth(pool, { ...basicConfig, NEXOSOPHY_AUTH_SECRET: "" })).toThrow(
      "auth secret",
    );
  });

  it("rejects an incomplete social login provider registration", () => {
    expect(() =>
      createNexosophyAuth(pool, { ...basicConfig, GOOGLE_CLIENT_ID: "client-id-only" }),
    ).toThrow("GOOGLE OAuth requires");
  });

  it("rejects a non-HTTPS external staging auth origin", () => {
    expect(() =>
      createNexosophyAuth(pool, { ...basicConfig, NODE_ENV: "production", APP_ENV: "staging" }),
    ).toThrow("requires HTTPS");
  });

  it("rejects insecure trusted origins in protected environments", () => {
    expect(() =>
      createNexosophyAuth(pool, {
        ...basicConfig,
        APP_ENV: "staging",
        NODE_ENV: "production",
        NEXOSOPHY_AUTH_URL: "https://auth.nexosophy.test",
        NEXOSOPHY_AUTH_TRUSTED_ORIGINS: "https://nexosophy.test,http://unsecured.nexosophy.test",
      }),
    ).toThrow("require HTTPS");
  });

  it("accepts a restricted same-origin test configuration without provider keys", () => {
    const auth = createNexosophyAuth(pool, basicConfig);
    expect(typeof auth.handler).toBe("function");
  });
});
