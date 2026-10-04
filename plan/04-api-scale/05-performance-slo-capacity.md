# Performance SLOs and Capacity Planning

> **Plan path:** `plan/04-api-scale/05-performance-slo-capacity.md`

## Purpose

Turn 'fast and scalable' into measurable service objectives and release gates.

## Product outcomes

- Performance regressions block release before users feel them.
- Capacity is planned from telemetry rather than guesswork.

## Required capabilities

- Endpoint latency/error SLOs by class.
- Frontend Core Web Vitals targets.
- Queue age targets.
- Realtime connection/update latency targets.
- DB saturation/connection budget.
- Cache hit-rate targets for designated caches.
- Capacity model for users, active sessions, RPS, sockets, storage growth and background jobs.
- k6/Artillery/Gatling-style load harness committed to repo.

## Routes / surfaces

- `All critical flows`

## Core data model

- `SLO`
- `SLI`
- `ErrorBudget`
- `CapacityForecast`

## Service / API contract

- Each critical endpoint annotated/documented with expected load class and latency objective.
- Synthetic journeys continuously test sign-in, open workspace, create note, search and billing-safe read.

## Scale, concurrency and resilience

- Test steady state, burst, soak, spike and recovery.
- Include realistic think time and mixed workload; do not benchmark one trivial endpoint.
- Measure p50/p95/p99, errors, CPU/memory, event loop lag, DB pool wait, query latency, Redis latency, queue lag and provider calls.
- Set autoscaling headroom so normal peaks do not run at >70–80% of hard bottleneck capacity.

## Critical risks

- RPS number alone hides slow queries and hot partitions.
- Synthetic benchmarks with empty DB/cache are misleading.

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

- [ ] Production-like dataset and traffic mix defined.
- [ ] Staging load test is automated and repeatable.
- [ ] Capacity review is required before major launches/campaigns.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.