> **Canonical Nexosophy migration:** Public marketing behavior preserved from the prior detailed specification. Authentication and billing mechanics are owned by canonical provider specs.

# Public Homepage & Marketing Site

> Status: implementation specification. This document is normative for this module unless the master plan explicitly overrides it.

**Master plan:** [`../README.md`](../README.md)  
**Delivery phase(s):** Phase 1, Phase 23  
**Related systems:** `auth`, `pricing`, `analytics`, `CMS/content`

## 1. Purpose

Defines the public-facing homepage and acquisition pages, including content hierarchy, calls to action, proof, SEO, accessibility, and responsive behavior.

### Success condition
The module is complete only when its primary workflows work end-to-end on phone, tablet, desktop, keyboard-only, and supported assistive technology paths; all writes are authorized server-side; data survives refresh/reconnect; error states are recoverable; and the behavior is covered by automated tests.

## 2. Scope and boundaries

- Build the complete user workflow, not only the visible page.
- Include empty, loading, success, degraded, offline where applicable, permission-denied, validation-error, and destructive-action states.
- Do not duplicate another module’s source of truth. Link to the canonical entity instead.
- Keep the module extensible through typed capabilities/events rather than hard-coded role branches.
- Every destructive or security-sensitive action must have explicit authorization, auditability where appropriate, and predictable recovery semantics.

## 3. Primary routes / surfaces

- `/`
- `/features`
- `/students`
- `/researchers`
- `/professors`
- `/labs`
- `/reporters`
- `/pricing`
- `/security`
- `/about`
- `/contact`

Every route must support direct linking, refresh, browser back/forward navigation, authentication return-to behavior, and a valid not-found / no-access state.

## 4. Domain model

Primary entities:

- `MarketingPage`
- `MarketingSection`
- `CTAEvent`
- `Lead`
- `SEORecord`
- `ExperimentVariant`

### Required entity conventions

- Stable opaque ID; never expose sequential IDs as an authorization boundary.
- Workspace/tenant scope on every workspace-owned row.
- `created_at`, `updated_at`, creator/updater identity where meaningful, and optimistic concurrency/version field for contested writes.
- Soft-delete/retention semantics when the object is recoverable; hard deletion only through the deletion pipeline.
- Audit events for permission changes, destructive actions, sensitive exports, signatures, and security-relevant mutations.
- Search/index projection and activity events are derived from canonical transactional data, not the other way around.

## 5. Complete feature contract

### 5.1 Hero with clear product promise

- Implement **Hero with clear product promise** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.2 Role-specific use cases

- Implement **Role-specific use cases** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.3 Interactive feature previews

- Implement **Interactive feature previews** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.4 Editor/file-system showcase

- Implement **Editor/file-system showcase** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.5 Templates showcase

- Implement **Templates showcase** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.6 Security/privacy section

- Implement **Security/privacy section** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.7 Pricing teaser

- Implement **Pricing teaser** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.8 FAQ

- Implement **FAQ** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.9 Footer navigation

- Implement **Footer navigation** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.10 Sign in / start free CTAs

- Implement **Sign in / start free CTAs** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.11 SEO metadata and structured data

- Implement **SEO metadata and structured data** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

### 5.12 Cookie/privacy controls where required

- Implement **Cookie/privacy controls where required** as a complete stateful capability, including creation/configuration, viewing, editing where applicable, persistence, permissions, validation, error recovery, and history/audit integration.
- Expose the capability through both the obvious page UI and the relevant command/context menus when appropriate.
- Avoid silent failure. Surface progress for long-running operations and provide a retry or recovery path when the operation can fail transiently.

## 6. Core user flows

- visitor → homepage → role use case → feature → pricing → sign up
- existing user → homepage → sign in → return-to route
- mobile visitor → concise hero → swipeable proof/features → CTA

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

- No horizontal overflow at 320px
- Hero and feature media reflow rather than shrink unreadably
- Touch targets >=44px
- Decorative media lazy-loads; core copy remains server-rendered
- Motion respects prefers-reduced-motion

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

- JS disabled
- slow network
- localized copy expands 30-50%
- missing marketing CMS content
- A/B experiment assignment failure

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

## 20. Homepage page-level specification

### 20.1 Header

Desktop:

- logo/wordmark;
- Product / Use cases / Templates / Security / Pricing navigation;
- Sign in secondary action;
- Start free primary CTA.

Mobile:

- logo;
- Start free CTA if space permits;
- accessible menu button opening a full-height navigation sheet;
- no multi-level hover-only menus.

Header can become sticky after initial scroll but must not consume excessive phone viewport height.

### 20.2 Hero

The first viewport must explain three things without jargon:

1. what Nexosophy is;
2. who it is for;
3. why it is different from a generic note app.

Hero content:

- strong one-sentence value proposition;
- one supporting paragraph;
- Start free CTA;
- optional secondary “Explore features” CTA;
- product visual that demonstrates recursive workspace + rich note/editor, not decorative stock photography;
- concise trust statement about ownership/export/privacy without unverifiable claims.

### 20.3 Core product story

Recommended homepage section order:

1. Unified files and folders.
2. Notes and infinite pages.
3. Study planning, reminders, calendar.
4. Research/lab workflows.
5. Reports, sources, analysis.
6. Collaboration/search/history.
7. Role-specific workflows.
8. Templates.
9. Security/exportability.
10. Pricing teaser.
11. FAQ.
12. Final CTA.

Each section links to a deeper page rather than placing every feature on the homepage.

### 20.4 Role pages

Role cards route to dedicated pages for students, postgraduate researchers, professors, labs, reporters, and analysts. Copy changes by workflow; product capability remains coherent rather than pretending there are separate products.

### 20.5 Product visuals

- Use real UI captures or production-equivalent interactive demos once available.
- Every autoplay animation has pause/reduced-motion behavior.
- Lazy-load below-fold heavy media.
- Mobile uses cropped/recomposed visuals; never scale a 1440px dashboard screenshot down until text is microscopic.

### 20.6 SEO/content contract

Each public page requires unique title, description, canonical URL, Open Graph metadata, crawlable headings/body copy, sitemap inclusion where appropriate, and structured data only when it accurately describes the page.

### 20.7 Public performance budget

The marketing site should be substantially lighter than the authenticated application. Do not ship editor engines, collaboration libraries, or spreadsheet bundles on the homepage. Critical copy and navigation must server-render.