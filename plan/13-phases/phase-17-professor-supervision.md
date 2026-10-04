# Phase 17 — Professor, Teaching & Supervision

> **Canonical execution file:** `plan/13-phases/phase-17-professor-supervision.md`

## Objective

Compose course, document, review and calendar primitives for instructors and supervisors.

## Owning specifications

- [06-professor-teaching-supervision.md](../07-academic/06-professor-teaching-supervision.md)

## Prerequisites

- [ ] Phase 16 passed.
- [ ] Student/course and collaboration primitives stable.

## Required deliverables

- [ ] Teaching workspace and course resource organization.
- [ ] Resource distribution/share policy.
- [ ] Assignment/rubric/light grade metadata boundary.
- [ ] Student/supervisee roster.
- [ ] Review/feedback/comment workflows.
- [ ] Supervision milestones and meeting notes.
- [ ] Office-hour availability/calendar links.
- [ ] Release visibility controls for feedback/grade metadata.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Student cannot see unreleased feedback/grade fields.
- [ ] Supervisor access revocation.
- [ ] Bulk resource distribution.
- [ ] Roster scale/performance.

## Exit gate

- [ ] Instructor and student permission boundaries are explicit and tested.
- [ ] No hidden grade information leaks via search/activity/notifications.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: