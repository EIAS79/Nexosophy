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

- [ ] Phase 08 passed.
- [ ] Editor capability/plugin boundaries stable.
- [ ] Media asset insertion contract stable.

## Required deliverables

- [ ] Notebook/section/page hierarchy mapped to universal nodes.
- [ ] Infinite, vertical and fixed-page modes.
- [ ] Typed blocks/free-positioned text.
- [ ] Ink/highlighter/eraser/lasso with pressure/tilt where available.
- [ ] Images/files/audio embeds and anchors.
- [ ] Page backgrounds/grids/templates.
- [ ] Whiteboard shapes, connectors, frames, sticky notes and grouping.
- [ ] Viewport/pan/zoom/minimap semantics.
- [ ] Tablet stylus palm rejection/input-mode behavior.
- [ ] Export/print behavior for finite and infinite canvases.

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
- [ ] No editor-specific parallel permission/history model exists.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: