# Users, Profiles and Onboarding

> **Plan path:** `plan/02-identity-billing/01-users-profiles-onboarding.md`

## Purpose

Define Nexosophy's internal account/profile lifecycle independently of the auth provider.

## User / product outcomes

- New users reach a useful workspace quickly.
- One user can express multiple roles/interests without separate accounts.

## Required capabilities

- Profile basics and avatar.
- Timezone/locale defaults.
- Persona/interests selection.
- Workspace template selection.
- Import optional first content.
- Notification preferences.
- Onboarding resume/skip.

## Routes / surfaces

- `/onboarding`
- `/settings/profile`
- `/settings/preferences`

## Core data model

- `User`
- `UserProfile`
- `UserPreference`
- `OnboardingState`

## Service and API contract

- GET/PATCH /v1/me
- GET/PATCH /v1/me/preferences
- POST /v1/onboarding/complete

## Scale, concurrency and resilience

- /me response is compact and cacheable per session version.
- Preference writes are debounced/batched.

## Security / correctness risks

- Do not make optional demographic/academic fields required for account creation.
- Timezone changes must not silently alter already-scheduled absolute events.

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

- [ ] New user can complete/skip onboarding.
- [ ] Profile edits propagate without re-authentication.
- [ ] Deleted auth identity triggers documented account state rather than orphaned content.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.