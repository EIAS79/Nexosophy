# Phase 04 — Recursive Content & File/Folder System

> **Canonical execution file:** `plan/13-phases/phase-04-recursive-content-tree.md`

## Objective

Implement the universal recursive node model and user-facing workspace tree that all native document types will reuse.

## Owning specifications

- [01-recursive-files-folders.md](../03-data-content/01-recursive-files-folders.md)
- [00-postgres-schema.md](../03-data-content/00-postgres-schema.md)
- [00-api-contract.md](../04-api-scale/00-api-contract.md)

## Prerequisites

- [ ] Phase 03 exit gate passed.
- [ ] RBAC and workspace scoping mandatory in repository layer.
- [ ] Node naming/type/move semantics accepted.

## Required deliverables

- [ ] Universal Node schema/migrations.
- [ ] Folder and typed-file node creation.
- [ ] Lazy-loaded tree/list APIs with cursor pagination.
- [ ] Create/rename/move/copy/bulk operations.
- [ ] Atomic cycle prevention for moves.
- [ ] Breadcrumbs and path resolution.
- [ ] Favorites/pins/recent items.
- [ ] Tree/list explorer UI with keyboard and touch interactions.
- [ ] Drag/drop plus accessible move dialog.
- [ ] Trash marker/original-parent metadata hooks for Phase 07.
- [ ] Large-subtree job boundary for operations above synchronous threshold.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Deep nesting and cycle attempts.
- [ ] Concurrent move/rename races.
- [ ] 100k-node synthetic workspace browse test without full-tree fetch.
- [ ] Cross-workspace move prohibition unless explicit copy/export flow.
- [ ] Pagination consistency under concurrent inserts.
- [ ] Keyboard tree navigation and mobile explorer flows.

## Exit gate

- [ ] All future native document types can live anywhere in the same tree.
- [ ] No endpoint loads an entire large workspace tree by default.
- [ ] Subtree operations are bounded/resumable where necessary.
- [ ] Permission and workspace scope are enforced server-side for every node operation.

## Phase completion record

- Commit/PR:
- Migration version(s):
- Staging deployment:
- Test report:
- Load/performance evidence where applicable:
- Known deferred items (must not violate exit gate):
- Approval/date: