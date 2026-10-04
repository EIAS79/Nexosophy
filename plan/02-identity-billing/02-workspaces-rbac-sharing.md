# Workspaces, RBAC and Sharing

> **Plan path:** `plan/02-identity-billing/02-workspaces-rbac-sharing.md`

## Purpose

Provide tenant isolation, roles and resource-level sharing for personal, team, lab, class and institution contexts.

## User / product outcomes

- A user sees only authorized workspaces/resources.
- Teams can collaborate without sharing credentials or duplicating files.

## Required capabilities

- Personal workspace on signup.
- Team/research/lab/class workspaces.
- Roles: owner/admin/member/viewer plus domain roles when needed.
- Resource sharing to workspace members or invited guests.
- Share links with expiry/password/download policy where enabled.
- Ownership transfer.
- Member invitations.
- Audit log for permission changes.

## Routes / surfaces

- `/workspace/:id/settings/members`
- `/workspace/:id/settings/permissions`
- `/share/:token`

## Core data model

- `Workspace`
- `WorkspaceMember`
- `Role`
- `Permission`
- `ResourceGrant`
- `Invite`
- `ShareLink`

## Service and API contract

- Authorization service evaluates workspace membership + resource grants + policy.
- Every resource query includes workspace/tenant scope at repository layer, not only UI.
- Share tokens are high-entropy, revocable and hashed where feasible.

## Scale, concurrency and resilience

- Permission decisions may use short-lived versioned cache; revocation invalidates via permission-version bump/pub-sub.
- Bulk member/resource checks use set-based queries, not one query per item.

## Security / correctness risks

- IDOR/tenant leakage is a P0 risk; authorization is server-side on every request.
- Nested folder sharing requires explicit inheritance rules.

## Responsive and accessibility requirements

- All user-facing surfaces must define desktop, tablet and phone behavior rather than rely on accidental CSS wrapping.
- Critical actions must be keyboard reachable, have visible focus, semantic labels and non-color-only states.
- Loading, empty, error, permission-denied and offline/degraded states are part of the feature contract.

## Observability requirements

- Structured events for critical state transitions and failures.
- Latency/error metrics for service endpoints and external dependencies.
- Correlation/request IDs on support-visible failures; never log secrets or raw sensitive content.

## Test strategy

- Unit tests for domain rules and state transitions.
- Integration tests for persistence/provider boundaries.
- Authorization and tenant-isolation tests for every resource API.
- End-to-end tests for critical user journeys on desktop and mobile.
- Load/concurrency tests for high-frequency or contention-sensitive operations.

## Definition of Done

- [ ] Cross-tenant access test suite passes.
- [ ] Role/permission matrix documented and tested.
- [ ] Revocation takes effect within defined cache TTL/invalidation target.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.

---

# Detailed Workspace Membership & RBAC Contract

# Workspaces, Memberships, Roles & RBAC

> Status: implementation specification. This document is normative for this module unless the master plan explicitly overrides it.

**Master plan:** [`../README.md`](../README.md)  
**Delivery phase(s):** Phase 3, Phase 16, Phase 17, Phase 18  
**Related systems:** `auth`, `sharing`, `audit`, `notifications`, `billing`

## 1. Purpose

Defines tenancy, membership, roles, custom permissions, invitations, ownership, groups, and authorization evaluation.

### Success condition
The module is complete only when its primary workflows work end-to-end on phone, tablet, desktop, keyboard-only, and supported assistive technology paths; all writes are authorized server-side; data survives refresh/reconnect; error states are recoverable; and the behavior is covered by automated tests.

## 2. Scope and boundaries

- Build the complete user workflow, not only the visible page.
- Include empty, loading, success, degraded, offline where applicable, permission-denied, validation-error, and destructive-action states.
- Do not duplicate another module’s source of truth. Link to the canonical entity instead.
- Keep the module extensible through typed capabilities/events rather than hard-coded role branches.
- Every destructive or security-sensitive action must have explicit authorization, auditability where appropriate, and predictable recovery semantics.

## 3. Primary routes / surfaces

- `/workspace/:workspaceId`
- `/workspace/:workspaceId/settings/members`
- `/workspace/:workspaceId/settings/roles`

Every route must support direct linking, refresh, browser back/forward navigation, authentication return-to behavior, and a valid not-found / no-access state.

## 4. Domain model

Primary entities:

- `Workspace`
- `Membership`
- `Role`
- `Permission`
- `RolePermission`
- `Group`
- `GroupMembership`
- `Invitation`
- `OwnershipTransfer`

### Required entity conventions

- Stable opaque ID; never expose sequential IDs as an authorization boundary.
- Workspace/tenant scope on every workspace-owned row.
- `created_at`, `updated_at`, creator/updater identity where meaningful, and optimistic concurrency/version field for contested writes.
- Soft-delete/retention semantics when the object is recoverable; hard deletion only through the deletion pipeline.
- Audit events for permission changes, destructive actions, sensitive exports, signatures, and security-relevant mutations.
- Search/index projection and activity events are derived from canonical transactional data, not the other way around.

## 5. Complete feature contract

### 5.1 Personal/team/institution/lab workspace types

- Implement **Personal/team/institution/lab workspace types** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.2 Owner/admin/member/guest baselines

- Implement **Owner/admin/member/guest baselines** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.3 Custom roles for advanced plans

- Implement **Custom roles for advanced plans** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.4 Invitation lifecycle

- Implement **Invitation lifecycle** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.5 Groups

- Implement **Groups** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.6 Role assignment

- Implement **Role assignment** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.7 Workspace switcher

- Implement **Workspace switcher** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.8 Ownership transfer

- Implement **Ownership transfer** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.9 Member suspension/removal

- Implement **Member suspension/removal** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.10 Policy inheritance

- Implement **Policy inheritance** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.11 Permission cache invalidation

- Implement **Permission cache invalidation** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

## 6. Core user flows

- invite → accept → membership activation
- admin changes role → authorization cache bust → new effective permissions
- owner transfer → dual confirmation → audit
- member removed → sessions retain account but lose workspace immediately

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

- Member tables virtualize on large workspaces
- Mobile uses list cards with action sheets
- Permission matrix becomes grouped sections, not a horizontally scrolling spreadsheet

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

- last owner removal
- expired invite
- invite reused
- nested groups if unsupported
- role changed during active edit
- external guest blocked by org policy

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

---

# Detailed Sharing, Guests & Public Links Contract

# Sharing, Guests & Public Links

> Status: implementation specification. This document is normative for this module unless the master plan explicitly overrides it.

**Master plan:** [`../README.md`](../README.md)  
**Delivery phase(s):** Phase 3, Phase 8  
**Related systems:** `workspaces`, `files`, `notifications`, `audit`, `security`

## 1. Purpose

Defines item-level sharing, inherited permissions, public links, guest access, expiration, download controls, and revocation.

### Success condition
The module is complete only when its primary workflows work end-to-end on phone, tablet, desktop, keyboard-only, and supported assistive technology paths; all writes are authorized server-side; data survives refresh/reconnect; error states are recoverable; and the behavior is covered by automated tests.

## 2. Scope and boundaries

- Build the complete user workflow, not only the visible page.
- Include empty, loading, success, degraded, offline where applicable, permission-denied, validation-error, and destructive-action states.
- Do not duplicate another module’s source of truth. Link to the canonical entity instead.
- Keep the module extensible through typed capabilities/events rather than hard-coded role branches.
- Every destructive or security-sensitive action must have explicit authorization, auditability where appropriate, and predictable recovery semantics.

## 3. Primary routes / surfaces

- `/share/:token`
- `item share dialogs`

Every route must support direct linking, refresh, browser back/forward navigation, authentication return-to behavior, and a valid not-found / no-access state.

## 4. Domain model

Primary entities:

- `ShareGrant`
- `PublicLink`
- `GuestPrincipal`
- `ShareInvitation`
- `AccessPolicy`

### Required entity conventions

- Stable opaque ID; never expose sequential IDs as an authorization boundary.
- Workspace/tenant scope on every workspace-owned row.
- `created_at`, `updated_at`, creator/updater identity where meaningful, and optimistic concurrency/version field for contested writes.
- Soft-delete/retention semantics when the object is recoverable; hard deletion only through the deletion pipeline.
- Audit events for permission changes, destructive actions, sensitive exports, signatures, and security-relevant mutations.
- Search/index projection and activity events are derived from canonical transactional data, not the other way around.

## 5. Complete feature contract

### 5.1 Direct user sharing

- Implement **Direct user sharing** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.2 Workspace/group sharing

- Implement **Workspace/group sharing** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.3 View/comment/edit permissions

- Implement **View/comment/edit permissions** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.4 Public links

- Implement **Public links** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.5 Password-protected links where enabled

- Implement **Password-protected links where enabled** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.6 Expiry date

- Implement **Expiry date** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.7 Disable download/export

- Implement **Disable download/export** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.8 Inherited access display

- Implement **Inherited access display** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.9 Link revocation

- Implement **Link revocation** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.10 Share audit log

- Implement **Share audit log** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

## 6. Core user flows

- owner → share → recipient notified → recipient opens item
- public visitor → token validation → policy enforcement → view
- permission revoked → live session receives access-loss event

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

- Share dialog uses bottom sheet on mobile
- Access list rows wrap safely
- Public viewer works without desktop app shell

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

- link leaked
- token expired mid-session
- parent permission changes
- guest later becomes member
- shared item moved across workspaces

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