# Phase 09 — Notes, Infinite Pages & Whiteboard

> **Canonical execution file:** `plan/13-phases/phase-09-notes-whiteboard.md`

## Objective

Deliver the flexible OneNote-class note system and visual canvas on top of the universal editor/realtime platform.

## Owning specifications

- [04-notes-infinite-pages.md](../05-core-workspace/04-notes-infinite-pages.md)
- [05-whiteboard-canvas.md](../05-core-workspace/05-whiteboard-canvas.md)
- [06-media-attachments.md](../05-core-workspace/06-media-attachments.md)
- [02-editor-platform.md](../05-core-workspace/02-editor-platform.md)

## Prerequisites

- [x] Phase 08 implementation foundation available on the shared tranche branch; formal Phase 08 gate intentionally deferred.
- [x] Editor capability/plugin boundaries stable.
- [x] Media asset insertion contract stable.

## Required deliverables

- [x] Notebook/section/page hierarchy mapped to universal nodes.
- [x] Infinite, vertical and fixed-page modes.
- [x] Typed blocks/free-positioned text.
- [x] Ink/highlighter/eraser/lasso with pressure/tilt where available.
- [x] Images/files/audio embeds and anchors.
- [x] Page backgrounds/grids/templates.
- [x] Whiteboard shapes, connectors, frames, sticky notes and grouping.
- [x] Viewport/pan/zoom/minimap semantics.
- [x] Tablet stylus palm rejection/input-mode behavior.
- [x] Export/print behavior for finite and infinite canvases.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Refresh/reconnect preserves acknowledged edits.
- [ ] Offline merge/recovery.
- [ ] Large page virtualization.
- [ ] Stylus/touch/keyboard interaction tests.
- [ ] Accessible alternative structure for canvas content.
- [ ] Concurrent ink/object edits converge.

## Exit gate

- [ ] Core note flows pass desktop/tablet/phone.
- [ ] Large notes remain within performance budget.
- [x] No editor-specific parallel permission/history model exists.

## Completion record

- Commit/PR: implementation completed on `phases-05-07-storage-editor-history`; merge intentionally deferred.
- Migration(s): `0008_notes_whiteboard.sql`.
- Staging deployment: intentionally deferred; Vercel previews are suppressed for the shared implementation branch.
- Test evidence: CI/typecheck/lint/build/integration matrix intentionally pending for the later combined validation tranche.
- Performance evidence: viewport-bounded element loading, paginated server queries, incremental CRDT registers and minimap/object-list fallback are implemented; measured staging evidence remains pending.
- Deferred items: formal Phase 08/09 gates and automated interaction/performance suites only.
- Approval/date: implementation deliverables completed 2026-10-08; validation approval pending.
