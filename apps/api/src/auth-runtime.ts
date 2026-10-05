import {
  createClerkIdentityProvider,
  createInternalAuthVerifier,
  type AuthVerifier,
  type IdentityProvider,
  type IdentityStorePort,
} from "@nexosophy/auth";
import { parseOptionalClerkEnv, type ApiEnv } from "@nexosophy/config";
import type { createDatabasePool } from "@nexosophy/db";

import { createDatabaseIdentityStore } from "./auth-store-adapter.js";

type DatabasePool = ReturnType<typeof createDatabasePool>;

export type AuthRuntime = {
  verifier?: AuthVerifier;
  provider?: IdentityProvider;
  identityStore?: IdentityStorePort;
};

export function createAuthRuntime(
  env: ApiEnv,
  pool: DatabasePool,
  processEnv: NodeJS.ProcessEnv = process.env,
): AuthRuntime {
  const clerk = parseOptionalClerkEnv(processEnv);

  if (!clerk) {
    if (env.APP_ENV === "staging" || env.APP_ENV === "production") {
      throw new Error(
        "Clerk authentication configuration is required in staging and production.",
      );
    }

    return {};
  }

  const provider = createClerkIdentityProvider({
    secretKey: clerk.CLERK_SECRET_KEY,
    publishableKey: clerk.CLERK_PUBLISHABLE_KEY,
    jwtKey: clerk.CLERK_JWT_KEY,
    authorizedParties: clerk.CLERK_AUTHORIZED_PARTIES,
    webhookSigningSecret: clerk.CLERK_WEBHOOK_SIGNING_SECRET,
  });

  const identityStore = createDatabaseIdentityStore(pool);

  return {
    provider,
    identityStore,
    verifier: createInternalAuthVerifier(provider, identityStore),
  };
}
