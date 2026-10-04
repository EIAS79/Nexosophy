# Phase 10 — Search, Tags, Relations & Backlinks

> **Canonical execution file:** `plan/13-phases/phase-10-search-relations.md`

## Objective

Make all permitted workspace knowledge discoverable and connected.

## Owning specifications

- [04-search-indexing.md](../03-data-content/04-search-indexing.md)
- [12-search-tags-backlinks.md](../05-core-workspace/12-search-tags-backlinks.md)
- [05-command-palette.md](../06-productivity/05-command-palette.md)

## Prerequisites

- [ ] Phase 09 passed.
- [ ] Search indexing/outbox infrastructure operational.

## Required deliverables

- [ ] Global search route and command palette search.
- [ ] Title/content/metadata/tag/type/date/owner facets.
- [ ] Permission-safe snippets.
- [ ] Tags and tag management.
- [ ] Typed relations and backlinks.
- [ ] Saved searches/filters.
- [ ] Recent query/history controls.
- [ ] Reindex/backfill tooling.
- [ ] Index lag/reconciliation observability.

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
- [ ] Results obey permissions independent of client filters.
- [ ] Index can be destroyed/rebuilt without data loss.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: