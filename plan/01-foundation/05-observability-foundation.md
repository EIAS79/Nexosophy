# Observability Foundation

> **Plan path:** `plan/01-foundation/05-observability-foundation.md`

## Purpose

Make failures, saturation and user-impact visible before production traffic arrives.

## User / product outcomes

- Operators can answer what failed, for whom, where and why.
- Performance regressions are visible by endpoint, DB query and queue.

## Required capabilities

- Request/correlation IDs.
- Structured JSON logs with redaction.
- Distributed traces.
- RED metrics: rate, errors, duration.
- USE metrics for constrained resources.
- DB pool, query duration and lock metrics.
- Redis hit/miss/latency.
- Queue depth/age/retries/dead-letter.
- External provider latency/error metrics.
- Sentry-equivalent error aggregation.
- Synthetic health checks.

## Routes / surfaces

- `/health`
- `/ready`
- `/metrics (private)`

## Core data model

- `TelemetryEvent`
- `TraceContext`

## Service and API contract

- Request ID returned in error responses/support metadata.
- PII/secrets excluded from telemetry by policy.

## Scale, concurrency and resilience

- High-volume logs use sampling/aggregation to control cost without losing errors.
- Metric cardinality is bounded; never label metrics with user/document IDs.

## Security / correctness risks

- Observability added after launch cannot reconstruct past incidents.
- Excessive cardinality can take down or bankrupt monitoring.

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

- [ ] Dashboards exist for web/API/workers/realtime/DB/cache/queue/providers.
- [ ] P0 alerts page the owner; lower signals use actionable thresholds.
- [ ] Trace propagation verified across API → DB/cache/queue/worker.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.