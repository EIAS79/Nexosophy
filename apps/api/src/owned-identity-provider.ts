import type {
  IdentityProvider,
  ProviderAuthResult,
  ProviderIdentitySnapshot,
} from "@nexosophy/auth";
import type { Pool } from "pg";

import type { NexosophyAuth } from "./owned-auth.js";

/**
 * Nexosophy is the identity provider. External OAuth accounts belong to the
 * self-hosted auth engine and never act as Nexosophy workspace principals.
 */
export function createOwnedIdentityProvider(auth: NexosophyAuth, pool: Pool): IdentityProvider {
  return {
    async verifyRequest(request: Request): Promise<ProviderAuthResult> {
      const hasCookie = request.headers.has("cookie");
      const session = await auth.api.getSession({
        headers: request.headers,
        query: { disableCookieCache: true },
      });
      if (!session || !session.user.emailVerified) {
        return { authenticated: false, reason: hasCookie ? "invalid" : "missing" };
      }
      return {
        authenticated: true,
        session: {
          provider: "nexosophy",
          providerUserId: session.user.id,
          sessionId: session.session.id,
          authenticatedAt: new Date(session.session.createdAt),
        },
      };
    },
    async getUser(providerUserId: string): Promise<ProviderIdentitySnapshot | null> {
      const result = await pool.query<{
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image: string | null;
        updatedAt: Date;
      }>(
        'select "id", "name", "email", "emailVerified", "image", "updatedAt" from "user" where "id" = $1',
        [providerUserId],
      );
      const user = result.rows[0];
      if (!user) return null;
      return {
        provider: "nexosophy",
        providerUserId: user.id,
        verifiedEmails: user.emailVerified ? [user.email] : [],
        disabled: !user.emailVerified,
        providerUpdatedAt: user.updatedAt,
        ...(user.emailVerified ? { primaryEmail: user.email } : {}),
        ...(user.name ? { displayName: user.name } : {}),
        ...(user.image ? { avatarUrl: user.image } : {}),
      };
    },
    async verifyWebhook() {
      throw new Error("Nexosophy-owned identity does not accept provider identity webhooks.");
    },
  };
}
