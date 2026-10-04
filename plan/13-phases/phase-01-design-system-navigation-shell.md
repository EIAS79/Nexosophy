# Phase 01 — Design System, Navigation & Application Shell

> **Canonical execution file:** `plan/13-phases/phase-01-design-system-navigation-shell.md`

## Objective

Establish the responsive visual/interaction foundation and routing shell used by every public and authenticated surface.

## Owning specifications

- [03-design-system-responsive.md](../01-foundation/03-design-system-responsive.md)
- [04-accessibility-i18n.md](../01-foundation/04-accessibility-i18n.md)
- [01-public-homepage.md](../11-public-website/01-public-homepage.md)

## Prerequisites

- [ ] Phase 00 exit gate passed.
- [ ] Route groups and authentication boundaries documented even if auth remains stubbed locally.

## Required deliverables

- [ ] Design tokens and theme primitives.
- [ ] Accessible component primitives: buttons, fields, menus, dialogs, drawers, tabs, tooltip, toast, table, tree primitives.
- [ ] Desktop app rail/sidebar/topbar shell.
- [ ] Tablet collapsible shell and touch targets.
- [ ] Mobile bottom navigation/sheets where appropriate.
- [ ] Workspace switcher shell and breadcrumbs.
- [ ] Command palette shell/keyboard shortcut registry.
- [ ] Public marketing layout and homepage skeleton.
- [ ] Authenticated home/dashboard skeleton with placeholder data adapters, not fake business persistence.
- [ ] Loading/error/not-found/no-access route shells.
- [ ] Dark/light/system theme and density foundations.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Keyboard traversal for navigation/dialog/menu primitives.
- [ ] Desktop/tablet/mobile visual regression snapshots.
- [ ] No critical action hover-only.
- [ ] RTL smoke layout and locale-safe shell.
- [ ] Route refresh/back-forward/direct-link checks.
- [ ] Core Web Vitals baseline measured on public shell.

## Exit gate

- [ ] Reusable component system exists before feature-specific copies emerge.
- [ ] Shell works at phone/tablet/desktop breakpoints.
- [ ] Public homepage and authenticated shell can evolve without restructuring routing.
- [ ] Accessibility baseline passes automated and manual keyboard checks.

## Phase completion record

- Commit/PR:
- Migration version(s):
- Staging deployment:
- Test report:
- Load/performance evidence where applicable:
- Known deferred items (must not violate exit gate):
- Approval/date: