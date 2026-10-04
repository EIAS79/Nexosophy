# ADR 0001 — Modular Monorepo and Deployable Boundaries

**Status:** Accepted

## Context
Nexosophy spans web UI, REST API, workers, realtime collaboration and many shared contracts. Premature domain microservices would increase operational complexity before traffic patterns justify it.

## Decision
Use a **pnpm workspace + Turborepo modular monorepo**.

Deployables:
- `apps/web` — Next.js public/authenticated UI;
- `apps/api` — stateless Fastify API;
- `apps/worker` — durable background job consumers;
- `apps/realtime` — websocket/CRDT collaboration service.

Shared packages own contracts, DB, configuration, observability, auth, billing, storage and UI.

## Consequences
Positive: one lockfile, shared types, atomic refactors, independent deployables.
Negative: package boundaries must be enforced to avoid a tangled monolith.

## Scale/failure
API, worker and realtime fleets scale independently. No durable state lives only in a process.

## Review triggers
Split a domain into a separate service only when measured scaling, isolation, runtime or ownership needs justify it.

## References

- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
