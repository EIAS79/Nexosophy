# Recursive Files, Folders and Typed Nodes

> **Plan path:** `plan/03-data-content/01-recursive-files-folders.md`

## Purpose

Build the core recursive information tree that every Nexosophy document and folder uses.

## Product outcomes

- Users can create arbitrary nested folders and typed files.
- Move/copy/rename/trash/restore operations are safe, permission-aware and history-aware.
- Every specialized module can attach to the same node identity.

## Required capabilities

- Node types: folder, note, document, whiteboard, dataset, spreadsheet, notebook, report, research item, lab record and attachment aliases.
- parent_id adjacency model with materialized path/closure assistance only if measurement requires it.
- Sibling name collision policy.
- Atomic move with cycle prevention.
- Recursive trash with original-parent restore metadata.
- Bulk selection/move/copy/trash.
- Favorites/pins/recent items.
- Shortcuts/links represented explicitly rather than duplicated content.

## Routes / surfaces

- `/workspace/:id/files`
- `/workspace/:id/node/:nodeId`

## Core data model

- `Node`
- `NodeMetadata`
- `Favorite`
- `RecentItem`
- `NodeTrashState`

## Service / API contract

- POST /v1/workspaces/:id/nodes
- PATCH /v1/nodes/:id
- POST /v1/nodes/:id/move
- POST /v1/nodes/bulk
- DELETE /v1/nodes/:id
- POST /v1/nodes/:id/restore

## Scale, concurrency and resilience

- Children endpoints are cursor-paginated and indexed by workspace_id,parent_id,sort key.
- Recursive operations execute as bounded background jobs above a threshold and expose progress.
- Bulk writes use batches and idempotency keys.
- Tree UI lazily loads branches; never fetch the entire workspace tree by default.

## Critical risks

- Moving a folder into its descendant must be rejected atomically.
- Permission inheritance and trash inheritance must be deterministic.
- Huge folder operations cannot hold one giant transaction.

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

- [ ] Cycle, race and concurrent move tests pass.
- [ ] 100k+ node synthetic workspace can browse without full-tree load.
- [ ] Bulk/trash recovery paths are resumable and auditable.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.