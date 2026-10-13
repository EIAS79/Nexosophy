# Phase 11 — Tasks, Reminders, Calendar & Notifications

> **Canonical execution file:** `plan/13-phases/phase-11-productivity.md`

## Objective

Deliver Nexosophy’s durable productivity layer: tasks/projects/focus, timezone-safe reminders, recurring calendar events, and a deduplicated notification/activity system.

## Owning specifications

- [01-tasks-projects-focus.md](../06-productivity/01-tasks-projects-focus.md)
- [02-reminders.md](../06-productivity/02-reminders.md)
- [03-calendar.md](../06-productivity/03-calendar.md)
- [04-notifications-inbox.md](../06-productivity/04-notifications-inbox.md)

## Prerequisites

- [x] Phase 10 implementation foundation available on the shared tranche branch; formal Phase 10 gate intentionally deferred.
- [x] Durable jobs/outbox worker foundation available.
- [x] Universal content-node and tag/link primitives available.

## Required deliverables

- [x] Tasks/projects with status, priority, dates, assignee, subtasks, dependencies, tags and universal content links.
- [x] Recurring tasks with occurrence completion and next-occurrence generation.
- [x] Focus sessions with pause/resume/completion notes and 30-day completion/focus analytics.
- [x] One-time and recurring reminders linked to tasks/events/content.
- [x] Restart-safe occurrence scheduler with unique occurrence deduplication, outage catch-up and snooze.
- [x] Calendar day/week/month/agenda views.
- [x] RRULE recurrence with lazy range expansion and occurrence/future/series edit/delete semantics.
- [x] All-day/timed/timezone-aware calendar events.
- [x] Notification/activity inbox with unread/read-all/deep links.
- [x] Web/email/push channel abstraction with bounded retries.
- [x] Quiet hours, digest preferences and source mute/follow controls.
- [x] Transactional outbox notification fan-out with deduplication.

## Reliability and security

- Server-side workspace authorization is enforced on all productivity APIs.
- Reminder occurrences are unique by reminder + scheduled occurrence timestamp.
- Notification dedupe keys include the durable outbox/occurrence identity rather than mutable titles.
- Scheduler catch-up is bounded per pass and repeat-safe after crashes.
- Recurrence arithmetic is performed in the event/reminder IANA timezone and converted back to UTC.
- Security-category notifications bypass digest/quiet delays.
- Optional outbound providers are isolated behind worker-only HTTP endpoints; absent providers are explicitly marked suppressed rather than silently retried forever.
- User content is not embedded into analytics counters.

## Required test matrix

- [ ] DST spring-forward and fall-back recurrence cases.
- [ ] Duplicate scheduler invocation cannot duplicate visible reminders.
- [ ] Worker outage catch-up preserves each occurrence once.
- [ ] Calendar occurrence/future/series edit and delete scopes.
- [ ] Notification fan-out retry/dedupe and provider outage behavior.
- [ ] Reminder-spike/backpressure test.
- [ ] Mobile/tablet/desktop and keyboard acceptance paths.

## Exit gate

- [ ] Recurring tasks/reminders/events remain correct across DST and restart tests.
- [ ] Notification delivery passes duplicate/outage/provider recovery tests.
- [ ] Primary productivity UI passes responsive/accessibility acceptance.
- [x] No parallel scheduler or ad-hoc feature email path exists; durable worker/outbox remains authoritative.

## Completion record

- Commit/PR: implementation completed on `phases-05-07-storage-editor-history`; merge intentionally deferred.
- Migration(s): `0010_productivity.sql`.
- Staging deployment: intentionally deferred; Vercel previews remain suppressed for the shared implementation branch.
- Test report: CI/typecheck/lint/build/integration suites intentionally pending for the combined validation tranche.
- Scheduler evidence: unique occurrence constraints, row locking, bounded catch-up loops, durable delivery retries and explicit provider suppression are implemented; measured staging evidence pending.
- Known deferred items: automated DST/load/provider tests and formal Phase 10/11 exit gates only.
- Approval/date: implementation deliverables completed 2026-10-08; validation approval pending.
