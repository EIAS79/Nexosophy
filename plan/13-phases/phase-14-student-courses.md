# Phase 14 — Student & Course System

> **Canonical execution file:** `plan/13-phases/phase-14-student-courses.md`

## Objective

Compose shared content/productivity primitives into a complete student academic workspace.

## Owning specifications

- [01-student-course-workspace.md](../07-academic/01-student-course-workspace.md)
- [02-assignments-exams-study.md](../07-academic/02-assignments-exams-study.md)
- [03-flashcards-spaced-repetition.md](../07-academic/03-flashcards-spaced-repetition.md)

## Prerequisites

- [ ] Phase 13 passed.
- [ ] Tasks/calendar/notes/templates stable.

## Required deliverables

- [ ] Academic terms/semesters.
- [ ] Courses/modules and metadata.
- [ ] Course-linked notes/files/tasks/events.
- [ ] Assignments with due dates/status/weight metadata.
- [ ] Exam schedule and revision plan.
- [ ] Study sessions/focus links.
- [ ] Flashcard decks linked to source content.
- [ ] Spaced-repetition scheduler.
- [ ] Course dashboard/progress views.
- [ ] Academic templates.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Semester rollover/archive.
- [ ] Timezone due dates.
- [ ] Spaced-repetition scheduling tests.
- [ ] Mobile quick capture during class.
- [ ] Cross-course permissions in shared class workspace.

## Exit gate

- [ ] Student can manage a complete term without duplicating data between modules.
- [ ] Academic objects link to canonical tasks/calendar/files rather than shadow copies.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: