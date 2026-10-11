import {
  createInternalAuthVerifier,
  type AuthVerifier,
  type IdentityProvider,
  type IdentityStorePort,
} from "@nexosophy/auth";
import type { ApiEnv } from "@nexosophy/config";
import type { createDatabasePool } from "@nexosophy/db";

import { createDatabaseIdentityStore } from "./auth-store-adapter.js";
import { createNexosophyAuth, type NexosophyAuth } from "./owned-auth.js";
import { createOwnedIdentityProvider } from "./owned-identity-provider.js";

type DatabasePool = ReturnType<typeof createDatabasePool>;

export type AuthRuntime = {
  verifier?: AuthVerifier;
  provider?: IdentityProvider;
  identityStore?: IdentityStorePort;
  ownedAuth?: NexosophyAuth;
};

export function createAuthRuntime(
  env: ApiEnv,
  pool: DatabasePool,
  processEnv: NodeJS.ProcessEnv = process.env,
): AuthRuntime {
  if (!processEnv.NEXOSOPHY_AUTH_SECRET || !processEnv.NEXOSOPHY_AUTH_URL) {
    if (env.APP_ENV === "local" && processEnv.NODE_ENV === "test") {
      return {};
    }
    throw new Error("Nexosophy-owned authentication must be configured before starting the API.");
  }

  const ownedAuth = createNexosophyAuth(pool, processEnv);
  const provider = createOwnedIdentityProvider(ownedAuth, pool);
  const identityStore = createDatabaseIdentityStore(pool);
  return {
    ownedAuth,
    provider,
    identityStore,
    verifier: createInternalAuthVerifier(provider, identityStore),
  };
}
