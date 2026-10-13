# Phase 02B — Nexosophy-Owned Authentication Migration

**Status: IN PROGRESS. Do not mark Phase 02 complete.** Owner decision 2026-10-11 supersedes the Clerk integration. The historical Phase 02 checkboxes and completed PR apply only to the retired design. Canonical architecture: [owned-auth](../02-identity-billing/00-auth-nexosophy-owned.md).

## Required implementation
- [ ] API-owned session issuance and verification (self-hosted, database-backed).
- [ ] Versioned PostgreSQL schema migration reviewed and tested for idempotence, rollback, isolation.
- [ ] Stable mapping from verified auth user to internal `users.id` via `user_identities`.
- [ ] Same-origin login/logout/signup/reset/verification screens; no Clerk components or scripts.
- [ ] Account settings: password/email changes, linked providers, active devices and revoked sessions.
- [ ] Verified email delivery integration and safe recovery/notification flows.
- [ ] Google OAuth registered, configured and verified.
- [ ] GitHub OAuth registered, configured and verified.
- [ ] Facebook OAuth registered, configured and verified.
- [ ] Apple Sign-In registered, configured and verified (requires verified domain).
- [ ] Additional OIDC/Microsoft/Discord provider adapter and tenant policy.
- [ ] WebAuthn/passkey enrollment, assertion, recovery and deletion.
- [ ] TOTP MFA enrollment, authentication, backup codes and recovery.
- [ ] Recent MFA/reauth for account deletion, export, identity linking, security settings.
- [ ] Session logout, logout-all, suspension/revoke and per-device management.
- [ ] Auth abuse throttling, monitoring, audit and rate-limit evidence.
- [ ] Disabled/deleted account immediately loses protected workspace access.
- [ ] Two-user browser tests, IDOR and cross-workspace tenant isolation.
- [ ] Responsive/mobile and accessibility tests.
- [ ] Remove every Clerk package, import, webhook and env variable.
- [ ] Staging, production backup/restore and security review before launch.

## Progress evidence
- 2026-10-11: chose self-hosted Better Auth as maintained security engine, Nexosophy owns interface and policy.
- 2026-10-11: code scaffolding: `apps/api/src/owned-auth.ts`, `owned-identity-provider.ts`, `owned-auth-routes.ts`; generated migration `0021_nexosophy_auth_core.sql` with user/session/account/verification/twoFactor/passkey tables. The code is not mounted in the API or connected to web UI until integration tests and migration pass.
- Authentication credentials, provider approval, email delivery and cross-browser verification are NOT finished.
- Do not apply new migration to production-intended Neon main as an uncontrolled live change. Staging database first after CI and migration review.

## Exit criteria
The production build, full PostgreSQL integration, email provider, all enabled OAuth providers, passkey/MFA and sensitive-workflow regression tests must pass. No Clerk runtime dependency may remain. Existing workspace RBAC still controls authorization independently of identity.
