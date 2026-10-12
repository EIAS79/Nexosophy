/* Browser-level smoke test against a deployed Nexosophy frontend.
 * Run manually in the staging workflow. Never use production credentials.
 * The optional test account must be isolated and disposable.
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const staging = process.env.AUTH_STAGING_URL;
  if (!staging) throw new Error("AUTH_STAGING_URL is required. No browser tests were run.");
  const url = new URL(staging);
  if (url.protocol !== "https:") throw new Error("Staging must use HTTPS.");
  const origin = url.origin;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: false });
  const page = await context.newPage();
  try {
    // A Vercel share link may set a cookie before the browser visits the protected preview.
    await page.goto(staging, { waitUntil: "domcontentloaded" });
    await page.goto(origin + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
    await page.getByRole("button", { name: "Sign in with a passkey" }).waitFor();
    await page.getByRole("link", { name: /create an account/i }).waitFor();

    await page.goto(origin + "/signup", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Create your account" }).waitFor();
    const password = page.locator('input[name="password"]');
    assert.equal(await password.getAttribute("minlength"), "12");

    await page.goto(origin + "/app", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/login(?:\/|\?|$)/);
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();

    const response = await context.request.get(origin + "/api/auth/get-session");
    assert.equal(response.status(), 200, "Anonymous auth endpoint must respond.");
    assert.match(response.headers()["cache-control"] || "", /no-store/i);
    assert.equal(await response.json(), null, "Guest must not have a session.");

    await page.getByRole("button", { name: "Forgot password?" }).click();
    await page.getByRole("heading", { name: "Recover your account" }).waitFor();

    if (process.env.AUTH_SMOKE_EMAIL && process.env.AUTH_SMOKE_PASSWORD) {
      await page.getByRole("button", { name: "Back to sign in" }).click();
      await page.locator('input[name="email"]').fill(process.env.AUTH_SMOKE_EMAIL);
      await page.locator('input[name="password"]').fill(process.env.AUTH_SMOKE_PASSWORD);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(/\/app(?:\/|\?|$)/, { timeout: 15000 });
      // This test account must not have TOTP enabled; MFA is exercised separately.
      await page.getByRole("heading", { name: /knowledge, in context/i }).waitFor();
    }
    console.log("Staging browser smoke checks passed.");
  } finally {
    await browser.close();
  }
})().catch((cause) => {
  console.error(cause);
  process.exitCode = 1;
});
