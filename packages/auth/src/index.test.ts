import { describe, expect, it, vi } from "vitest";

import {
  canAuthenticateInternalAccount,
  createInternalAuthVerifier,
  hasRecentFactorVerification,
  safeReturnTo,
  type IdentityProvider,
  type IdentityStorePort,
  type InternalIdentity,
} from "./index.js";

describe("safeReturnTo", () => {
  it("preserves internal relative paths", () => {
    expect(safeReturnTo("/app/notes?from=search#result")).toBe(
      "/app/notes?from=search#result",
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "javascript:alert(1)",
    "data:text/html,hello",
    "/app\\evil",
    "/app\nSet-Cookie:bad",
  ])("rejects unsafe return target %s", (value) => {
    expect(safeReturnTo(value)).toBe("/app");
  });
});

describe("recent factor verification", () => {
  it("accepts a fresh first factor when no second factor is registered", () => {
    expect(
      hasRecentFactorVerification({ factorVerificationAge: [3, -1] }),
    ).toBe(true);
  });

  it("accepts fresh first and second factors", () => {
    expect(
      hasRecentFactorVerification({ factorVerificationAge: [4, 2] }),
    ).toBe(true);
  });

  it.each([
    undefined,
    null,
    [11, -1] as const,
    [2, 11] as const,
    [-1, -1] as const,
  ])("rejects stale or unavailable verification %#", (factorVerificationAge) => {
    expect(hasRecentFactorVerification({ factorVerificationAge })).toBe(false);
  });
});

describe("internal account authentication state", () => {
  it.each(["pending_onboarding", "active", "deletion_requested"] as const)(
    "allows %s to maintain an authenticated session",
    (state) => {
      expect(canAuthenticateInternalAccount(state)).toBe(true);
    },
  );

  it.each(["suspended", "deletion_pending", "deleted"] as const)(
    "denies %s even if the external provider still has a valid session",
    (state) => {
      expect(canAuthenticateInternalAccount(state)).toBe(false);
    },
  );
});

function provider(overrides: Partial<IdentityProvider> = {}): IdentityProvider {
  return {
    verifyRequest: vi.fn(async () => ({
      authenticated: true as const,
      session: {
        provider: "clerk",
        providerUserId: "user_external",
        sessionId: "sess_123",
      },
    })),
    verifyWebhook: vi.fn(),
    getUser: vi.fn(async () => ({
      provider: "clerk",
      providerUserId: "user_external",
      verifiedEmails: ["user@example.test"],
      primaryEmail: "user@example.test",
      displayName: "Research User",
      disabled: false,
    })),
    ...overrides,
  };
}

function store(
  identity: InternalIdentity | null,
): IdentityStorePort & { provision: ReturnType<typeof vi.fn> } {
  let current = identity;

  return {
    findByProviderUserId: vi.fn(async () => current),
    provision: vi.fn(async (snapshot) => {
      current = {
        internalUserId: "internal_1",
        externalIdentityId: "identity_1",
        provider: snapshot.provider,
        providerUserId: snapshot.providerUserId,
        accountState: "pending_onboarding",
        identityDisabled: false,
      };
      return {
        internalUserId: current.internalUserId,
        externalIdentityId: current.externalIdentityId,
        created: true,
      };
    }),
    sync: vi.fn(),
    handleProviderDeletion: vi.fn(),
  };
}

describe("createInternalAuthVerifier", () => {
  it("provisions a missing internal user once after provider authentication", async () => {
    const identityStore = store(null);
    const verifier = createInternalAuthVerifier(provider(), identityStore);

    const result = await verifier.verify(new Request("https://nexosophy.test/v1/me"));

    expect(result.authenticated).toBe(true);
    expect(identityStore.provision).toHaveBeenCalledTimes(1);
  });

  it("denies an internally suspended user despite valid provider auth", async () => {
    const identityStore = store({
      internalUserId: "internal_1",
      externalIdentityId: "identity_1",
      provider: "clerk",
      providerUserId: "user_external",
      accountState: "suspended",
      identityDisabled: false,
    });
    const verifier = createInternalAuthVerifier(provider(), identityStore);

    await expect(
      verifier.verify(new Request("https://nexosophy.test/v1/me")),
    ).resolves.toEqual({
      authenticated: false,
      reason: "suspended",
    });
  });

  it("does not provision when provider authentication fails", async () => {
    const identityStore = store(null);
    const verifier = createInternalAuthVerifier(
      provider({
        verifyRequest: vi.fn(async () => ({
          authenticated: false as const,
          reason: "invalid" as const,
        })),
      }),
      identityStore,
    );

    await expect(
      verifier.verify(new Request("https://nexosophy.test/v1/me")),
    ).resolves.toEqual({
      authenticated: false,
      reason: "invalid",
    });

    expect(identityStore.provision).not.toHaveBeenCalled();
  });
});
