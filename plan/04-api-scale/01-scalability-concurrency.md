# Scalability, Concurrency and Horizontal Capacity

> **Plan path:** `plan/04-api-scale/01-scalability-concurrency.md`

## Purpose

Ensure Nexosophy can handle many simultaneous users and many calls in the same second without depending on one large server.

## Product outcomes

- Traffic can scale by adding API/worker/realtime instances.
- Overload degrades predictably rather than causing cascading failure.
- Concurrent edits/writes preserve correctness.

## Required capabilities

- Stateless HTTP API instances behind managed load balancer.
- Autoscaling based on CPU plus request concurrency/latency; not CPU alone.
- Shared Redis for rate limit, ephemeral coordination and cache.
- Managed Postgres with bounded pooling.
- Dedicated worker fleet scaled by queue depth/oldest-job age.
- Realtime service scaled separately from HTTP API.
- CDN/WAF in front of public web/API where appropriate.
- Circuit breakers/timeouts for third-party dependencies.
- Bulkheads: payments/auth/search/conversion failures isolated from core content reads.
- Optimistic concurrency and DB constraints for contested resources.

## Routes / surfaces

- `All production endpoints`

## Core data model

- `CapacityBudget`
- `ConcurrencyToken`
- `CircuitState`

## Service / API contract

- No process-local session, rate counter or durable job state.
- Long-running operation returns 202 + job resource.
- Health/readiness removes unhealthy instances before serving traffic.

## Scale, concurrency and resilience

- Launch validation target: prove at least 1,000 sustained ordinary API requests/sec and 3,000 req/sec short bursts on production-like infrastructure with headroom; increase targets before launch if forecast requires. These are test gates, not product guarantees.
- Maintain p95 <250ms for cacheable/simple reads and <500ms for ordinary writes under agreed load envelope, excluding file transfer/provider latency.
- Keep DB connection count bounded under autoscaling using global budget and pooler.
- Admission control limits concurrent expensive operations per tenant.
- Capacity tests include hot-key contention, many tenants, websocket/realtime rooms and queue spikes.
- Scale-out must not require code changes; only resource/replica configuration within tested limits.

## Critical risks

- A single hot workspace/document can cause lock or cache hot-key contention even when total RPS is modest.
- Autoscaling without DB/queue budgets can amplify failure.
- Synchronous fan-out to multiple providers creates cascading latency.

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

- [ ] Load test report committed for staging before production.
- [ ] Autoscaling test proves instances can add/remove without session loss.
- [ ] Chaos test covers Redis/search/provider failure while core data remains safe.
- [ ] DB pool remains below configured safety threshold during burst test.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.