# Global Definition of Done

> **Plan path:** `plan/00-product-governance/03-definition-of-done.md`

## Purpose

Define the release gate applied to every feature and every phase.

## User / product outcomes

- A feature is not called complete merely because the happy-path UI renders.
- Quality expectations are measurable and repeatable.

## Required capabilities

- Functional acceptance criteria.
- Authorization and tenant-isolation tests.
- Responsive desktop/tablet/mobile behavior.
- Keyboard and screen-reader paths for critical actions.
- Structured logging, metrics and trace coverage.
- Unit/integration/e2e tests.
- Error, retry, loading, empty and offline/degraded states.
- Data migration/backfill plan when schema changes.
- Operational runbook for critical services.

## Routes / surfaces

- `N/A`

## Core data model

- `ReleaseGate`
- `TestCase`
- `Runbook`

## Service and API contract

- Every mutation defines validation, authorization, idempotency/retry semantics and stable error codes.
- Every endpoint has ownership, observability and a performance expectation.

## Scale, concurrency and resilience

- New endpoints receive load characteristics: expected frequency, cacheability, fan-out, DB query count and concurrency behavior.
- No unbounded list endpoint; cursor pagination is default.

## Security / correctness risks

- Passing UI QA while leaving hidden scale/security defects is explicitly insufficient.

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

- [ ] All required gates are checked in the PR/release checklist.
- [ ] P0/P1 defects block production promotion.
- [ ] Exceptions require a documented ADR with owner and expiry.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.