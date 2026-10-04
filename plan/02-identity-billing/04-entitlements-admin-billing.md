# Entitlements, Quotas and Billing Administration

> **Plan path:** `plan/02-identity-billing/04-entitlements-admin-billing.md`

## Purpose

Separate what a customer paid for from feature checks throughout the application.

## User / product outcomes

- Feature access is consistent across web/API/workers.
- Support can diagnose billing state without manually editing database rows.

## Required capabilities

- Plan entitlements.
- Storage quotas.
- AI/compute usage quotas if enabled.
- Workspace seat limits.
- Grace/suspended states.
- Usage meter aggregation.
- Admin billing lookup/read-only provider links.
- Controlled support override with expiry/audit if policy allows.

## Routes / surfaces

- `/settings/billing`
- `/admin/billing`

## Core data model

- `Entitlement`
- `UsageCounter`
- `QuotaWindow`
- `SupportOverride`
- `BillingAudit`

## Service and API contract

- GET /v1/entitlements returns normalized effective entitlements.
- Internal authorizeEntitlement() library used by API and workers.
- Usage increments are atomic/idempotent for billable or limited operations.

## Scale, concurrency and resilience

- Hot entitlement checks use versioned Redis/local short TTL backed by DB; provider network is never on the hot path.
- Usage events aggregate asynchronously where exact immediate balance is unnecessary.

## Security / correctness risks

- Feature checks scattered as plan-name string comparisons will drift; use capability keys.
- Admin overrides are sensitive and audited.

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

- [ ] Every gated feature maps to an entitlement key.
- [ ] Quota race tests prevent overrun beyond documented tolerance.
- [ ] Billing support view can trace internal state to Stripe objects/events.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.