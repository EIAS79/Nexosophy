import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { createDatabaseIdentityStore } from "./auth-store-adapter.js";
import { createNexosophyAuth } from "./owned-auth.js";
import { createOwnedIdentityProvider } from "./owned-identity-provider.js";
import { createInternalAuthVerifier } from "@nexosophy/auth";

const connectionString = process.env.DATABASE_URL;
const suite =
  process.env.RUN_OWNED_AUTH_INTEGRATION === "1" && connectionString ? describe : describe.skip;

suite("Nexosophy owned auth / real PostgreSQL integration", () => {
  const pool = new Pool({ connectionString, max: 3 });
  const sentLinks = new Map<string, string>();
  const origin = "http://localhost:3000";
  const auth = createNexosophyAuth(
    pool,
    {
      APP_ENV: "local",
      NODE_ENV: "test",
      NEXOSOPHY_AUTH_SECRET: "only-for-the-test-run-not-production-1234567890",
      NEXOSOPHY_AUTH_URL: origin,
      NEXOSOPHY_AUTH_TRUSTED_ORIGINS: origin,
    },
    async (recipient, _subject, link) => {
      sentLinks.set(recipient, link);
    },
  );
  const verifier = createInternalAuthVerifier(
    createOwnedIdentityProvider(auth, pool),
    createDatabaseIdentityStore(pool),
  );

  beforeAll(async () => {
    const exists = await pool.query<{ present: string | null }>(
      "select to_regclass('public.user')::text as present",
    );
    if (!exists.rows[0]?.present) {
      throw new Error(
        "Auth migration is missing; apply database migrations before auth integration.",
      );
    }
  });
  afterAll(async () => pool.end());

  const request = async (
    pathname: string,
    method: "POST" | "GET",
    body?: Record<string, unknown>,
    cookie?: string,
  ) =>
    auth.handler(
      new Request(new URL(pathname, origin), {
        method,
        headers: {
          origin,
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "manual",
      }),
    );

  it("verifies email before issuing a usable session, then revokes it", async () => {
    const email = `auth-${randomUUID()}@example.net`;
    const password = "long-local-only-test-password-123!";
    const signup = await request("/api/auth/sign-up/email", "POST", {
      email,
      password,
      name: "Nexosophy Integration Tester",
    });
    expect(signup.status).toBe(200);
    expect(sentLinks.has(email)).toBe(true);

    const prematureLogin = await request("/api/auth/sign-in/email", "POST", { email, password });
    expect(prematureLogin.status).toBeGreaterThanOrEqual(400);

    const verified = await auth.handler(
      new Request(sentLinks.get(email)!, {
        method: "GET",
        headers: { origin },
        redirect: "manual",
      }),
    );
    expect([200, 302, 303]).toContain(verified.status);

    const login = await request("/api/auth/sign-in/email", "POST", { email, password });
    expect(login.status).toBe(200);
    const cookie = login.headers
      .getSetCookie()
      .map((item) => item?.split(";")[0] ?? "")
      .filter((item) => item.includes("session_token"))
      .join("; ");
    expect(cookie).toContain("session_token");

    const principal = await verifier.verify(
      new Request(origin + "/v1/me", { headers: { cookie } }),
    );
    expect(principal.authenticated).toBe(true);
    if (!principal.authenticated) return;
    expect(principal.principal.internalUserId).toMatch(/^[0-9a-f-]{36}$/);
    expect(principal.principal.providerUserId).not.toBe(principal.principal.internalUserId);

    const lookup = await verifier.verify(new Request(origin + "/v1/me", { headers: { cookie } }));
    expect(lookup.authenticated).toBe(true);
    if (lookup.authenticated) {
      expect(lookup.principal.internalUserId).toBe(principal.principal.internalUserId);
    }

    const revoke = await request("/api/auth/sign-out", "POST", {}, cookie);
    expect(revoke.status).toBe(200);

    const denied = await verifier.verify(new Request(origin + "/v1/me", { headers: { cookie } }));
    expect(denied.authenticated).toBe(false);
  });
  it("keeps independently verified users and sessions isolated", async () => {
    // Rate-limit counters for previous independent test actors must not bleed into this test.
    await pool.query('delete from "rateLimit"');
    async function register(email: string) {
      const password = "isolation-integration-only-test-password-2026!";
      const signup = await request("/api/auth/sign-up/email", "POST", {
        email,
        password,
        name: "Independent Test User",
      });
      expect(signup.status).toBe(200);
      const link = sentLinks.get(email);
      expect(link).toBeDefined();
      const verified = await auth.handler(
        new Request(link!, { method: "GET", headers: { origin }, redirect: "manual" }),
      );
      expect([200, 302, 303]).toContain(verified.status);
      const login = await request("/api/auth/sign-in/email", "POST", { email, password });
      expect(login.status).toBe(200);
      const cookie = login.headers
        .getSetCookie()
        .map((item) => item?.split(";")[0] ?? "")
        .filter((item) => item.includes("session_token"))
        .join("; ");
      expect(cookie).toContain("session_token");
      const result = await verifier.verify(new Request(origin + "/v1/me", { headers: { cookie } }));
      expect(result.authenticated).toBe(true);
      if (!result.authenticated) throw new Error("Test account has no session");
      return { cookie, internalUserId: result.principal.internalUserId };
    }

    const first = await register("first-" + randomUUID() + "@example.net");
    await pool.query('delete from "rateLimit"');
    const second = await register("second-" + randomUUID() + "@example.net");
    expect(first.internalUserId).not.toBe(second.internalUserId);

    const signedOut = await request("/api/auth/sign-out", "POST", {}, first.cookie);
    expect(signedOut.status).toBe(200);
    expect(
      (
        await verifier.verify(
          new Request(origin + "/v1/me", {
            headers: { cookie: first.cookie },
          }),
        )
      ).authenticated,
    ).toBe(false);
    const unaffected = await verifier.verify(
      new Request(origin + "/v1/me", {
        headers: { cookie: second.cookie },
      }),
    );
    expect(unaffected.authenticated).toBe(true);
    if (unaffected.authenticated) {
      expect(unaffected.principal.internalUserId).toBe(second.internalUserId);
    }
  });
});
