/** Creates disposable verified users exclusively in local CI.
 * No mail is sent. This program must NEVER run against staging/production.
 */
import { Pool } from "pg";
import { createNexosophyAuth } from "./owned-auth.js";

const origin = "http://127.0.0.1:3000";
if (
  process.env.APP_ENV !== "local" ||
  process.env.NODE_ENV !== "test" ||
  process.env.AUTH_LOCAL_E2E !== "1" ||
  !process.env.DATABASE_URL?.includes("127.0.0.1:5432")
) {
  throw new Error("Refusing to seed auth accounts outside disposable local CI.");
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const emailLinks = new Map<string, string>();
const password = process.env.AUTH_TEST_PASSWORD;
if (!password || password.length < 12) throw new Error("Missing local test password");
const auth = createNexosophyAuth(
  pool,
  {
    APP_ENV: "local",
    NODE_ENV: "test",
    NEXOSOPHY_AUTH_SECRET: process.env.NEXOSOPHY_AUTH_SECRET,
    NEXOSOPHY_AUTH_URL: origin,
    NEXOSOPHY_AUTH_TRUSTED_ORIGINS: origin,
  },
  async (email, _subject, url) => {
    emailLinks.set(email, url);
  },
);
try {
  for (const email of ["first@local.nexosophy.test", "second@local.nexosophy.test"]) {
    const signup = await auth.handler(
      new Request(origin + "/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email, password, name: "Local Browser Tester" }),
      }),
    );
    if (!signup.ok) throw new Error("Could not seed local account: " + signup.status);
    const verifyUrl = emailLinks.get(email);
    if (!verifyUrl) throw new Error("Verification link was not generated");
    const verified = await auth.handler(
      new Request(verifyUrl, { headers: { origin }, redirect: "manual" }),
    );
    if (![200, 302, 303].includes(verified.status)) {
      throw new Error("Local test verification failed: " + verified.status);
    }
  }
  console.log("Two local verified auth test accounts created without email delivery.");
} finally {
  await pool.end();
}
