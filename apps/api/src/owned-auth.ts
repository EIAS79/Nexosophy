import { betterAuth, type BetterAuthOptions } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import type { Pool } from "pg";

type ProviderName = "google" | "github" | "facebook" | "apple";

function providerCredentials(env: NodeJS.ProcessEnv, name: ProviderName) {
  const prefix = name.toUpperCase();
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error(`${prefix} OAuth requires both client ID and client secret.`);
  }
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

function trustedOrigins(value: string | undefined, baseURL: string) {
  const origins = (value || baseURL)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const origin of origins) {
    const u = new URL(origin);
    if (u.origin !== origin || !["https:", "http:"].includes(u.protocol)) {
      throw new Error("Nexosophy auth origins must be exact URL origins.");
    }
  }
  return origins;
}

async function deliverEmail(
  env: NodeJS.ProcessEnv,
  recipient: string,
  subject: string,
  url: string,
) {
  const key = env.NEXOSOPHY_EMAIL_API_KEY;
  const from = env.NEXOSOPHY_EMAIL_FROM;
  if (!key || !from) {
    throw new Error("Email delivery is not configured. Authentication email cannot be sent.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      text: `Open this secure Nexosophy link: ${url}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Authentication email delivery failed.");
}

export function createNexosophyAuth(
  pool: Pool,
  env: NodeJS.ProcessEnv = process.env,
  mailer: (recipient: string, subject: string, url: string) => Promise<void> = (
    recipient,
    subject,
    url,
  ) => deliverEmail(env, recipient, subject, url),
): ReturnType<typeof betterAuth> {
  const secret = env.NEXOSOPHY_AUTH_SECRET;
  const baseURL = env.NEXOSOPHY_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) {
    throw new Error("Nexosophy-owned auth secret (32+ characters) and public URL are required.");
  }
  const origin = new URL(baseURL).origin;
  if (env.APP_ENV !== "local" && env.NODE_ENV !== "test" && !origin.startsWith("https://")) {
    throw new Error("Nexosophy authentication requires HTTPS outside local/test.");
  }

  const options: BetterAuthOptions = {
    appName: "Nexosophy",
    secret,
    baseURL,
    basePath: "/api/auth",
    database: pool,
    trustedOrigins: trustedOrigins(env.NEXOSOPHY_AUTH_TRUSTED_ORIGINS, origin),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        mailer(user.email, "Reset your Nexosophy password", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) =>
        mailer(user.email, "Verify your Nexosophy email", url),
    },
    socialProviders: {
      ...(providerCredentials(env, "google")
        ? { google: providerCredentials(env, "google")! }
        : {}),
      ...(providerCredentials(env, "github")
        ? { github: providerCredentials(env, "github")! }
        : {}),
      ...(providerCredentials(env, "facebook")
        ? { facebook: providerCredentials(env, "facebook")! }
        : {}),
      ...(providerCredentials(env, "apple") ? { apple: providerCredentials(env, "apple")! } : {}),
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: [] },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 6,
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    advanced: {
      useSecureCookies: env.APP_ENV === "staging" || env.APP_ENV === "production",
      cookiePrefix: "nexosophy",
    },
    plugins: [twoFactor({ issuer: "Nexosophy" }), passkey({ rpName: "Nexosophy" })],
  };
  return betterAuth(options);
}

export type NexosophyAuth = ReturnType<typeof createNexosophyAuth>;
