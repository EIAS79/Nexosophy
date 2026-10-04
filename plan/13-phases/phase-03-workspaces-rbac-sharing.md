# Phase 03 — Workspaces, Membership, RBAC & Sharing

> **Canonical execution file:** `plan/13-phases/phase-03-workspaces-rbac-sharing.md`

## Objective

Establish tenant isolation and authorization before any meaningful user content exists.

## Owning specifications

- [02-workspaces-rbac-sharing.md](../02-identity-billing/02-workspaces-rbac-sharing.md)
- [00-postgres-schema.md](../03-data-content/00-postgres-schema.md)
- [00-api-contract.md](../04-api-scale/00-api-contract.md)
- [02-rate-limit-idempotency.md](../04-api-scale/02-rate-limit-idempotency.md)

## Prerequisites

- [ ] Phase 02 exit gate passed.
- [ ] Internal User IDs stable.
- [ ] Authorization policy vocabulary accepted.

## Required deliverables

- [ ] Personal workspace creation.
- [ ] Team/research/lab/class workspace CRUD.
- [ ] Memberships, invitations, ownership transfer.
- [ ] Owner/admin/member/viewer role matrix plus extensible domain permissions.
- [ ] Server-side authorization service/middleware.
- [ ] ResourceGrant and share-link primitives.
- [ ] Permission inheritance rules for nested content.
- [ ] Audit events for membership/permission changes.
- [ ] Permission-version invalidation for safe short-lived caching.
- [ ] Admin/member settings UI responsive on phone/tablet/desktop.

## Scale / resilience rules

- No deployable may assume it is the only instance.
- Database connection budgets are explicit and bounded.
- Expensive/long-running work is queued or streamed through the appropriate service boundary.
- Retries must not duplicate durable side effects.
- New endpoints expose latency/error/saturation telemetry before the phase closes.

## Required test matrix

- [ ] Full role/permission matrix integration tests.
- [ ] Cross-tenant resource-ID probing/IDOR test suite.
- [ ] Invitation replay/expiry/revocation.
- [ ] Ownership transfer invariants.
- [ ] Share link expiry/revocation/password policy.
- [ ] Permission cache revocation latency test.
- [ ] Concurrent membership mutations preserve uniqueness/invariants.

## Exit gate

- [ ] Every subsequent workspace-owned repository/API requires workspace scope.
- [ ] Authorization cannot be bypassed by frontend state.
- [ ] Tenant isolation test suite is mandatory CI.
- [ ] Permission changes are auditable and revoke within defined target.

## Phase completion record

- Commit/PR:
- Migration version(s):
- Staging deployment:
- Test report:
- Load/performance evidence where applicable:
- Known deferred items (must not violate exit gate):
- Approval/date: