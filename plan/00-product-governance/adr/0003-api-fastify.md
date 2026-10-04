# ADR 0003 — Core API Runtime

**Status:** Accepted

## Decision
Use **Node.js 24 LTS** initially and **Fastify 5.x** for `apps/api`.

Validation uses runtime schemas shared/generated through the contracts package. OpenAPI is generated from the server contract.

## Why
Fastify provides low-overhead HTTP handling, schema-oriented validation/serialization, plugins and strong production maturity without requiring a heavyweight service framework.

## Rules
- stateless request handlers;
- thin routes, domain services own logic;
- explicit request-size limits;
- cursor pagination;
- stable errors;
- idempotency middleware;
- request IDs/tracing;
- bounded external timeouts.

## Review triggers
Upgrade Node when the next release reaches stable LTS and compatibility/performance tests pass.

## References

- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
