# Phase 23 — Production Hardening & Certification

> **Canonical execution file:** `plan/13-phases/phase-23-production-hardening.md`

## Objective

Prove security, accessibility, recovery, scale and operations before public launch.

## Owning specifications

- [01-security-privacy-compliance.md](../12-quality-security/01-security-privacy-compliance.md)
- [02-testing-certification.md](../12-quality-security/02-testing-certification.md)
- [03-backup-disaster-recovery.md](../12-quality-security/03-backup-disaster-recovery.md)
- [04-incident-response-operations.md](../12-quality-security/04-incident-response-operations.md)
- [05-performance-slo-capacity.md](../04-api-scale/05-performance-slo-capacity.md)
- [06-abuse-ddos-waf.md](../04-api-scale/06-abuse-ddos-waf.md)

## Prerequisites

- [ ] Phase 22 passed.
- [ ] All launch-critical product phases function in staging.

## Required deliverables

- [ ] Threat-model review and closure.
- [ ] Dependency/SAST/secret/container scans.
- [ ] Penetration test and remediation.
- [ ] Manual accessibility audit.
- [ ] Steady/burst/spike/soak/recovery load tests.
- [ ] Autoscaling and bounded DB pool validation.
- [ ] Backup restore and point-in-time recovery drill.
- [ ] Object-storage/search/queue recovery drills.
- [ ] Provider failure drills.
- [ ] SLO dashboards/alerts.
- [ ] Incident/on-call/escalation/runbooks.
- [ ] Legal/privacy/cookie/terms review.
- [ ] Rollback/canary rehearsal.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] At least 1,000 sustained ordinary API req/s and 3,000 req/s short bursts on production-like infrastructure, or higher launch forecast target.
- [ ] No correctness/data-integrity failure under load.
- [ ] Cross-tenant security regression.
- [ ] Restore from backup to usable environment.
- [ ] Chaos/provider outage recovery.

## Exit gate

- [ ] No open P0/P1 launch defects.
- [ ] Capacity has explicit headroom.
- [ ] Rollback and incident response rehearsed.
- [ ] Security/privacy/accessibility signoff recorded.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: