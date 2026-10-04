# Phase 06 — API Scale Foundation & Rich Document Runtime

> **Canonical execution file:** `plan/13-phases/phase-06-api-scale-rich-editor.md`

## Objective

Complete the high-concurrency API platform and first native editor so later feature modules inherit production-safe patterns rather than reinvent them.

## Owning specifications

- [00-api-contract.md](../04-api-scale/00-api-contract.md)
- [01-scalability-concurrency.md](../04-api-scale/01-scalability-concurrency.md)
- [02-rate-limit-idempotency.md](../04-api-scale/02-rate-limit-idempotency.md)
- [03-cache-queues-workers.md](../04-api-scale/03-cache-queues-workers.md)
- [05-performance-slo-capacity.md](../04-api-scale/05-performance-slo-capacity.md)
- [02-editor-platform.md](../05-core-workspace/02-editor-platform.md)

## Prerequisites

- [ ] Phase 05 exit gate passed.
- [ ] Node/content identity stable.
- [ ] Redis/cache and durable queue configured in staging.
- [ ] Editor document persistence format decision accepted.

## Required deliverables

- [ ] Versioned typed /v1 API conventions and OpenAPI generation.
- [ ] Cursor pagination/error/idempotency middleware.
- [ ] Shared Redis rate limiting and backpressure.
- [ ] Durable queue/outbox foundation and DLQ tooling.
- [ ] Bounded DB pool configuration and pool observability.
- [ ] Stateless API horizontal-scaling configuration.
- [ ] Universal editor runtime: title/header, capability registry, autosave state machine, undo/redo contract, selection, dirty/saved/offline/error states.
- [ ] First rich-document schema and rendering/editor engine.
- [ ] Optimistic concurrency/version checks.
- [ ] Large-document virtualization/performance strategy.
- [ ] Editor autosave/history hooks for Phase 07.
- [ ] Load-test harness and initial mixed-workload scenario.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Contract tests/OpenAPI drift.
- [ ] Concurrent idempotent mutation races.
- [ ] Rate-limit noisy-neighbor test.
- [ ] API replica restart with active sessions.
- [ ] DB pool remains bounded during autoscaling burst.
- [ ] Queue duplicate delivery idempotency.
- [ ] Editor refresh/reopen preserves acknowledged edits.
- [ ] Autosave failure visible/retryable.
- [ ] Large-document interaction performance.
- [ ] Desktop/tablet/mobile + keyboard accessibility editor smoke tests.

## Exit gate

- [ ] No process-local durable state or rate counters.
- [ ] Ordinary feature teams can add endpoints without inventing new error/pagination/auth patterns.
- [ ] Editor plugin/capability model supports notes/reports/spreadsheets/code later.
- [ ] Initial staging load test has no correctness failures and identifies capacity headroom.
- [ ] Phase 07 can add history/trash without changing document identity.

## Phase completion record

- Commit/PR:
- Migration version(s):
- Staging deployment:
- Test report:
- Load/performance evidence where applicable:
- Known deferred items (must not violate exit gate):
- Approval/date: