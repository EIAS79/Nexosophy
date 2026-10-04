# Phase 11 — Tasks, Reminders, Calendar & Notifications

> **Canonical execution file:** `plan/13-phases/phase-11-productivity.md`

## Objective

Deliver the shared planning/scheduling layer used by students, researchers, labs, reporters and teams.

## Owning specifications

- [01-tasks-projects-focus.md](../06-productivity/01-tasks-projects-focus.md)
- [02-reminders.md](../06-productivity/02-reminders.md)
- [03-calendar.md](../06-productivity/03-calendar.md)
- [04-notifications-inbox.md](../06-productivity/04-notifications-inbox.md)

## Prerequisites

- [ ] Phase 10 passed.
- [ ] Queue/delayed-job scheduling operational.
- [ ] Timezone/DST policy accepted.

## Required deliverables

- [ ] Tasks, projects, status, priority, due dates and links to content.
- [ ] Recurring tasks where supported.
- [ ] One-time/recurring/context-linked reminders.
- [ ] Reliable occurrence scheduler and snooze.
- [ ] Calendar day/week/month/agenda.
- [ ] RRULE recurrence and exceptions.
- [ ] All-day/timed/timezone-safe events.
- [ ] Links from events/tasks to courses/lab/reporting items.
- [ ] Notification inbox/activity center.
- [ ] Email/push/web notification channel abstraction.
- [ ] User quiet hours/preferences.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] DST forward/back transitions.
- [ ] Duplicate scheduler delivery prevention.
- [ ] Worker outage and catch-up.
- [ ] Recurring-series edit-this/edit-following/edit-all.
- [ ] Notification fan-out retry/dedupe.
- [ ] High-volume reminder spike test.

## Exit gate

- [ ] Reminder/event occurrence correctness passes timezone suite.
- [ ] No duplicate user-visible delivery beyond documented tolerance.
- [ ] Scheduler can recover after downtime.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: