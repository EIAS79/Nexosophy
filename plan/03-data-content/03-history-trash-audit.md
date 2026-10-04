# Version History, Trash, Recovery and Audit

> **Plan path:** `plan/03-data-content/03-history-trash-audit.md`

## Purpose

Protect users from accidental loss while preserving an immutable security/audit trail for sensitive actions.

## Product outcomes

- Users can inspect and restore document versions.
- Deleted items remain recoverable for policy-defined period.
- Admins can trace permission/billing/security changes.

## Required capabilities

- Document snapshot/delta history depending editor type.
- Named versions and restore-as-new-version.
- Trash retention countdown.
- Bulk restore/permanent delete.
- Audit events for auth, membership, permissions, billing admin and destructive actions.
- Actor, target, workspace, request ID, timestamp and metadata in audit event.

## Routes / surfaces

- `/history/:nodeId`
- `/trash`
- `/workspace/:id/settings/audit`

## Core data model

- `DocumentVersion`
- `TrashEntry`
- `AuditEvent`

## Service / API contract

- GET /v1/nodes/:id/versions
- POST /v1/nodes/:id/versions/:versionId/restore
- GET /v1/trash
- DELETE /v1/trash/:id/permanent

## Scale, concurrency and resilience

- Editor autosave history is compacted so every keystroke is not a full DB row/blob.
- Old versions may move to object storage with DB manifests.
- Audit tables use append-only write path and time-based partition/archive when volume requires.

## Critical risks

- Restoring a version must not silently bypass current permissions.
- Audit logs should not contain sensitive document bodies or secrets.

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

- [ ] Recovery tested after delete, move and version restore.
- [ ] Retention job is idempotent and restartable.
- [ ] Audit events cover all privileged mutations.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.