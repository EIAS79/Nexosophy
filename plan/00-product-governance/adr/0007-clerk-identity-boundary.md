# ADR 0007 — Clerk Authentication Boundary

**Status:** Accepted

## Decision
Use **Clerk** for external identity/authentication/session capabilities.

Nexosophy owns the internal `User`, profile, workspace membership, roles and permissions.

Mapping:
`Clerk user ID → ExternalIdentity → internal Nexosophy User ID`.

## Invariants
- business tables reference internal user IDs;
- mutable email is never the durable identity key;
- normal authorization never trusts client-provided role claims;
- signed Clerk webhooks synchronize lifecycle state idempotently;
- a valid Clerk session cannot bypass an internally suspended user.

## Migration
Because provider IDs are isolated in ExternalIdentity, a future auth-provider migration does not require rewriting all business foreign keys.

## References

- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
