/* Domain-free, real Chromium + PostgreSQL authentication acceptance.
 * CI hosts both services on loopback; test users are disposable.
 */
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { chromium } = require("playwright");

const origin = "http://localhost:3000";
const password = process.env.AUTH_TEST_PASSWORD;
const { Pool } = require("../apps/api/node_modules/pg");

async function resetDisposableRateLimits() {
  // All browser actors share one loopback IP. Keep real production rate limiting enabled,
  // while clearing local-only counters between independent acceptance scenarios.
  if (
    process.env.AUTH_LOCAL_E2E !== "1" ||
    process.env.APP_ENV !== "local" ||
    process.env.NODE_ENV !== "test" ||
    !process.env.DATABASE_URL?.includes("127.0.0.1:5432/nexosophy")
  ) throw new Error("Refusing to clear non-disposable rate-limit records.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query('delete from "rateLimit"');
  } finally {
    await pool.end();
  }
}

if (process.env.AUTH_LOCAL_E2E !== "1" || !password) {
  throw new Error("Local-only browser test must be explicitly enabled.");
}

function currentTotp(uri) {
  const secret = new URL(uri).searchParams.get("secret");
  assert.ok(secret, "TOTP provisioning URI must contain a test secret");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes = [];
  for (const letter of secret.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(letter);
    assert.ok(digit >= 0);
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const n = digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff;
  return String(n % 1_000_000).padStart(6, "0");
}

async function session(context) {
  const res = await context.request.get(origin + "/api/auth/get-session");
  assert.equal(res.status(), 200, "Same-origin session proxy must respond");
  assert.match(res.headers()["cache-control"] || "", /no-store/);
  return await res.json();
}

async function login(page, email) {
  await page.goto(origin + "/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function finishOnboarding(page) {
  await page.waitForURL(/\/(?:onboarding|app)(?:\?|$)/);
  if (new URL(page.url()).pathname === "/onboarding") {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL(/\/app(?:\?|$)/);
  }
}

async function signout(context) {
  const response = await context.request.post(origin + "/api/auth/sign-out", {
    data: {},
    headers: { origin },
  });
  assert.equal(response.status(), 200, "Logout API response");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const guest = await browser.newContext();
    const page = await guest.newPage();
    await page.goto(origin + "/app");
    await page.waitForURL(/\/login(?:\?|$)/);
    assert.equal(await session(guest), null);
    await page.goto(origin + "/signup");
    const button = page.getByRole("button", { name: "Create account" });
    await button.waitFor();
    assert.equal(await button.isDisabled(), true, "Unconfigured email delivery must fail closed");
    assert.equal(await page.getByRole("button", { name: "Google", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "GitHub", exact: true }).count(), 0);
    await guest.close();
    console.log("PASS guest guard, no-store sessions, unavailable signup and OAuth providers");

    const first = await browser.newContext();
    const p1 = await first.newPage();
    await login(p1, "first@local.nexosophy.test");
    await p1.waitForURL(/\/(?:onboarding|app)(?:\?|$)/);
    assert.ok((await session(first))?.session?.id, "Password login must issue session");
    if (p1.url().includes("/onboarding")) {
      await p1.getByRole("button", { name: "Skip for now" }).click();
      await p1.waitForURL(/\/app(?:\?|$)/);
    }
    await p1.goto(origin + "/settings/security");
    await p1.getByRole("heading", { name: "Session and device security" }).waitFor();
    console.log("PASS password login, authenticated navigation and onboarding");

    const second = await browser.newContext();
    const p2 = await second.newPage();
    await login(p2, "first@local.nexosophy.test");
    await p2.waitForURL(/\/(?:onboarding|app)(?:\?|$)/);
    assert.ok((await session(second))?.session?.id, "Second browser must get own session");
    await p1.getByRole("button", { name: "Sign out other devices" }).click();
    await p1.getByText("Other devices have been signed out.").waitFor();
    assert.equal(await session(second), null, "Revoked second browser must lose session");
    assert.ok((await session(first))?.session?.id, "Current browser must remain active");
    await second.close();
    console.log("PASS multi-session isolation and revoke-other");
    await resetDisposableRateLimits();

    const cdp = await first.newCDPSession(p1);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    const passkeyHttp = [];
    p1.on("response", async (response) => {
      if (response.url().includes("/api/auth/passkey/")) {
        let details = "";
        try {
          if (!response.ok()) {
            const data = await response.json();
            details = JSON.stringify({ code: data.code, message: data.message }).slice(0, 300);
          }
        } catch {
          details = "non-json response";
        }
        passkeyHttp.push({ route: new URL(response.url()).pathname, status: response.status(), details });
      }
    });
    await p1.getByRole("button", { name: "Register a passkey" }).click();
    try {
      await p1.getByText("Passkey registered.").waitFor({ timeout: 8000 });
    } catch (error) {
      const ui = await p1.locator(".settings-panel [role=status]").allTextContents();
      console.error("Passkey registration diagnostics", { ui, passkeyHttp });
      throw error;
    }
    await signout(first);
    assert.equal(await session(first), null, "Logout must revoke current browser");
    await p1.goto(origin + "/login");
    await p1.getByRole("button", { name: "Sign in with a passkey" }).click();
    await p1.waitForURL(/\/app(?:\?|$)/, { timeout: 15000 });
    assert.ok((await session(first))?.session?.id, "Virtual WebAuthn must authenticate");
    console.log("PASS real Chromium virtual WebAuthn enrollment and passkey sign-in");
    await resetDisposableRateLimits();

    const totpContext = await browser.newContext();
    const totpPage = await totpContext.newPage();
    await login(totpPage, "second@local.nexosophy.test");
    await totpPage.waitForURL(/\/(?:onboarding|app)(?:\?|$)/);
    await totpPage.goto(origin + "/settings/security");
    await totpPage.getByRole("heading", { name: "Authenticator app (TOTP)" }).waitFor();
    await totpPage.getByLabel("Current password").fill(password);
    await totpPage.getByRole("button", { name: "Set up two-factor authentication" }).click();
    await totpPage.getByText(/otpauth:\/\/totp\//).waitFor();
    const uri = await totpPage.locator("code").filter({ hasText: "otpauth://totp/" }).first().innerText();
    const backupCodes = await totpPage.locator("code").allTextContents();
    const backup = backupCodes.find((item) => !item.startsWith("otpauth://"));
    assert.ok(backup, "TOTP enrollment must provide recovery codes");
    await totpPage.getByLabel("Authenticator code").fill(currentTotp(uri));
    await totpPage.getByRole("button", { name: "Verify authenticator" }).click();
    await totpPage.getByText("Authenticator verified.").waitFor();
    await signout(totpContext);
    await resetDisposableRateLimits();
    const credentialReplies = [];
    totpPage.on("response", async (reply) => {
      if (new URL(reply.url()).pathname === "/api/auth/sign-in/email") {
        try {
          const data = await reply.json();
          credentialReplies.push({
            status: reply.status(),
            twoFactorRedirect: data.twoFactorRedirect === true,
            hasSession: Boolean(data.token),
            errorCode: data.code || null,
          });
        } catch {
          credentialReplies.push({ status: reply.status(), nonJson: true });
        }
      }
    });
    await login(totpPage, "second@local.nexosophy.test");
    try {
      await totpPage.getByRole("heading", { name: "Verify your authenticator" }).waitFor({ timeout: 5000 });
    } catch (error) {
      console.error("MFA challenge browser diagnostics", {
        route: new URL(totpPage.url()).pathname,
        headings: await totpPage.locator("h1,h2").allTextContents(),
        alerts: await totpPage.getByRole("alert").allTextContents(),
        credentialReplies,
        authenticated: Boolean((await session(totpContext))?.session?.id),
      });
      throw error;
    }
    assert.equal(await session(totpContext), null, "Password alone must not issue MFA session");
    await totpPage.getByLabel("6-digit authenticator code").fill(currentTotp(uri));
    await totpPage.getByRole("button", { name: "Verify and continue" }).click();
    await finishOnboarding(totpPage);
    assert.ok((await session(totpContext))?.session?.id, "TOTP must complete login");
    console.log("PASS browser TOTP enrollment, challenge and session gate");

    await signout(totpContext);
    await resetDisposableRateLimits();
    await login(totpPage, "second@local.nexosophy.test");
    await totpPage.getByRole("heading", { name: "Verify your authenticator" }).waitFor();
    await totpPage.getByRole("button", { name: "Use a recovery code instead" }).click();
    await totpPage.getByLabel("One-time recovery code").fill(backup);
    await totpPage.getByRole("button", { name: "Use recovery code" }).click();
    await finishOnboarding(totpPage);
    assert.ok((await session(totpContext))?.session?.id, "Recovery code must complete login");
    await totpContext.close();
    console.log("PASS browser one-time MFA recovery code");

    await p1.goto(origin + "/settings/security");
    await p1.getByRole("button", { name: "Sign out everywhere" }).click();
    await p1.getByText("All sessions revoked. Please sign in again.").waitFor();
    assert.equal(await session(first), null, "Global revoke must invalidate current login");
    await first.close();
    console.log("PASS global session revocation; Stage 1 local Chromium flows passed");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
