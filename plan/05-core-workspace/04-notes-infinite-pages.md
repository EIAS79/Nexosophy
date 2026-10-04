> **Canonical Nexosophy migration:** Detailed product behavior preserved from the prior implementation specification. Cross-cutting API, database, scale, auth and billing rules are owned by the canonical specs under `plan/02-identity-billing/`, `plan/03-data-content/`, and `plan/04-api-scale/`.

# Notes, Infinite Pages, Ink & Flexible Layouts

> Status: implementation specification. This document is normative for this module unless the master plan explicitly overrides it.

**Master plan:** [`../README.md`](../README.md)  
**Delivery phase(s):** Phase 9  
**Related systems:** `editor platform`, `media`, `offline sync`, `search/OCR`, `history`, `templates`

## 1. Purpose

Defines the OneNote-class note system: notebooks/sections/pages, infinite or paged canvases, free-positioned content, typing, ink, highlighting, images, audio, and mixed media.

### Success condition
The module is complete only when its primary workflows work end-to-end on phone, tablet, desktop, keyboard-only, and supported assistive technology paths; all writes are authorized server-side; data survives refresh/reconnect; error states are recoverable; and the behavior is covered by automated tests.

## 2. Scope and boundaries

- Build the complete user workflow, not only the visible page.
- Include empty, loading, success, degraded, offline where applicable, permission-denied, validation-error, and destructive-action states.
- Do not duplicate another module’s source of truth. Link to the canonical entity instead.
- Keep the module extensible through typed capabilities/events rather than hard-coded role branches.
- Every destructive or security-sensitive action must have explicit authorization, auditability where appropriate, and predictable recovery semantics.

## 3. Primary routes / surfaces

- `/workspace/:workspaceId/notes`
- `/workspace/:workspaceId/note/:nodeId`

Every route must support direct linking, refresh, browser back/forward navigation, authentication return-to behavior, and a valid not-found / no-access state.

## 4. Domain model

Primary entities:

- `Notebook`
- `NoteSection`
- `NotePage`
- `CanvasElement`
- `TextElement`
- `InkStroke`
- `InkHighlighter`
- `AudioAnchor`
- `PageBackground`
- `PageViewport`

### Required entity conventions

- Stable opaque ID; never expose sequential IDs as an authorization boundary.
- Workspace/tenant scope on every workspace-owned row.
- `created_at`, `updated_at`, creator/updater identity where meaningful, and optimistic concurrency/version field for contested writes.
- Soft-delete/retention semantics when the object is recoverable; hard deletion only through the deletion pipeline.
- Audit events for permission changes, destructive actions, sensitive exports, signatures, and security-relevant mutations.
- Search/index projection and activity events are derived from canonical transactional data, not the other way around.

## 5. Complete feature contract

### 5.1 Notebook/section/page hierarchy without breaking universal nodes

- Implement **Notebook/section/page hierarchy without breaking universal nodes** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.2 Infinite canvas

- Implement **Infinite canvas** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.3 Fixed paper sizes

- Implement **Fixed paper sizes** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.4 Ruled/grid/dot/plain backgrounds

- Implement **Ruled/grid/dot/plain backgrounds** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.5 Free-position text boxes

- Implement **Free-position text boxes** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.6 Rich text inside text regions

- Implement **Rich text inside text regions** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.7 Pen/pencil/highlighter

- Implement **Pen/pencil/highlighter** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.8 Eraser/lasso

- Implement **Eraser/lasso** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.9 Shapes

- Implement **Shapes** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.10 Images/PDF snippets

- Implement **Images/PDF snippets** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.11 Audio recordings with timestamp anchors

- Implement **Audio recordings with timestamp anchors** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.12 Links/files/embeds

- Implement **Links/files/embeds** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.13 Page templates

- Implement **Page templates** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.14 Page reorder

- Implement **Page reorder** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.15 Section colors

- Implement **Section colors** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.16 OCR hooks

- Implement **OCR hooks** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.17 Handwriting search hooks

- Implement **Handwriting search hooks** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.18 Zoom/pan

- Implement **Zoom/pan** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.19 Print/export

- Implement **Print/export** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

## 6. Core user flows

- new note → choose page style → write/type/draw
- record lecture → audio timeline → create timestamp anchors
- lasso ink → move/resize/group
- switch page mode → preserve coordinates via safe transform or require duplication

### Flow rules

- Preserve user context after authentication, refresh, reconnect, or recoverable failures.
- Mutations must be idempotent where retries are plausible.
- Optimistic UI is allowed only when rollback is deterministic and the server remains authoritative.
- Long-running work must leave the initiating page and continue through a job/activity model; never trap the user in a modal waiting for completion.

## 7. UI architecture

- Use the shared application shell, design tokens, dialogs/sheets, menus, toasts, skeletons, form controls, empty states, and error states.
- Keep primary actions visually stable across screen sizes; responsive adaptation may move them but must not remove them.
- Preserve a clear information hierarchy: page title/context → primary action → content → secondary metadata → destructive/admin actions.
- Use virtualization for unbounded lists/grids and progressive disclosure for advanced controls.
- Persist user view preferences only when they improve repeated use; do not create hidden state the user cannot reset.

## 8. Responsive behavior

- Phone defaults to vertical page with pan/zoom for infinite mode
- Tablet prioritizes stylus; palm rejection and hover previews where platform supports
- Desktop supports mouse/trackpad + keyboard and large canvas minimap
- Toolbars move away from active pen region and mobile keyboard

### Device contract

| Width / input context | Required behavior |
|---|---|
| 320–599 px phone | Single primary pane, no horizontal page overflow, sheet/full-screen secondary surfaces, touch targets ≥44 px |
| 600–1023 px tablet | Adaptive one/two pane, stylus support where relevant, hardware-keyboard parity |
| 1024–1439 px desktop | Persistent navigation where useful, optional inspector/split view, full keyboard shortcuts |
| 1440 px+ wide | More simultaneous context, not wider unreadable text; cap prose width and use side panes |
| Any size + zoom | Must remain operable at browser zoom and OS text scaling; no clipped critical actions |

## 9. Accessibility requirements

- WCAG 2.2 AA target for product UI.
- Correct landmarks, headings, labels, names/roles/values, error association, and live-region announcements.
- Full keyboard path for every non-drawing action; visible focus; logical focus order; escape/close semantics.
- Drawing/spatial features require a meaningful non-canvas representation for critical information where feasible.
- Color is never the sole carrier of status. Respect reduced motion and contrast preferences.
- Automated checks are necessary but not sufficient: include manual keyboard and screen-reader acceptance passes on primary workflows.

## 10. Authorization and security

- Resolve actor, workspace, membership, object scope, and capability on the server for every mutation and sensitive read.
- Never trust hidden buttons, route guards, client claims, cached roles, or object IDs as authorization.
- Sanitize user-provided rich content and external embeds; validate MIME/signatures for files where applicable.
- Rate-limit abuse-prone endpoints and use idempotency keys for retryable writes.
- Emit security/audit events for access changes, destructive actions, exports of sensitive data, and policy-controlled actions.

## 11. API / service responsibilities

- Typed create/read/update/list/delete-or-archive operations with explicit permission checks.
- Cursor pagination for collections; stable sort keys; filters validated server-side.
- Concurrency control for edits that can overwrite meaningful state.
- Domain events through the transactional outbox for search, notifications, analytics, and background processing.
- Background jobs for expensive conversion, export, indexing, media processing, or bulk work; progress must be queryable.
- Consistent error envelope: code, user-safe message, recoverability, field errors where applicable, request/correlation ID.

## 12. Search, history, notifications, and analytics hooks

- Define exactly which fields are searchable and which are excluded because they are sensitive or noisy.
- Significant content changes create version/history entries according to the document/version policy.
- User-facing events generate notifications only through the preference/deduplication layer, never ad hoc emails from feature code.
- Analytics events contain IDs/categories/state transitions—not private document bodies, recordings, source identities, or sensitive research data.

## 13. Offline and synchronization behavior

- Classify each action as offline-supported, read-cache-only, or online-required.
- Offline-supported mutations must use a durable local queue with idempotent replay and visible sync state.
- Conflicts must be merged automatically only when semantics are safe; otherwise show a user-resolvable conflict rather than silently discarding data.
- Security/permission revocations override cached access on reconnect and as soon as an online client is notified.

## 14. Edge cases that must be tested

- massive canvas coordinates
- thousands of strokes
- audio permission denied
- recording interrupted
- orientation change
- stylus + finger ambiguity
- offline drawing conflicts
- PDF export beyond finite bounds

Also test: network loss during mutation, duplicate submission, stale client version, authorization removal while open, deleted linked object, quota/plan limit, and service dependency timeout.

## 15. Performance targets

- Initial useful content should render without waiting for noncritical secondary data.
- User input/selection feedback should feel immediate; expensive persistence runs asynchronously when safe.
- Lists and grids must remain usable with large realistic datasets through pagination/virtualization.
- Avoid loading editor engines, charting libraries, or heavy integrations on routes that do not use them.
- Define module-specific p95 API and UI latency budgets before production sign-off and track them in observability.

## 16. Test plan

### Unit
- Domain validation, permission predicates, state transitions, recurrence/formula/parser logic where relevant.

### Integration
- Database constraints/transactions, API authorization, event emission, job handling, search/index updates, object-storage interactions.

### End-to-end
- Happy path plus destructive/recovery path on desktop.
- Primary path on a phone viewport and a tablet viewport.
- Keyboard-only path for all non-drawing controls.
- Refresh/reconnect midway through a meaningful edit or mutation.
- Permission loss and stale-session behavior.

## 17. Acceptance criteria

- [ ] All listed features have working production UI and backend behavior; no placeholder buttons.
- [ ] Direct links, refresh, back/forward, and no-access/not-found states work.
- [ ] Phone, tablet, and desktop layouts pass the device contract.
- [ ] Keyboard and accessibility acceptance paths pass.
- [ ] Server-side authorization and tenant isolation tests pass.
- [ ] Failure/retry/offline behavior is explicit and data is not silently lost.
- [ ] Search/history/notification/analytics hooks are implemented where applicable.
- [ ] Performance budget and observability dashboards exist before production rollout.
- [ ] Documentation and migration notes are updated.

## 18. Implementation stages

1. **Contract** — finalize schema, permissions, events, routes, responsive states, and acceptance tests.
2. **Backend foundation** — migrations, repositories/services, authorization, API contracts, events/jobs.
3. **Core UI** — complete primary workflow with loading/empty/error/read-only states.
4. **Cross-system wiring** — search, history, notifications, audit, analytics, imports/exports as relevant.
5. **Responsive/accessibility pass** — phone, tablet, desktop, keyboard, screen reader, reduced motion.
6. **Reliability pass** — offline/reconnect, idempotency, concurrency, retries, bulk/large-data behavior.
7. **Production gate** — automated suite, load/security checks, observability, runbook, staged rollout.

## 19. Definition of done

This module is **not done** when the page merely renders. It is done when creation, retrieval, editing/action, persistence, permissions, recovery, responsive behavior, accessibility, observability, and automated verification all meet this specification and the global Definition of Done in the master plan.

## 20. Note-specific implementation architecture

### 20.1 Notebook, section, and page structure

The visible notebook hierarchy is a specialized projection over the universal node system, not a second independent tree.

```text
Workspace
└── Notebook node
    ├── Section node
    │   ├── Note Page node
    │   └── Note Page node
    └── Section Group node (optional future extension)
        └── Section node
```

Rules:

- A note page remains addressable as a universal `Node` so it can be moved, linked, shared, searched, versioned, trashed, and restored using the same core infrastructure.
- Notebook and section ordering uses an explicit sortable rank; never infer order from creation timestamp.
- Moving a page between sections updates the node parent and section rank atomically.
- Cross-workspace moves must be treated as copy + permission-safe remap unless ownership/storage semantics explicitly support a true move.
- A page may have one canonical parent but can be referenced from many other locations through links/shortcuts.

### 20.2 Page modes

Nexosophy supports distinct page geometry modes rather than pretending one layout solves every use case.

| Mode | Behavior | Best for |
|---|---|---|
| Infinite | Unbounded 2D coordinate space with viewport origin/zoom | Freeform lecture notes, mind maps, mixed handwriting |
| Vertical continuous | Bounded width, vertically growing document-like surface | Typed class notes, reading notes |
| Fixed paper | A4/Letter/custom fixed pages with explicit page breaks | Printable coursework, handwritten worksheets |
| Grid/ruled/dot | Background style layered onto infinite/fixed modes | Handwriting, maths, diagrams |

A page stores its mode explicitly. Changing modes must never destructively rewrite coordinates without preview. Where lossless transformation is not guaranteed, “Convert a copy” is the default action.

### 20.3 Canvas coordinate model

- Store world coordinates independently from viewport pixels.
- The viewport stores `{originX, originY, zoom}` per device/user preference, not in shared document content.
- Use a stable coordinate precision that prevents drift after repeated zoom/transform operations.
- Elements have explicit `x`, `y`, `width`, `height`, `rotation`, `zIndex/rank`, and optional grouping metadata.
- The renderer culls off-screen elements and uses spatial indexing for large canvases.
- Selection boxes and handles operate in screen coordinates but mutations resolve back into world coordinates.

### 20.4 Element model

Each page contains typed elements. Minimum first-class types:

- `text_region`
- `ink_stroke`
- `highlighter_stroke`
- `shape`
- `image`
- `audio_anchor`
- `file_attachment`
- `link_card`
- `embed`
- `group`

Every element requires an ID, type, geometry, created/updated metadata, author, and payload schema version. Unknown future element types must degrade to a safe placeholder instead of making the page unreadable.

### 20.5 Text regions

Text regions are rich-text subdocuments, not plain strings.

- Click/tap empty canvas to create a region.
- Regions can auto-grow vertically.
- Width may be fixed by user resize or auto-sized within sensible bounds.
- Rich formatting uses the shared editor primitives where possible.
- Pasting text/images/files routes through the same sanitation and upload pipeline as the rich document editor.
- Text selection and canvas object selection must have deterministic mode switching so drag gestures do not accidentally move a text box while selecting text.

### 20.6 Ink engine

Each stroke should preserve enough raw information for faithful redraw and future handwriting features:

```text
stroke
- id
- tool: pen | pencil | highlighter
- points[]
  - x, y
  - pressure (when available)
  - tiltX / tiltY (when available)
  - timestamp delta
- width
- opacity
- color token/value
- blend behavior
- author
- createdAt
```

Requirements:

- Smooth rendering must not mutate the canonical raw input beyond an explicitly versioned simplification algorithm.
- Highlighter uses appropriate compositing so repeated strokes behave predictably.
- Eraser supports stroke erasing first; partial/vector erasing may be added only with deterministic geometry and history behavior.
- Lasso selection supports move, resize when semantically valid, group, delete, duplicate, and color/tool changes.
- Palm rejection relies on pointer type/platform capabilities when available; finger input can pan while pen input inks under a user preference.

### 20.7 Audio-linked lecture notes

Recording is a first-class note capability.

- Audio is uploaded in chunks so a long lecture is not lost if connectivity changes.
- The page stores an `AudioRecording` asset plus timeline metadata.
- A text/ink element may store `audioOffsetMs` linking it to the point in the recording when it was created or explicitly anchored.
- Tapping an anchored marker seeks playback to that offset.
- Recording start/stop/pause state must survive navigation warnings and accidental page changes through explicit confirmation.
- If microphone permission is denied/revoked, the note remains fully usable and the UI explains how to re-enable recording.
- Transcription, if later enabled, is an asynchronous derived artifact and never replaces the original recording.

### 20.8 Page backgrounds and paper templates

A background is separate from foreground content.

- Plain, ruled, grid, dot, dark-paper variants.
- Configurable spacing/scale within controlled bounds.
- A4/Letter orientation for fixed paper.
- User-imported background PDF/image may be supported as a locked base layer.
- Background changes must not reposition foreground elements.

### 20.9 Layering and selection

- Explicit z-order with bring forward/back/front/back commands.
- Locked objects cannot be moved accidentally but remain selectable through the layer/inspector UI.
- Grouped objects preserve internal relative geometry.
- Multi-select works with Shift on desktop, lasso on canvas, and explicit selection mode on touch devices.
- “Select all” is scoped to current page, not entire notebook.

### 20.10 Autosave and collaboration

The client maintains a local editing buffer and a collaboration/sync document for note elements.

- Local edits render immediately.
- Operations are persisted incrementally; do not serialize and rewrite a megabyte-scale whole canvas for every pen stroke.
- Stroke creation is batched into sensible transactions.
- Presence data such as live cursor/viewport is ephemeral and is not version history.
- Version checkpoints aggregate operations into user-readable history points.
- On reconnection, CRDT/operation merge handles independent additions/moves where safe; semantic conflicts such as delete-vs-edit are surfaced if automatic convergence would surprise the user.

### 20.11 Note UI map

**Desktop**

```text
┌ Workspace navigation ┬ Notebook / sections ┬ Page tabs/list ┬──────── Canvas / page ────────┬ Inspector ┐
│                      │                     │                │                               │           │
└──────────────────────┴─────────────────────┴────────────────┴───────────────────────────────┴───────────┘
```

The user can collapse navigation/inspector to prioritize writing space.

**Tablet**

- Collapsible notebook/section pane.
- Full canvas as primary surface.
- Pen toolbar can dock left/right/top and remember preference.
- Stylus hover previews where supported.
- Two-finger pan/zoom; stylus writes by default when pen mode active.

**Phone**

- Notebook → section → page drill-down.
- Page list is a full screen rather than a permanently visible narrow pane.
- Bottom tool strip for type/pen/highlight/insert/more.
- Infinite canvas has explicit hand/pan mode to avoid accidental ink.
- Text editing moves formatting controls above the software keyboard.

### 20.12 Keyboard and gesture contract

Desktop/tablet keyboard examples:

- `Ctrl/Cmd+N`: new page in current section.
- `Ctrl/Cmd+Shift+N`: new section where context allows.
- `Ctrl/Cmd+Z` / redo: editor transaction history.
- `Space+drag` or configurable hand tool: pan canvas.
- Delete/Backspace on selected canvas objects: delete with undo support.
- Arrow keys: nudge selected objects; modifier increases/decreases step.

Touch/stylus:

- One-finger behavior depends on selected tool.
- Two-finger gesture pans/zooms regardless of drawing tool.
- Long press opens context actions without being required for essential commands.

### 20.13 Note APIs / commands

Representative service contracts:

```text
POST   /workspaces/:w/notebooks
POST   /notebooks/:id/sections
POST   /sections/:id/pages
GET    /pages/:id/snapshot
POST   /pages/:id/operations
POST   /pages/:id/checkpoints
PATCH  /pages/:id/settings
POST   /pages/:id/recordings
POST   /recordings/:id/chunks
POST   /recordings/:id/finalize
POST   /pages/:id/export
```

Bulk element operations use typed operation batches with idempotency keys and document-version/collaboration metadata; they are not arbitrary JSON patch endpoints.

### 20.14 Search behavior

Index:

- page title;
- typed text;
- tags;
- attachment metadata;
- OCR/transcript text only after its derived artifact is ready;
- optionally recognized handwriting text as derived data, clearly separated from canonical ink.

Search results must deep-link to the page and, where possible, to the matching region/element without exposing hidden content in snippets.

### 20.15 Print/export

- Fixed pages export deterministically to PDF.
- Infinite pages require export bounds: current viewport, selection, content bounds, or tiled pages.
- Very large content-bounds exports become background jobs.
- Audio is never silently embedded into a PDF; export metadata may include linked transcript/recording references when chosen.
- Native archive export preserves vectors, positions, assets, and links for round-trip recovery.