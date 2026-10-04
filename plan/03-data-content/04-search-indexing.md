# Search and Indexing Platform

> **Plan path:** `plan/03-data-content/04-search-indexing.md`

## Purpose

Provide fast cross-workspace search without making the search index a source of truth.

## Product outcomes

- Users can find files, notes, people, tasks, citations, reports and lab records quickly.
- Permissions are respected at query time/index filtering.
- Index lag/failure never corrupts canonical data.

## Required capabilities

- Dedicated search adapter/provider.
- Full-text fields, title, tags, type, dates, owners and domain facets.
- Autocomplete/recent queries.
- Search snippets/highlights.
- Optional semantic/vector retrieval separated from exact search.
- Indexing events emitted from durable outbox/job path.
- Reindex/backfill command.

## Routes / surfaces

- `/search`
- `command palette`

## Core data model

- `SearchDocument`
- `IndexJob`
- `SearchFacet`

## Service / API contract

- GET /v1/search?q=&cursor=&filters=
- POST /internal/index/:entityType/:id

## Scale, concurrency and resilience

- Search service handles read fan-out instead of expensive wildcard DB queries.
- Index updates are asynchronous and coalesced for rapidly edited documents.
- Permission/workspace filters are first-class index fields.
- Backfills are throttled so they do not starve production indexing.

## Critical risks

- Stale index entries after permission revocation can leak metadata if filtering is weak.
- Never trust client-provided workspace filter as authorization.

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

- [ ] Permission revocation search test passes.
- [ ] Index rebuild from source of truth documented and tested.
- [ ] Search p95 target measured with production-like index size.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.