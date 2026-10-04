# Phase 24 — Staged Production Launch

> **Canonical execution file:** `plan/13-phases/phase-24-staged-launch.md`

## Objective

Release Nexosophy progressively with measurable rollback and support gates rather than a one-shot public launch.

## Owning specifications

- [01-public-homepage.md](../11-public-website/01-public-homepage.md)
- [03-pricing.md](../11-public-website/03-pricing.md)
- [04-incident-response-operations.md](../12-quality-security/04-incident-response-operations.md)

## Prerequisites

- [ ] Phase 23 certification passed.
- [ ] Production environment, support and monitoring operational.

## Required deliverables

- [ ] Internal alpha.
- [ ] Invite-only technical alpha.
- [ ] Higher-education/research beta.
- [ ] Controlled public beta.
- [ ] General availability.
- [ ] Feature-flag cohorts and kill switches.
- [ ] Feedback/bug triage process.
- [ ] Support/help/status communication.
- [ ] Release analytics and error-budget review.
- [ ] Per-stage rollback/migration decision checklist.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Synthetic critical journeys continuously.
- [ ] Canary health comparison.
- [ ] Signup/billing/auth smoke tests.
- [ ] Rollback drill before wider cohort.
- [ ] Support escalation test.

## Exit gate

- [ ] Each cohort advances only if error/security/performance/support thresholds pass.
- [ ] GA decision is recorded with capacity and operational evidence.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: