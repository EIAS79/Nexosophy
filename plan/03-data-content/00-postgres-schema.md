# PostgreSQL Data Architecture

> **Plan path:** `plan/03-data-content/00-postgres-schema.md`

## Purpose

Define PostgreSQL as the authoritative transactional store for Nexosophy business state, with schemas and access patterns that remain safe under multi-tenant concurrency.

## Product outcomes

- Strong tenant isolation and referential integrity.
- Predictable query plans for hot paths.
- Migrations that support rolling deploys.

## Required capabilities

- UUID/ULID-style stable IDs generated outside sequence hotspots where appropriate.
- workspace_id present on tenant-owned rows and indexed with common access keys.
- created_at/updated_at/version columns on mutable aggregates.
- Soft-delete markers only where product semantics require trash; hard-delete pipeline for privacy.
- Optimistic concurrency version for conflict-sensitive entities.
- Partial/covering indexes for hot filtered queries.
- JSONB only for extensible metadata, not as a substitute for relational modeling.
- pgvector optional for embeddings; full-text search is not the sole search service contract.

## Routes / surfaces

- `N/A`

## Core data model

- `users`
- `workspaces`
- `workspace_members`
- `nodes`
- `documents`
- `document_versions`
- `tasks`
- `events`
- `notifications`
- `subscriptions`
- `entitlements`
- `audit_events`
- `jobs`

## Service / API contract

- Repository layer requires workspace scope for tenant tables.
- Transactions wrap multi-table invariants; no business invariant depends on eventually consistent caches.
- Cursor pagination uses stable indexed order keys.

## Scale, concurrency and resilience

- Use pooled connections through managed pooler/PgBouncer-compatible endpoint.
- Set strict per-instance pool maximums so horizontal autoscaling cannot exhaust Postgres.
- Track slow queries, locks, dead tuples, index hit rate and connection saturation.
- Use set-based queries/batches; prohibit N+1 DB access in hot list endpoints.
- Partition only after measured need; avoid premature sharding.

## Critical risks

- Global queries missing workspace predicate can leak tenants.
- Autoscaling app instances with large local pools can create a connection storm.
- Long transactions and synchronous bulk operations create lock contention.

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

- [ ] Schema diagram and migration conventions committed.
- [ ] All tenant tables have tested tenant scoping/indexes.
- [ ] Connection budget and pool sizing documented per environment.
- [ ] Representative EXPLAIN plans captured for top hot queries.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.