# Phase 02 — Authentication, Accounts & Security Baseline

> **Canonical execution file:** `plan/13-phases/phase-02-authentication-accounts.md`

## Objective

Implement real Clerk-backed identity while keeping Nexosophy user/profile state internal and provider-independent.

## Owning specifications

- [00-auth-clerk.md](../02-identity-billing/00-auth-clerk.md)
- [01-users-profiles-onboarding.md](../02-identity-billing/01-users-profiles-onboarding.md)
- [05-data-classification-retention.md](../00-product-governance/05-data-classification-retention.md)

## Prerequisites

- [ ] Phase 01 exit gate passed.
- [ ] Clerk development/test environment configured.
- [ ] Internal user identity tables/migrations ready.

## Required deliverables

- [ ] Signup/signin routes and provider-themed UX.
- [ ] Email verification/recovery/password reset as configured.
- [ ] Google/Microsoft OAuth where configured.
- [ ] Server-side Clerk session/token verification.
- [ ] Internal User + ExternalIdentity provisioning.
- [ ] Idempotent signed Clerk webhook endpoint.
- [ ] Session/device/security settings surfaces.
- [ ] MFA/passkey hooks according to provider support/policy.
- [ ] Onboarding state, profile, timezone, locale and preferences.
- [ ] Account disable/delete request pipeline boundary.
- [ ] Auth rate/abuse controls and security-event logging.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Signup/login/logout/recovery end-to-end.
- [ ] OAuth callback and return-to validation.
- [ ] Duplicate/out-of-order webhook handling.
- [ ] Suspended/disabled user denied.
- [ ] Account-linking/duplicate-email edge cases.
- [ ] Session revocation test.
- [ ] Cross-user IDOR attempts denied.
- [ ] Mobile/desktop auth UX and keyboard/screen-reader path.

## Exit gate

- [ ] No business table uses email as durable identity key.
- [ ] No ordinary authenticated request requires a live Clerk network call when supported local/session verification is valid.
- [ ] Auth failures are observable without logging secrets.
- [ ] Internal user survives provider metadata changes correctly.

## Phase completion record

- Commit/PR:
- Migration version(s):
- Staging deployment:
- Test report:
- Load/performance evidence where applicable:
- Known deferred items (must not violate exit gate):
- Approval/date: