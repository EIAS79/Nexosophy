import { createClerkClient } from "@clerk/backend";
import { verifyWebhook } from "@clerk/backend/webhooks";

import type {
  FactorVerificationAge,
  IdentityProvider,
  IdentityWebhookEvent,
  ProviderAuthResult,
  ProviderIdentitySnapshot,
} from "./index.js";

export type ClerkIdentityProviderConfig = {
  secretKey: string;
  publishableKey: string;
  jwtKey?: string;
  authorizedParties: readonly string[];
  webhookSigningSecret: string;
};

function hasSessionCredential(request: Request): boolean {
  return (
    request.headers.has("authorization") ||
    request.headers.has("cookie")
  );
}

function toFactorVerificationAge(
  value: readonly [number, number] | null | undefined,
): FactorVerificationAge | undefined {
  if (value === undefined) return undefined;
  return value;
}

export function createClerkIdentityProvider(
  config: ClerkIdentityProviderConfig,
): IdentityProvider {
  const client = createClerkClient({
    secretKey: config.secretKey,
    publishableKey: config.publishableKey,
  });

  return {
    async verifyRequest(request): Promise<ProviderAuthResult> {
      const state = await client.authenticateRequest(request, {
        acceptsToken: "session_token",
        authorizedParties: [...config.authorizedParties],
        ...(config.jwtKey ? { jwtKey: config.jwtKey } : {}),
      });

      if (!state.isAuthenticated) {
        return {
          authenticated: false,
          reason: hasSessionCredential(request) ? "invalid" : "missing",
        };
      }

      const auth = state.toAuth();
      const issuedAt = auth.sessionClaims?.iat;
      const authenticatedAt =
        typeof issuedAt === "number" ? new Date(issuedAt * 1_000) : undefined;

      const factorVerificationAge = toFactorVerificationAge(
        auth.factorVerificationAge,
      );

      return {
        authenticated: true,
        session: {
          provider: "clerk",
          providerUserId: auth.userId,
          ...(auth.sessionId ? { sessionId: auth.sessionId } : {}),
          ...(authenticatedAt ? { authenticatedAt } : {}),
          ...(factorVerificationAge !== undefined
            ? { factorVerificationAge }
            : {}),
        },
      };
    },

    async verifyWebhook(request): Promise<IdentityWebhookEvent> {
      const eventId = request.headers.get("svix-id");
      const timestampHeader = request.headers.get("svix-timestamp");
      if (!eventId || !timestampHeader) {
        throw new Error("Missing signed Svix webhook headers");
      }

      const timestampSeconds = Number.parseInt(timestampHeader, 10);
      if (!Number.isSafeInteger(timestampSeconds)) {
        throw new Error("Invalid svix-timestamp webhook header");
      }

      const event = await verifyWebhook(request, {
        signingSecret: config.webhookSigningSecret,
      });

      let providerUserId: string | undefined;
      let deleted = false;

      if (
        event.type === "user.created" ||
        event.type === "user.updated" ||
        event.type === "user.deleted"
      ) {
        providerUserId = event.data.id;
        deleted = event.type === "user.deleted";
      }

      return {
        provider: "clerk",
        eventId,
        eventType: event.type,
        occurredAt: new Date(timestampSeconds * 1_000),
        ...(providerUserId ? { providerUserId } : {}),
        deleted,
      };
    },

    async getUser(providerUserId): Promise<ProviderIdentitySnapshot | null> {
      try {
        const user = await client.users.getUser(providerUserId);

        const verifiedEmails = user.emailAddresses
          .filter((email) => email.verification?.status === "verified")
          .map((email) => email.emailAddress);

        const primaryEmail =
          user.primaryEmailAddress?.verification?.status === "verified"
            ? user.primaryEmailAddress.emailAddress
            : undefined;

        const displayName = user.fullName ?? undefined;
        const avatarUrl = user.hasImage ? user.imageUrl : undefined;

        return {
          provider: "clerk",
          providerUserId: user.id,
          verifiedEmails,
          disabled: user.banned || user.locked,
          providerUpdatedAt: new Date(user.updatedAt),
          ...(primaryEmail ? { primaryEmail } : {}),
          ...(displayName ? { displayName } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        };
      } catch (error) {
        const candidate = error as { status?: number; statusCode?: number };
        const status = candidate.status ?? candidate.statusCode;
        if (status === 404) return null;
        throw error;
      }
    },
  };
}
