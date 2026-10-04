# Phase 08 — Realtime Collaboration, Comments & Sharing Experience

> **Canonical execution file:** `plan/13-phases/phase-08-realtime-collaboration.md`

## Objective

Add safe multi-user collaboration after permissions, content identity and history are stable.

## Owning specifications

- [04-realtime-collaboration.md](../04-api-scale/04-realtime-collaboration.md)
- [02-workspaces-rbac-sharing.md](../02-identity-billing/02-workspaces-rbac-sharing.md)
- [02-editor-platform.md](../05-core-workspace/02-editor-platform.md)

## Prerequisites

- [ ] Phase 07 passed.
- [ ] Realtime backplane and room authorization design accepted.

## Required deliverables

- [ ] Realtime gateway/websocket deployment.
- [ ] CRDT document room model and persistence/checkpoints.
- [ ] Presence/cursor/selection ephemeral state.
- [ ] Comments, threads, mentions and resolution.
- [ ] Room-scoped authorization tokens.
- [ ] Permission revocation disconnect/invalidation.
- [ ] Reconnect/offline merge path.
- [ ] Notification events for mentions/comments.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Concurrent editing convergence.
- [ ] Replica restart without durable update loss.
- [ ] Permission revocation during active session.
- [ ] Reconnect storm test.
- [ ] Hot-room message/rate limits.
- [ ] Thousands-of-sockets staging stress test.

## Exit gate

- [ ] Realtime service scales separately from REST API.
- [ ] Presence loss does not imply content loss.
- [ ] Conflict-safe edits and comment permissions pass integration tests.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: