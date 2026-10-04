export type AuthPrincipal = {
  externalIdentityId: string;
  internalUserId: string;
  sessionId?: string;
};

export type AuthVerificationResult =
  | { authenticated: true; principal: AuthPrincipal }
  | { authenticated: false; reason: "missing" | "invalid" | "expired" | "suspended" };

export interface AuthVerifier {
  verify(input: { authorization?: string; cookie?: string }): Promise<AuthVerificationResult>;
}
