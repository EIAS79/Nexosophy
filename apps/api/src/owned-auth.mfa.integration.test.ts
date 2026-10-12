import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createNexosophyAuth } from "./owned-auth.js";

const enabled = Boolean(process.env.DATABASE_URL) && process.env.RUN_OWNED_AUTH_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of input.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error("Invalid base32 authenticator secret");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret");
  if (!secret) throw new Error("Authenticator URI omitted secret");
  const counter = Math.floor(Date.now() / 30_000);
  const data = Buffer.alloc(8);
  data.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(data).digest();
  const offset = digest.at(-1)! & 0xf;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function cookieString(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

suite("Nexosophy owned MFA / real PostgreSQL", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const origin = "http://localhost:3000";
  const links = new Map<string, string>();
  const auth = createNexosophyAuth(
    pool,
    {
      APP_ENV: "local",
      NODE_ENV: "test",
      NEXOSOPHY_AUTH_SECRET: "mfa-postgres-integration-secret-not-for-prod-12345",
      NEXOSOPHY_AUTH_URL: origin,
      NEXOSOPHY_AUTH_TRUSTED_ORIGINS: origin,
    },
    async (email, _subject, link) => {
      links.set(email, link);
    },
  );

  beforeAll(async () => {
    const row = await pool.query<{ installed: string | null }>(
      `select to_regclass('public."twoFactor"')::text as installed`,
    );
    if (!row.rows[0]?.installed) throw new Error("Auth MFA migration missing");
    await pool.query('delete from "rateLimit"');
  });
  afterAll(async () => pool.end());

  async function send(path: string, body?: Record<string, unknown>, cookie?: string) {
    return auth.handler(
      new Request(origin + path, {
        method: body ? "POST" : "GET",
        headers: {
          origin,
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "manual",
      }),
    );
  }

  it("enrolls an authenticator, enforces a second factor and accepts a recovery code", async () => {
    const email = "mfa-" + randomUUID() + "@example.net";
    const password = "MFA-integration-password-2026!";
    expect(
      (await send("/api/auth/sign-up/email", { email, password, name: "MFA Test Account" })).status,
    ).toBe(200);
    const link = links.get(email);
    expect(link).toBeTruthy();
    const verify = await auth.handler(
      new Request(link!, { headers: { origin }, redirect: "manual" }),
    );
    expect([200, 302, 303]).toContain(verify.status);

    const signIn = await send("/api/auth/sign-in/email", { email, password });
    expect(signIn.status).toBe(200);
    const cookie = cookieString(signIn);
    expect(cookie).toContain("session_token");

    const enroll = await send("/api/auth/two-factor/enable", { password, method: "totp" }, cookie);
    expect(enroll.status).toBe(200);
    const enrollment = (await enroll.json()) as {
      method?: string;
      totpURI?: string;
      backupCodes?: string[];
    };
    expect(enrollment.method).toBe("totp");
    expect(enrollment.totpURI).toContain("otpauth://totp/");
    expect(enrollment.backupCodes?.length).toBeGreaterThan(0);

    const confirm = await send(
      "/api/auth/two-factor/verify-totp",
      { code: totp(enrollment.totpURI!) },
      cookie,
    );
    expect(confirm.status).toBe(200);

    expect((await send("/api/auth/sign-out", {}, cookie)).status).toBe(200);
    await pool.query('delete from "rateLimit"');

    const challenge = await send("/api/auth/sign-in/email", { email, password });
    expect(challenge.status).toBe(200);
    const challengeBody = (await challenge.json()) as { twoFactorRedirect?: boolean };
    expect(challengeBody.twoFactorRedirect).toBe(true);
    const secondCookie = cookieString(challenge);
    const failedSession = await send("/api/auth/get-session", undefined, secondCookie);
    expect(await failedSession.json()).toBeNull();

    const recover = await send(
      "/api/auth/two-factor/verify-backup-code",
      {
        code: enrollment.backupCodes![0],
      },
      secondCookie,
