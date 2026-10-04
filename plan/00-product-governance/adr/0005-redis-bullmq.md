# ADR 0005 — Redis, Rate Limiting and Durable Jobs

**Status:** Accepted

## Decision
Use a managed Redis/Valkey-compatible service for shared ephemeral coordination and **BullMQ** for durable background job orchestration.

## Redis responsibilities
- distributed rate limits;
- short-lived safe caches;
- permission/entitlement cache versions;
- queue coordination;
- realtime pub/sub/backplane where appropriate.

## Worker responsibilities
Queues are separated by workload class such as indexing, media, conversion, export/import, notifications, cleanup and AI/compute.

## Rules
- Redis is not business source of truth;
- handlers are idempotent because delivery is at-least-once;
- DLQ/replay tooling required;
- payloads reference DB/object storage rather than embedding large blobs;
- concurrency tuned to downstream capacity.

## Review triggers
If workload durability/throughput requires a different broker, replace behind the job abstraction with migration plan.

## References

- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
