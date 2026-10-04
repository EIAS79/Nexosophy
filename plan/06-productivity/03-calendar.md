> **Canonical Nexosophy migration:** Detailed product behavior preserved from the prior implementation specification. Cross-cutting API, database, scale, auth and billing rules are owned by the canonical specs under `plan/02-identity-billing/`, `plan/03-data-content/`, and `plan/04-api-scale/`.

# Calendar & Scheduling

> Status: implementation specification. This document is normative for this module unless the master plan explicitly overrides it.

**Master plan:** [`../README.md`](../README.md)  
**Delivery phase(s):** Phase 11  
**Related systems:** `reminders`, `tasks`, `courses`, `labs`, `integrations`, `notifications`

## 1. Purpose

Defines day/week/month/agenda views, events, recurrence, timezone behavior, drag/drop, academic/lab deadlines, and external calendar integration boundaries.

### Success condition
The module is complete only when its primary workflows work end-to-end on phone, tablet, desktop, keyboard-only, and supported assistive technology paths; all writes are authorized server-side; data survives refresh/reconnect; error states are recoverable; and the behavior is covered by automated tests.

## 2. Scope and boundaries

- Build the complete user workflow, not only the visible page.
- Include empty, loading, success, degraded, offline where applicable, permission-denied, validation-error, and destructive-action states.
- Do not duplicate another module’s source of truth. Link to the canonical entity instead.
- Keep the module extensible through typed capabilities/events rather than hard-coded role branches.
- Every destructive or security-sensitive action must have explicit authorization, auditability where appropriate, and predictable recovery semantics.

## 3. Primary routes / surfaces

- `/calendar`
- `/calendar/day`
- `/calendar/week`
- `/calendar/month`
- `/calendar/agenda`

Every route must support direct linking, refresh, browser back/forward navigation, authentication return-to behavior, and a valid not-found / no-access state.

## 4. Domain model

Primary entities:

- `Calendar`
- `CalendarEvent`
- `EventSeries`
- `EventAttendee`
- `RecurrenceRule`
- `CalendarSource`
- `EventLink`

### Required entity conventions

- Stable opaque ID; never expose sequential IDs as an authorization boundary.
- Workspace/tenant scope on every workspace-owned row.
- `created_at`, `updated_at`, creator/updater identity where meaningful, and optimistic concurrency/version field for contested writes.
- Soft-delete/retention semantics when the object is recoverable; hard deletion only through the deletion pipeline.
- Audit events for permission changes, destructive actions, sensitive exports, signatures, and security-relevant mutations.
- Search/index projection and activity events are derived from canonical transactional data, not the other way around.

## 5. Complete feature contract

### 5.1 Day/week/month/agenda views

- Implement **Day/week/month/agenda views** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.2 Create/edit event

- Implement **Create/edit event** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.3 All-day/timed events

- Implement **All-day/timed events** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.4 Recurring events

- Implement **Recurring events** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.5 Exceptions

- Implement **Exceptions** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.6 Timezone selector

- Implement **Timezone selector** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.7 Color/calendar sources

- Implement **Color/calendar sources** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.8 Drag/drop resize

- Implement **Drag/drop resize** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.9 Task/deadline overlays

- Implement **Task/deadline overlays** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.10 Course/lab/project linked events

- Implement **Course/lab/project linked events** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.11 Reminders

- Implement **Reminders** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.12 ICS import/export

- Implement **ICS import/export** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.13 External calendar read/write integrations where connected

- Implement **External calendar read/write integrations where connected** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.14 Conflict display

- Implement **Conflict display** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

## 6. Core user flows

- create recurring series → expand occurrences lazily → edit one/future/all
- drag event → optimistic preview → validate → save
- external change → sync → resolve source-of-truth policy

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

- Phone defaults agenda/day; month is compact with detail sheet
- Tablet supports week view
- Desktop week/day shows resizable time grid
- Horizontal gestures never conflict with vertical time scrolling

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

- DST recurrence
- overnight event
- all-day timezone drift
- series edit conflicts
- external duplicate
- invitation cancelled remotely

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

## 20. Calendar-specific architecture

### 20.1 Event model

```text
CalendarEvent
- id / workspaceId / calendarId
- title / description
- start / end
- allDay
- timezone semantics
- location / meetingLink
- recurrenceRule? / seriesId?
- recurrenceExceptionKey?
- visibility
- linkedNode/task/course/equipment/etc.
- reminder configuration
- source: native | external provider
- provider revision/sync metadata
```

An occurrence generated from a recurring series is not treated as an unrelated event. Exceptions reference the series occurrence identity.

### 20.2 Time semantics

- Timed event: preserve instant plus source timezone for display/edit semantics.
- All-day event: store date boundaries as dates, not UTC midnight timestamps that drift across zones.
- Floating event, if supported: preserve local wall-clock semantics explicitly.
- External provider events retain provider IDs and revisions.

### 20.3 View contracts

**Agenda**: optimized for phone and screen readers; chronological grouped list with date headings.

**Day**: vertical time grid, overlapping-event layout, all-day strip.

**Week**: seven-day grid on desktop/tablet; narrow mobile may use 1–3 day window rather than crushed seven columns.

**Month**: high-level density; selecting a date opens day detail. Mobile month cells show compact indicators, not unreadable text stacks.

### 20.4 Create/edit flow

Quick create requires title + resolved date/time. Advanced editor adds recurrence, calendar/source, reminders, linked objects, location, description, visibility, attendees where supported.

Dragging or resizing an event is an edit preview. Server validation determines final acceptance, including booking conflicts for equipment calendars.

### 20.5 Recurring series

- Generate occurrences lazily for requested range.
- Stable occurrence key based on series + recurrence identity.
- Edits support one / future / series.
- “Future” split creates a new series while preserving historical occurrences/exceptions.
- Deleting a single occurrence creates a cancellation exception, not mutation of the recurrence rule that shifts unrelated dates.

### 20.6 Linked academic/lab/productivity events

The calendar can project canonical deadlines/bookings rather than duplicate them:

- task due dates;
- assignment/exam dates;
- thesis milestones;
- equipment bookings;
- supervisor meetings;
- reminders where useful.

Projection objects retain links to their canonical source. Editing rules depend on ownership: editing an equipment booking opens/updates the booking system, not a detached calendar copy.

### 20.7 External calendar sync

Per integration define source of truth:

- imported read-only calendar;
- two-way mapped calendar;
- Nexosophy-only calendar.

Use provider sync tokens/revisions, idempotent upserts, tombstones for deletion, and reconciliation for missed webhooks. Never identify events solely by title/time.

### 20.8 Conflict and density behavior

- Layout overlapping events into columns based on interval overlap.
- Very dense days collapse visually with “+N more” while remaining accessible in agenda/list form.
- Booking resources may enforce hard conflict prevention; personal calendar overlaps are usually allowed but visually flagged.

### 20.9 Calendar APIs

```text
GET    /calendars
POST   /calendars
GET    /calendar-events?start=&end=&calendarIds=
POST   /calendar-events
PATCH  /calendar-events/:id?scope=occurrence|future|series
DELETE /calendar-events/:id?scope=occurrence|future|series
POST   /calendar/import-ics
GET    /calendar/export.ics
```

### 20.10 Mobile interaction

- Default landing: agenda or day, configurable.
- Swipe changes day/week only when it does not hijack horizontal scroll in embedded content.
- Long-press drag may be offered, but edit is always possible through explicit controls.
- Date/time pickers use platform-friendly inputs with an advanced text/keyboard path on desktop.