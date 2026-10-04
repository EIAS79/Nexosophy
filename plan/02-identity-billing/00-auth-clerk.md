# Authentication — Clerk Integration

> **Plan path:** `plan/02-identity-billing/00-auth-clerk.md`

## Purpose

Use Clerk for identity/authentication while Nexosophy owns its internal user, workspace, permission and billing models.

## User / product outcomes

- Users can securely sign up/sign in/recover accounts.
- Identity-provider replacement remains possible because business tables reference internal user IDs.

## Required capabilities

- Email/password or passwordless per product policy.
- Email verification.
- Google and Microsoft OAuth.
- MFA.
- Passkeys/WebAuthn where supported.
- Session/device management.
- Sign-out-all-devices.
- Account recovery.
- Auth webhook synchronization.
- Suspension/disable mapping.

## Routes / surfaces

- `/sign-in`
- `/sign-up`
- `/verify`
- `/forgot-password`
- `/settings/security`

## Core data model

- `User`
- `ExternalIdentity`
- `SessionAudit`
- `SecurityEvent`

## Service and API contract

- Browser obtains Clerk session; API validates signed token/session then resolves internal User.
- POST /webhooks/clerk verifies signature and is idempotent.
- Never identify internal users by mutable email.

## Scale, concurrency and resilience

- JWT/session verification avoids a provider network call on every API request where Clerk's supported local verification is valid.
- Webhook processing is queued/retriable after signature and event dedupe.

## Security / correctness risks

- Clerk outage must not corrupt internal user state.
- Account-linking rules must prevent duplicate internal accounts.

## Responsive and accessibility requirements

- All user-facing surfaces must define desktop, tablet and phone behavior rather than rely on accidental CSS wrapping.
- Critical actions must be keyboard reachable, have visible focus, semantic labels and non-color-only states.
- Loading, empty, error, permission-denied and offline/degraded states are part of the feature contract.

## Observability requirements

- Structured events for critical state transitions and failures.
- Latency/error metrics for service endpoints and external dependencies.
- Correlation/request IDs on support-visible failures; never log secrets or raw sensitive content.

## Test strategy

- Unit tests for domain rules and state transitions.
- Integration tests for persistence/provider boundaries.
- Authorization and tenant-isolation tests for every resource API.
- End-to-end tests for critical user journeys on desktop and mobile.
- Load/concurrency tests for high-frequency or contention-sensitive operations.

## Definition of Done

- [ ] All auth flows and recovery paths e2e tested.
- [ ] Session revocation and suspended-user denial tested.
- [ ] Webhook duplicates/out-of-order events do not create duplicate users.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.