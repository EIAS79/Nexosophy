# Accessibility and Internationalization

> **Plan path:** `plan/01-foundation/04-accessibility-i18n.md`

## Purpose

Make core Nexosophy workflows accessible and structurally ready for multiple languages/locales.

## User / product outcomes

- Keyboard and assistive-technology users can complete all critical flows.
- Dates, timezones, numbers and text direction are locale-safe.

## Required capabilities

- WCAG 2.2 AA target.
- Semantic landmarks and labels.
- Visible focus and logical focus order.
- Reduced motion and high contrast considerations.
- Screen-reader announcements for async operations.
- RTL-ready layout primitives.
- Locale-aware date/time/number formatting.
- Pluralization and translation keys; no user-facing hardcoded strings in core UI.

## Routes / surfaces

- `/settings/language`
- `/settings/accessibility`

## Core data model

- `LocalePreference`
- `AccessibilityPreference`

## Service and API contract

- Server returns canonical timestamps/values; presentation is localized at the boundary.

## Scale, concurrency and resilience

- Translation bundles are code-split/cached.
- Accessibility does not add network round trips to interactions.

## Security / correctness risks

- Canvas/whiteboard accessibility requires alternative document structure and keyboard controls.
- Timezone mistakes can break reminders/calendar semantics.

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

- [ ] Automated a11y scans plus manual keyboard/screen-reader critical-path review pass.
- [ ] Timezone/locale test suite covers DST transitions and RTL.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.