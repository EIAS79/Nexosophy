> **Canonical Nexosophy migration:** Detailed product behavior preserved from the prior implementation specification. Cross-cutting API, database, scale, auth and billing rules are owned by the canonical specs under `plan/02-identity-billing/`, `plan/03-data-content/`, and `plan/04-api-scale/`.

# Universal Editor Platform & Document Runtime

> Status: implementation specification. This document is normative for this module unless the master plan explicitly overrides it.

**Master plan:** [`../README.md`](../README.md)  
**Delivery phase(s):** Phase 6, Phase 9, Phase 13, Phase 20  
**Related systems:** `files`, `history`, `collaboration`, `offline sync`, `export`

## 1. Purpose

Defines the common editor shell used by rich documents, notes, reports, spreadsheets, code, whiteboards, and future document types.

### Success condition
The module is complete only when its primary workflows work end-to-end on phone, tablet, desktop, keyboard-only, and supported assistive technology paths; all writes are authorized server-side; data survives refresh/reconnect; error states are recoverable; and the behavior is covered by automated tests.

## 2. Scope and boundaries

- Build the complete user workflow, not only the visible page.
- Include empty, loading, success, degraded, offline where applicable, permission-denied, validation-error, and destructive-action states.
- Do not duplicate another module’s source of truth. Link to the canonical entity instead.
- Keep the module extensible through typed capabilities/events rather than hard-coded role branches.
- Every destructive or security-sensitive action must have explicit authorization, auditability where appropriate, and predictable recovery semantics.

## 3. Primary routes / surfaces

- `/workspace/:workspaceId/item/:nodeId/edit`

Every route must support direct linking, refresh, browser back/forward navigation, authentication return-to behavior, and a valid not-found / no-access state.

## 4. Domain model

Primary entities:

- `Document`
- `DocumentType`
- `DocumentState`
- `EditorCapability`
- `AutosaveCheckpoint`
- `PresenceSession`
- `EditorPlugin`

### Required entity conventions

- Stable opaque ID; never expose sequential IDs as an authorization boundary.
- Workspace/tenant scope on every workspace-owned row.
- `created_at`, `updated_at`, creator/updater identity where meaningful, and optimistic concurrency/version field for contested writes.
- Soft-delete/retention semantics when the object is recoverable; hard deletion only through the deletion pipeline.
- Audit events for permission changes, destructive actions, sensitive exports, signatures, and security-relevant mutations.
- Search/index projection and activity events are derived from canonical transactional data, not the other way around.

## 5. Complete feature contract

### 5.1 Shared title/header shell

- Implement **Shared title/header shell** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.2 Autosave state machine

- Implement **Autosave state machine** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.3 Undo/redo contract

- Implement **Undo/redo contract** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.4 Dirty-state handling

- Implement **Dirty-state handling** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.5 Document locks only where required

- Implement **Document locks only where required** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.6 Slash/insert menu

- Implement **Slash/insert menu** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.7 Command routing

- Implement **Command routing** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.8 Comments hooks

- Implement **Comments hooks** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.9 Version hooks

- Implement **Version hooks** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.10 Export hooks

- Implement **Export hooks** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.11 Presence hooks

- Implement **Presence hooks** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.12 Keyboard shortcuts

- Implement **Keyboard shortcuts** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.13 Editor plugins/capabilities

- Implement **Editor plugins/capabilities** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.14 Read-only fallback

- Implement **Read-only fallback** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

## 6. Core user flows

- open item → capability resolver → correct editor → load current version
- edit → local state → autosave → server version acknowledgment
- network loss → offline queue → reconnect → merge/conflict flow
- unsupported type → safe preview/download rather than corrupt edit

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

- Editor chrome collapses on mobile
- Tablet exposes pen toolbar contextually
- Desktop can show outline + editor + inspector
- Text readable width is independent from window width
- Bottom bars avoid mobile keyboard overlap

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

- document deleted while open
- permission downgraded mid-edit
- autosave fails
- schema version mismatch
- plugin crash
- large doc memory pressure

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

## 20. Editor-platform detailed architecture

### 20.1 Editor registry

The application uses a registry that resolves a node/document type to an editor capability set. Do not scatter `if type === ...` logic through route components.

```text
EditorDescriptor
- documentType
- viewerComponent
- editorComponent
- capabilities
  - richText
  - spatialCanvas
  - comments
  - realtime
  - offlineEdit
  - versionDiff
  - print
  - exportFormats[]
  - insertableTypes[]
- minimumPlan / featureFlag where applicable
- migration/schemaVersion handlers
```

The route shell asks the registry for capabilities, then composes only the relevant toolbar, sidebar, collaboration, history, and export UI.

### 20.2 Shared editor state machine

```text
LOADING
  -> READY_READONLY
  -> READY_EDITABLE
READY_EDITABLE
  -> SAVING
  -> OFFLINE_DIRTY
  -> CONFLICT
  -> ACCESS_REVOKED
  -> ERROR_RECOVERABLE
SAVING -> READY_EDITABLE | OFFLINE_DIRTY | ERROR_RECOVERABLE
```

“Saved” must mean server-acknowledged durable persistence, not merely local state mutation.

### 20.3 Autosave contract

- Debounce ordinary text changes but cap the maximum interval so continuous typing still checkpoints.
- High-frequency spatial/ink operations are batched.
- Navigating away with server-unacknowledged operations triggers local durable recovery, not a blocking browser prompt as the only protection.
- UI states: `Saved`, `Saving…`, `Offline — changes on this device`, `Sync problem`, `Read only`, `Access removed`.
- A failed save keeps the local edit buffer and offers retry/export/recovery rather than clearing state.

### 20.4 Command architecture

All editor actions are commands with:

- stable command ID;
- label/icon/shortcut;
- capability predicate;
- permission predicate;
- current-selection predicate;
- execute function;
- undo transaction behavior;
- analytics event category without content payload.

The same command can appear in a toolbar, context menu, slash menu, or command palette without duplicating business logic.

### 20.5 Shared insertion model

Insert menu categories:

- Text/structure
- Media
- Files/embeds
- Data/table
- Academic/research
- Drawing/spatial where editor supports it

The editor must ask the registry whether an insertion is valid. A whiteboard can insert a rich text object; a code document does not suddenly accept an arbitrary table block unless its schema says so.

### 20.6 Version and schema migrations

Every native document payload has `schemaVersion`.

- Reader supports current + documented backward window.
- Migration is deterministic and tested with fixtures.
- Do not mutate canonical stored content in the browser merely because it was opened by a newer client; persistent migration happens through controlled server logic/job when needed.
- Failed migration opens safe read-only recovery where possible.

### 20.7 Plugin boundary

An editor plugin may contribute commands, blocks/elements, inspectors, exporters, and validators, but it may not bypass authorization, object storage rules, or the canonical persistence transaction path.

### 20.8 Mobile editor shell

At phone widths:

- top bar: back/context, title, save/sync state, more menu;
- content gets maximum vertical space;
- formatting/insert controls use a bottom bar or keyboard-adjacent tray;
- side inspectors become full-screen sheets;
- comments/history/search open as dedicated secondary surfaces;
- split views are disabled unless the device width genuinely supports them.

### 20.9 Tablet editor shell

- Optional left outline/navigation pane.
- Pen-aware contextual tools for notes/whiteboard/PDF annotation.
- Hardware keyboard shortcuts fully supported.
- Inspector can float or dock based on width/orientation.

### 20.10 Desktop editor shell

- Resizable navigation/outline and inspector panes.
- Global + editor command palette.
- Multi-pane viewing only when it preserves focus and performance.
- Stable title/sync/share controls in header.

### 20.11 Data-loss prevention tests

Mandatory automated scenarios for every writable editor:

1. type/edit → refresh immediately;
2. type/edit → network disconnect → continue editing → reconnect;
3. edit on two clients → reconnect/merge;
4. permission removed during unsaved edit;
5. server returns transient 5xx during autosave;
6. app version changes with locally pending operations;
7. document moved/renamed while open;
8. document trashed while open;
9. browser tab suspended/resumed;
10. storage quota exceeded during attachment insertion.