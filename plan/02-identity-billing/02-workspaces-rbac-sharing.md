# Workspaces, RBAC and Sharing

> **Plan path:** `plan/02-identity-billing/02-workspaces-rbac-sharing.md`

## Purpose

Provide tenant isolation, roles and resource-level sharing for personal, team, lab, class and institution contexts.

## User / product outcomes

- A user sees only authorized workspaces/resources.
- Teams can collaborate without sharing credentials or duplicating files.

## Required capabilities

- Personal workspace on signup.
- Team/research/lab/class workspaces.
- Roles: owner/admin/member/viewer plus domain roles when needed.
- Resource sharing to workspace members or invited guests.
- Share links with expiry/password/download policy where enabled.
- Ownership transfer.
- Member invitations.
- Audit log for permission changes.

## Routes / surfaces

- `/workspace/:id/settings/members`
- `/workspace/:id/settings/permissions`
- `/share/:token`

## Core data model

- `Workspace`
- `WorkspaceMember`
- `Role`
- `Permission`
- `ResourceGrant`
- `Invite`
- `ShareLink`

## Service and API contract

- Authorization service evaluates workspace membership + resource grants + policy.
- Every resource query includes workspace/tenant scope at repository layer, not only UI.
- Share tokens are high-entropy, revocable and hashed where feasible.

## Scale, concurrency and resilience

- Permission decisions may use short-lived versioned cache; revocation invalidates via permission-version bump/pub-sub.
- Bulk member/resource checks use set-based queries, not one query per item.

## Security / correctness risks

- IDOR/tenant leakage is a P0 risk; authorization is server-side on every request.
- Nested folder sharing requires explicit inheritance rules.

## Responsive and accessibility requirements

- All user-facing surfaces must define desktop, tablet and phone behavior rather than rely on accidental CSS wrapping.
- Critical actions must be keyboard reachable, have visible focus, semantic labels and non-color-only states.
- Loading, empty, error, permission-denied and offline/degraded states are part of the feature contract.

## Observability requirements

- Structured events for critical state transitions and failures.
- Latency/error metrics for service endpoints and external dependencies.
- Correlation/request IDs on support-visible failures; never log secrets or raw sensitive content.

## Test strategy

- Unit tests for domain rules and state transitions.
- Integration tests for persistence/provider boundaries.
- Authorization and tenant-isolation tests for every resource API.
- End-to-end tests for critical user journeys on desktop and mobile.
- Load/concurrency tests for high-frequency or contention-sensitive operations.

## Definition of Done

- [ ] Cross-tenant access test suite passes.
- [ ] Role/permission matrix documented and tested.
- [ ] Revocation takes effect within defined cache TTL/invalidation target.
- [ ] Error/retry/empty/loading/degraded states implemented.
- [ ] Telemetry dashboards/alerts or documented observability coverage exist.
- [ ] Documentation and API contracts are updated.