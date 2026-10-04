# Realtime Collaboration and Presence

> **Plan path:** `plan/04-api-scale/04-realtime-collaboration.md`

## Purpose

Support collaborative editing, presence and live updates without coupling realtime state to one server instance.

## Product outcomes

- Multiple users can edit supported documents concurrently.
- Presence/comments/changes propagate quickly.
- Reconnects recover from transient network loss.

## Required capabilities

- CRDT-based document collaboration (Yjs-compatible design recommended).
- Realtime gateway/websocket service.
- Room authorization from server-side workspace/resource grants.
- Presence/cursors/selection ephemeral state.
- Document update persistence/checkpointing.
- Redis/pub-sub or managed channel backplane across replicas.
- Offline update merge and reconnect.
- Comment/mention events persisted separately from ephemeral presence.

## Routes / surfaces

- `wss realtime endpoint`
- `document editor routes`

## Core data model

- `CollaborationRoom`
- `DocumentUpdate`
- `Snapshot`
- `PresenceState`

## Service / API contract

- Realtime token/room join is short-lived and resource scoped.
- Periodic durable checkpoints compact CRDT update log.
- Authorization revalidated on reconnect and permission-version change.

## Scale, concurrency and resilience

- Realtime fleet scales independently from REST API.
- Rooms are distributed across instances; shared backplane propagates cross-instance events.
- Hot-room limits and message size/rate controls prevent one document from exhausting a node.
- Load tests cover thousands of concurrent sockets and representative active-edit traffic before launch.

## Critical risks

- Presence is disposable; document updates are not.
- Permission revocation must disconnect/deny ongoing sessions promptly.

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

- [ ] Concurrent/offline merge tests pass.
- [ ] Replica restart does not lose durable document state.
- [ ] Hot-room stress test and reconnect storm test pass.
- [ ] Failure/retry behavior tested.
- [ ] Telemetry and operational ownership documented.
- [ ] Spec/API/schema docs updated.