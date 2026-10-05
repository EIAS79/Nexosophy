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

      return {
        authenticated: true,
        session: {
          provider: "clerk",
          providerUserId: auth.userId,
          sessionId: auth.sessionId,
          authenticatedAt,
          factorVerificationAge: toFactorVerificationAge(
            auth.factorVerificationAge,
          ),
        },
      };
    },

    async verifyWebhook(request): Promise<IdentityWebhookEvent> {
      const eventId = request.headers.get("svix-id");
      if (!eventId) {
        throw new Error("Missing svix-id webhook header");
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
        occurredAt: new Date(event.timestamp),
        providerUserId,
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

        return {
          provider: "clerk",
          providerUserId: user.id,
          primaryEmail,
          verifiedEmails,
          displayName: user.fullName ?? undefined,
          avatarUrl: user.hasImage ? user.imageUrl : undefined,
          disabled: user.banned || user.locked,
          providerUpdatedAt: new Date(user.updatedAt),
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
