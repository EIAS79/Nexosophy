# Rate Limiting, Idempotency and Backpressure

> **Plan path:** `plan/04-api-scale/02-rate-limit-idempotency.md`

## Purpose

Protect shared infrastructure from abuse, accidental loops and retry storms while keeping legitimate bursty usage functional.

## Product outcomes

- One user/integration cannot exhaust capacity for everyone.
- Retries do not duplicate payments, imports, reminders or writes.

## Required capabilities

- Layered limits by IP, anonymous token, user, workspace and API key.
- Endpoint classes: auth-sensitive, read, write, expensive, upload-init, search, AI/compute, webhook.
- Token bucket/sliding window in Redis with local fail-safe policy.
- Retry-After headers.
- Idempotency records with request fingerprint/result reference/TTL.
- Concurrency semaphores for expensive jobs.
- Queue max-depth/backpressure policy.

## Routes / surfaces

- `All public API; especially /auth-related, /search, /imports, /exports, /billing, /uploads`

## Core data model

- `RateLimitPolicy`
- `IdempotencyRecord`

## Service / API contract

- Duplicate Idempotency-Key + same fingerprint returns original outcome; different fingerprint is conflict.
- 429 includes machine code and retry_after.
- Trusted webhooks use signature validation and separate abuse controls, not end-user limits.

## Scale, concurrency and resilience

- Limits are enforced in shared storage so all API replicas see the same budget.
- Rate-limit storage failure uses explicit fail-open/fail-closed policy by endpoint risk.
- Backpressure begins before DB/queue saturation thresholds.

## Critical risks

- Pure IP limits punish NAT/shared campuses.
- Fail-open auth/payment controls can be dangerous; choose policy per class.

## Responsive / accessibility

- User-facing flows must specify desktop, tablet and phone behavior.
- Keyboard, focus, semantic labeling and reduced-motion behavior are mandatory on critical paths.
- Loading, empty, denied, error and degraded states are designed, not improvised.

## Observability

- Structured logs with request/correlation IDs and redaction.
- Endpoint/job/provider latency, errors and saturation metrics.
- Alerts must be actionable and tied to a runbook.

## Testing

- Unit tests for domain rules.
- Integration tests for database/cache/queue/provider boundaries.
- Authorization/tenant-isolation tests.
- Concurrency/race tests where multiple writers are possible.
- Load tests for hot endpoints and expensive operations.

## Definition of Done

- [ ] Load test demonstrates noisy-neighbor isolation.
- [ ] Idempotency race tests pass under concurrent duplicate requests.
- [ ] 429 UX and SDK retry behavior documented.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.