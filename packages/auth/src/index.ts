export type InternalAccountState =
  | "pending_onboarding"
  | "active"
  | "suspended"
  | "deletion_requested"
  | "deletion_pending"
  | "deleted";

export type FactorVerificationAge = readonly [number, number] | null;

export type AuthPrincipal = {
  externalIdentityId: string;
  internalUserId: string;
  providerUserId: string;
  sessionId?: string;
  authenticatedAt?: Date;
  factorVerificationAge?: FactorVerificationAge;
  activeWorkspaceId?: string;
  permissions?: readonly string[];
};

export type AuthFailureReason =
  | "missing"
  | "invalid"
  | "expired"
  | "suspended"
  | "deletion_pending"
  | "deleted";

export type AuthVerificationResult =
  | { authenticated: true; principal: AuthPrincipal }
  | { authenticated: false; reason: AuthFailureReason };

export type ProviderAuthSession = {
  provider: string;
  providerUserId: string;
  sessionId?: string;
  authenticatedAt?: Date;
  factorVerificationAge?: FactorVerificationAge;
};

export type ProviderAuthResult =
  | { authenticated: true; session: ProviderAuthSession }
  | { authenticated: false; reason: "missing" | "invalid" | "expired" };

export type ProviderIdentitySnapshot = {
  provider: string;
  providerUserId: string;
  primaryEmail?: string;
  verifiedEmails: readonly string[];
  displayName?: string;
  avatarUrl?: string;
  disabled: boolean;
  providerUpdatedAt?: Date;
};

export type IdentityWebhookEvent = {
  provider: string;
  eventId: string;
  eventType: string;
  occurredAt: Date;
  providerUserId?: string;
  deleted: boolean;
};

export type InternalIdentity = {
  internalUserId: string;
  externalIdentityId: string;
  provider: string;
  providerUserId: string;
  accountState: InternalAccountState;
  identityDisabled: boolean;
};

export interface AuthVerifier {
  verify(request: Request): Promise<AuthVerificationResult>;
}

export interface IdentityProvider {
  verifyRequest(request: Request): Promise<ProviderAuthResult>;
  verifyWebhook(request: Request): Promise<IdentityWebhookEvent>;
  getUser(providerUserId: string): Promise<ProviderIdentitySnapshot | null>;
}

export interface IdentityStorePort {
  findByProviderUserId(
    provider: string,
    providerUserId: string,
  ): Promise<InternalIdentity | null>;

  provision(snapshot: ProviderIdentitySnapshot): Promise<{
    internalUserId: string;
    externalIdentityId: string;
    created: boolean;
  }>;

  sync(snapshot: ProviderIdentitySnapshot, eventOccurredAt?: Date): Promise<void>;

  handleProviderDeletion(
    provider: string,
    providerUserId: string,
    eventOccurredAt: Date,
  ): Promise<void>;
}

export function canAuthenticateInternalAccount(state: InternalAccountState): boolean {
  return (
    state === "pending_onboarding" ||
    state === "active" ||
    state === "deletion_requested"
  );
}

function deniedReason(state: InternalAccountState): AuthFailureReason {
  if (state === "suspended") return "suspended";
  if (state === "deletion_pending") return "deletion_pending";
  if (state === "deleted") return "deleted";
  return "invalid";
}

export function createInternalAuthVerifier(
  provider: IdentityProvider,
  identityStore: IdentityStorePort,
): AuthVerifier {
  return {
    async verify(request) {
      const providerResult = await provider.verifyRequest(request);
      if (!providerResult.authenticated) return providerResult;

      const { session } = providerResult;
      let identity = await identityStore.findByProviderUserId(
        session.provider,
        session.providerUserId,
      );

      if (!identity) {
        const snapshot = await provider.getUser(session.providerUserId);
        if (!snapshot || snapshot.disabled) {
          return { authenticated: false, reason: "invalid" };
        }

        await identityStore.provision(snapshot);
        identity = await identityStore.findByProviderUserId(
          session.provider,
          session.providerUserId,
        );
      }

      if (!identity || identity.identityDisabled) {
        return { authenticated: false, reason: "invalid" };
      }

      if (!canAuthenticateInternalAccount(identity.accountState)) {
        return {
          authenticated: false,
          reason: deniedReason(identity.accountState),
        };
      }

      return {
        authenticated: true,
        principal: {
          externalIdentityId: identity.externalIdentityId,
          internalUserId: identity.internalUserId,
          providerUserId: identity.providerUserId,
          sessionId: session.sessionId,
          authenticatedAt: session.authenticatedAt,
          factorVerificationAge: session.factorVerificationAge,
        },
      };
    },
  };
}

export function safeReturnTo(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw) return fallback;

  const value = raw.trim();
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.includes("\\") ||
    /[\u0000-\u001F\u007F]/u.test(value)
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://nexosophy.invalid");
    const parsed = new URL(value, base);

    if (parsed.origin !== base.origin) return fallback;

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export {
  createClerkIdentityProvider,
  type ClerkIdentityProviderConfig,
} from "./clerk.js";
