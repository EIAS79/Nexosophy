# Phase 10 — Search, Tags, Relations & Backlinks

> **Canonical execution file:** `plan/13-phases/phase-10-search-relations.md`

## Objective

Make all permitted workspace knowledge discoverable and connected.

## Owning specifications

- [04-search-indexing.md](../03-data-content/04-search-indexing.md)
- [12-search-tags-backlinks.md](../05-core-workspace/12-search-tags-backlinks.md)
- [05-command-palette.md](../06-productivity/05-command-palette.md)

## Prerequisites

- [x] Phase 09 implementation foundation available; formal Phase 09 gate intentionally deferred.
- [x] Search indexing/outbox infrastructure operational.

## Required deliverables

- [x] Global search route and command palette search.
- [x] Title/content/metadata/tag/type/date/owner facets.
- [x] Permission-safe snippets.
- [x] Tags and tag management.
- [x] Typed relations and backlinks.
- [x] Saved searches/filters.
- [x] Recent query/history controls.
- [x] Reindex/backfill tooling.
- [x] Index lag/reconciliation observability.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Permission revocation cannot leak stale search results.
- [ ] Large-index latency test.
- [ ] Index rebuild from source of truth.
- [ ] Backfill does not starve live indexing.
- [ ] Query abuse/rate controls.

## Exit gate

- [ ] Search finds all supported indexed content within defined lag.
- [x] Results obey server-side workspace permissions independent of client filters; formal revocation test pending.
- [x] Index is derived from canonical content and supports full destroy/rebuild through durable reindex jobs.

## Completion record

- Commit/PR: implementation completed on `phases-05-07-storage-editor-history`; merge intentionally deferred.
- Migration(s): `0009_search_relations.sql`.
- Staging deployment: intentionally deferred; shared branch previews remain suppressed.
- Test evidence: CI/typecheck/lint/build/integration tests intentionally pending.
- Performance evidence: GIN full-text index, cursor pagination, bounded reconciliation batches and throttled durable backfill implemented; measured p95 pending.
- Deferred items: formal Phase 09/10 gates and production-like permission/latency/backfill tests only.
- Approval/date: implementation deliverables completed 2026-10-08; validation approval pending.
