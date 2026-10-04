# Phase 07 — History, Trash, Restore & Audit

> **Canonical execution file:** `plan/13-phases/phase-07-history-trash-audit.md`

## Objective

Add recoverability and immutable operational traceability on top of stable content identities.

## Owning specifications

- [03-history-trash-audit.md](../03-data-content/03-history-trash-audit.md)
- [05-data-classification-retention.md](../00-product-governance/05-data-classification-retention.md)

## Prerequisites

- [ ] Phase 06 passed.
- [ ] Document/node identity and editor save semantics stable.

## Required deliverables

- [ ] Document version/checkpoint model.
- [ ] User-visible history timeline and restore-as-new-version.
- [ ] Trash UI, retention countdown, restore and permanent deletion.
- [ ] Recursive deletion/recovery jobs for large trees.
- [ ] Privileged audit-event ledger and workspace audit viewer.
- [ ] Retention sweeper and deletion reconciliation across DB/storage/search/cache.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Delete/restore race tests.
- [ ] Retention job restart/idempotency.
- [ ] Restore does not bypass current permissions.
- [ ] Audit events omit document bodies/secrets.
- [ ] Large subtree deletion/resume test.

## Exit gate

- [ ] Acknowledged user work can be recovered according to policy.
- [ ] Permanent deletion propagates to derived systems.
- [ ] Privileged mutations are traceable by actor/target/request ID.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: