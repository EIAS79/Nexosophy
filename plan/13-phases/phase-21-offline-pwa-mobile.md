# Phase 21 — Offline/PWA & Mobile Hardening

> **Canonical execution file:** `plan/13-phases/phase-21-offline-pwa-mobile.md`

## Objective

Make recent/core workflows resilient to connectivity loss and finish phone/tablet quality before commercial launch.

## Owning specifications

- [02-offline-sync-pwa.md](../10-integrations-offline-ai/02-offline-sync-pwa.md)
- [03-design-system-responsive.md](../01-foundation/03-design-system-responsive.md)
- [04-accessibility-i18n.md](../01-foundation/04-accessibility-i18n.md)

## Prerequisites

- [ ] Phase 20 passed.
- [ ] Conflict/version semantics stable across editable content.

## Required deliverables

- [ ] Installable PWA manifest/service worker.
- [ ] Recent/offline-eligible document cache.
- [ ] Encrypted/local sensitive-data policy.
- [ ] Offline mutation queue.
- [ ] Sync status and conflict UI.
- [ ] Reconnect/retry/backoff.
- [ ] Workspace policy to forbid offline caching.
- [ ] Mobile editor/input regression hardening.
- [ ] Tablet/stylus regression pass.
- [ ] App update/cache migration strategy.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Forced offline editing.
- [ ] Long offline then divergent remote change.
- [ ] Storage quota exhaustion.
- [ ] Service-worker update/rollback.
- [ ] Restricted workspace offline denial.
- [ ] Mobile memory pressure.

## Exit gate

- [ ] Connectivity loss never silently loses acknowledged local work.
- [ ] Users can understand pending/synced/conflicted state.
- [ ] Restricted data respects offline policy.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: