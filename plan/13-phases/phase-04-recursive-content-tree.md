# Phase 04 — Recursive Content & File/Folder System

> **Canonical execution file:** `plan/13-phases/phase-04-recursive-content-tree.md`

## Objective

Implement the universal recursive node model and user-facing workspace tree that all native document types will reuse.

## Owning specifications

- [01-recursive-files-folders.md](../03-data-content/01-recursive-files-folders.md)
- [00-postgres-schema.md](../03-data-content/00-postgres-schema.md)
- [00-api-contract.md](../04-api-scale/00-api-contract.md)

## Prerequisites

- [x] Phase 03 exit gate passed.
- [x] RBAC and workspace scoping mandatory in repository layer.
- [x] Node naming/type/move semantics accepted.

## Required deliverables

- [x] Universal Node schema/migrations.
- [x] Folder and typed-file node creation.
- [x] Lazy-loaded tree/list APIs with cursor pagination.
- [x] Create/rename/move/copy/bulk operations.
- [x] Atomic cycle prevention for moves.
- [x] Breadcrumbs and path resolution.
- [x] Favorites/pins/recent items.
- [x] Tree/list explorer UI with keyboard and touch interactions.
- [x] Drag/drop plus accessible move dialog.
- [x] Trash marker/original-parent metadata hooks for Phase 07.
- [x] Large-subtree job boundary for operations above synchronous threshold.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [x] Deep nesting and cycle attempts.
- [x] Concurrent move/rename races.
- [x] 100k-node synthetic workspace browse test without full-tree fetch.
- [x] Cross-workspace move prohibition unless explicit copy/export flow.
- [x] Pagination consistency under concurrent inserts.
- [x] Keyboard tree navigation and mobile explorer flows.

## Exit gate

- [x] All future native document types can live anywhere in the same tree.
- [x] No endpoint loads an entire large workspace tree by default.
- [x] Subtree operations are bounded/resumable where necessary.
- [x] Permission and workspace scope are enforced server-side for every node operation.

## Phase completion record

- Commit/PR:
  - PR #11 — `Phase 04: recursive content tree and explorer` — initial implementation merged into `main` at `c9bfd51e0912938db790569aa041e45d8b748ee9`.
  - PR #17 — `Phase 04: close recursive content exit-gate findings` — closes the post-merge correctness review findings for idempotent bulk moves, repeat trash/restore parent tracking, queued-copy destination revalidation, empty 204 API responses and unrestricted supported tree depth/path resolution.
- Migration version(s): `0003_recursive_content_tree.sql`; remediation required no schema change and reuses the existing `content_idempotency` ledger.
- Staging deployment:
  - Phase 04 implementation was preview/deployment validated on PR #11 with a successful Vercel status.
  - Backend behavior is validated in the production-like GitHub integration workflow using PostgreSQL and Redis service containers; the Phase 04 remediation does not introduce a new external provider dependency.
- Test report:
  - Initial Phase 04 PR #11: CI Fast run `37606445448` — success; Build run `37606445451` — success; Backend Integration run `37606445477` — success.
  - Exit-gate remediation PR #17, head `9ed674a15c408090d54ffe13420eb7ef67f6d0aa`: CI Fast run `37634383936` — success; Build run `37634383949` — success; Backend Integration run `37634383994` — success.
  - Regression coverage explicitly exercises >128-level breadcrumbs/path resolution, repeated trash/restore after a move, queued-copy destination invalidation, bulk-move idempotent replay, cycle prevention, concurrent mutation races, cross-workspace isolation and cursor pagination.
- Load/performance evidence where applicable:
  - PostgreSQL integration suite creates a 100,000-node synthetic workspace and verifies cursor-bounded browsing without a full-tree fetch.
  - Large subtrees cross the synchronous threshold into resumable worker jobs with bounded batches; the remediation revalidates queued-copy destinations under the workspace tree lock.
- Known deferred items (must not violate exit gate): none for the Phase 04 exit gate. Repository-level `main` branch/ruleset enforcement remains tracked under Phase 00 rather than deferred from Phase 04.
- Approval/date: Phase 04 engineering exit gate revalidated 2026-10-07 after PR #17 remediation checks passed.