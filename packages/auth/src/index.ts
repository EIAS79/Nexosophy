export type InternalAccountState =
  | "pending_onboarding"
  | "active"
  | "suspended"
  | "deletion_requested"
  | "deletion_pending"
  | "deleted";

export type AuthPrincipal = {
  externalIdentityId: string;
  internalUserId: string;
  providerUserId: string;
  sessionId?: string;
  authenticatedAt?: Date;
  assuranceLevel?: string;
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

export type ProviderIdentitySnapshot = {
  provider: string;
  providerUserId: string;
  primaryEmail?: string;
  verifiedEmails: readonly string[];
  displayName?: string;
  avatarUrl?: string;
  disabled: boolean;
};

export type IdentityWebhookEvent = {
  provider: string;
  eventId: string;
  eventType: string;
  occurredAt?: Date;
  user?: ProviderIdentitySnapshot;
};

export interface AuthVerifier {
  verify(request: Request): Promise<AuthVerificationResult>;
}

export interface IdentityProvider {
  verifyRequest(request: Request): Promise<AuthVerificationResult>;
  verifyWebhook(request: Request): Promise<IdentityWebhookEvent>;
  getUser(providerUserId: string): Promise<ProviderIdentitySnapshot | null>;
}

export interface IdentityProvisioningPort {
  resolveOrCreateInternalUser(snapshot: ProviderIdentitySnapshot): Promise<{
    internalUserId: string;
    externalIdentityId: string;
    created: boolean;
  }>;
  syncIdentity(snapshot: ProviderIdentitySnapshot): Promise<void>;
  handleProviderDeletion(providerUserId: string): Promise<void>;
}

export function canAuthenticateInternalAccount(state: InternalAccountState): boolean {
  return (
    state === "pending_onboarding" ||
    state === "active" ||
    state === "deletion_requested"
  );
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
