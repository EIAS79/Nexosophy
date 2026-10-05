# Phase 02 — Authentication, Accounts & Security Baseline

> **Canonical execution file:** `plan/13-phases/phase-02-authentication-accounts.md`

## Objective

Implement real Clerk-backed identity while keeping Nexosophy user/profile state internal and provider-independent.

## Owning specifications

- [00-auth-clerk.md](../02-identity-billing/00-auth-clerk.md)
- [01-users-profiles-onboarding.md](../02-identity-billing/01-users-profiles-onboarding.md)
- [05-data-classification-retention.md](../00-product-governance/05-data-classification-retention.md)

## Prerequisites

- [x] Phase 01 exit gate passed.
- [ ] Clerk development/test environment configured.
- [x] Internal user identity tables/migrations ready.

## Required deliverables

- [x] Signup/signin routes and provider-themed UX.
- [x] Email verification/recovery/password reset surfaces delegated to Clerk and wired through the real Clerk UI boundary; live tenant policy verification remains an external configuration check.
- [x] Google/Microsoft OAuth is delegated to Clerk through the canonical login/signup surfaces; live provider enablement depends on Clerk tenant configuration.
- [x] Server-side Clerk session/token verification.
- [x] Internal User + ExternalIdentity provisioning.
- [x] Idempotent signed Clerk webhook endpoint.
- [x] Session/device/security settings surfaces.
- [x] MFA/passkey hooks according to provider support/policy via Clerk UserProfile/security surfaces and strict reverification support.
- [x] Onboarding state, profile, timezone, locale and preferences.
- [x] Account disable/delete request pipeline boundary.
- [x] Security-event logging and provider/local authorization gates implemented; provider-side rate/abuse policy is delegated to Clerk and deployment configuration.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Signup/login/logout/recovery end-to-end.
- [ ] OAuth callback and return-to validation.
- [x] Duplicate/out-of-order webhook handling.
- [x] Suspended/disabled user denied.
- [ ] Account-linking/duplicate-email edge cases.
- [ ] Session revocation test.
- [ ] Cross-user IDOR attempts denied.
- [ ] Mobile/desktop auth UX and keyboard/screen-reader path.

## Exit gate

- [x] No business table uses email as durable identity key.
- [x] No ordinary authenticated request requires a live Clerk network call when supported local/session verification is valid.
- [x] Auth failures are observable without logging secrets.
- [x] Internal user survives provider metadata changes correctly.

## Phase completion record

- Commit/PR: PR #2 — `Phase 02: authentication, accounts and Clerk integration` — merged into `main` at merge commit `cd854d2cbc2002f7183d291a54f23ce1e97a04df`.
- Migration version(s): `0001_identity_accounts.sql`.
- Staging deployment: provider/runtime contracts are implemented; real Clerk staging secrets and provider toggles remain deployment configuration rather than repository data.
- Test report:
  - CI Fast run `37282707281` — success.
  - Build run `37282707304` — success.
  - Backend Integration run `37282707310` — success, including PostgreSQL/Redis services, migrations, concurrent identity provisioning and webhook idempotence checks.
  - Local forced validation on the final implementation tree — lint with no blocking errors, workspace-boundary checks, 13-package typecheck, tests and production builds all passed.
- Load/performance evidence where applicable: auth request path is horizontally safe; identity provisioning serializes only by provider-user advisory key; no global process-local correctness dependency.
- Known deferred items (must not violate exit gate):
  - Live Clerk tenant E2E for email recovery, Google/Microsoft OAuth, session revocation, MFA/passkeys and signed webhook delivery requires actual Clerk development/staging credentials and provider enablement. The code/provider boundaries are implemented and CI-tested without storing secrets.
  - GitHub branch/ruleset enforcement remains a repository-setting control outside the connected GitHub write surface.
- Approval/date: Phase 02 engineering implementation merged and validated 2026-10-05.