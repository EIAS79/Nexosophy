# ADR 0004 — PostgreSQL Persistence and Data Access

**Status:** Accepted

## Decision
Use **PostgreSQL** as the authoritative transactional store, with **Neon preferred initially**, accessed through **Drizzle ORM/query tooling with explicit SQL/index control**.

Use pooled database connections and a global connection budget.

## Rules
- tenant-owned tables include workspace scope;
- DB constraints enforce invariants when possible;
- transactions wrap multi-row invariants;
- cursor pagination for large lists;
- JSONB is not a substitute for relational schema;
- indexes are reviewed using EXPLAIN on hot queries;
- destructive migrations use expand/migrate/contract sequencing.

## Scale
Horizontal API scaling must not create unbounded DB connections. Pool wait/saturation are monitored.

## Alternatives
Prisma, raw SQL/Kysely.

## Review triggers
Only consider sharding/partitioning/read replicas after telemetry identifies the actual bottleneck.

## References

- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
