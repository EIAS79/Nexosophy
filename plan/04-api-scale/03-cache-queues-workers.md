# Caching, Durable Queues and Worker Architecture

> **Plan path:** `plan/04-api-scale/03-cache-queues-workers.md`

## Purpose

Keep hot reads fast and heavy/slow work off synchronous endpoints.

## Product outcomes

- Expensive tasks execute reliably with retry/dead-letter semantics.
- Caches accelerate reads without becoming authoritative.
- Workers can scale independently by workload.

## Required capabilities

- Cache-aside pattern for selected reads.
- Versioned cache keys and explicit invalidation.
- Short TTL permission/entitlement caches.
- Durable queue with delayed jobs and retry policy.
- Separate queues/pools for email, indexing, conversion, media, export/import, notifications, cleanup and AI/compute.
- Dead-letter queue and replay tooling.
- Job dedupe/idempotency.
- Outbox pattern for critical DB→async events.

## Routes / surfaces

- `/v1/jobs/:id where user-visible`

## Core data model

- `Job`
- `OutboxEvent`
- `DeadLetter`
- `CacheVersion`

## Service / API contract

- API persists business transaction/outbox before acknowledging critical async work.
- Workers acknowledge only after durable side effects or idempotent checkpoint.

## Scale, concurrency and resilience

- Queue consumer concurrency tuned per dependency capacity.
- Autoscale workers by queue age/depth.
- Cache stampede protection via locking/single-flight/jittered TTL where needed.
- Never put multi-megabyte document bodies in Redis queues/caches; store references to object storage/DB.

## Critical risks

- At-least-once delivery means handlers must be idempotent.
- Global cache invalidation storms can overload DB.

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

- [ ] Worker restart/duplicate-delivery tests pass.
- [ ] DLQ monitoring and replay runbook exists.
- [ ] Cache failure falls back safely for critical reads.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.