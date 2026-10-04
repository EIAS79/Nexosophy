# Nexosophy Architecture Decision Framework

> **Status:** canonical architecture-governance specification

## 1. Purpose

Use Architecture Decision Records (ADRs) for durable decisions that would otherwise drift across implementation phases.

An ADR captures:

- context;
- decision;
- alternatives;
- consequences;
- scale/failure implications;
- security/privacy implications;
- migration/rollback implications;
- status.

## 2. ADR location

Canonical ADRs live under:

`plan/00-product-governance/adr/`

File format:

`NNNN-short-kebab-title.md`

Example:

`0001-modular-monorepo.md`

## 3. Status values

- **Proposed**
- **Accepted**
- **Superseded**
- **Deprecated**
- **Rejected**

An accepted ADR may only be replaced by another ADR that names it as superseded.

## 4. When an ADR is required

Create an ADR for:

- new primary database;
- new persistent service;
- new auth/payment/storage/search provider;
- major editor/runtime choice;
- new realtime architecture;
- new queue system;
- arbitrary-code execution;
- new tenancy model;
- new source of truth;
- major encryption/key-management change;
- major deployment topology change;
- new multi-region strategy;
- breaking API/versioning strategy;
- any exception to a non-negotiable product/engineering rule.

## 5. ADR template

Every ADR contains:

### Title

Short decision statement.

### Status

Proposed / Accepted / Superseded / Deprecated / Rejected.

### Context

Problem and constraints.

### Decision

The actual choice.

### Alternatives considered

At least credible alternatives when material.

### Consequences

Positive and negative.

### Scale and failure analysis

- expected load;
- bottlenecks;
- availability assumptions;
- failure modes;
- recovery.

### Security/privacy analysis

- data involved;
- trust boundary;
- credentials/secrets;
- tenant impact;
- audit implications.

### Migration/rollback

How to adopt and how to exit/replace if necessary.

### Review triggers

Conditions requiring reconsideration.

## 6. Initial accepted architecture direction

The initial platform uses a **modular monorepo / modular-monolith architecture with independently deployable web/API/worker/realtime processes**, rather than premature domain microservices.

Reasons:

- faster development and shared type contracts;
- easier transactional boundaries early;
- fewer distributed-failure modes;
- independent scaling where operationally necessary;
- modules may later split when telemetry justifies it.

## 7. Provider boundaries

Provider-specific implementation sits behind internal adapters for:

- Clerk;
- Stripe;
- object storage;
- email;
- Redis/cache;
- queue;
- search;
- Office editor;
- AI provider(s);
- observability exporters.

The database schema must not casually expose provider-specific IDs as business primary keys.

## 8. Source-of-truth rule

PostgreSQL/internal persistence remains authoritative for Nexosophy business state unless an ADR explicitly changes this.

Examples:

- Clerk is authoritative for authentication/session identity, but internal User is authoritative for business references;
- Stripe is authoritative for payment processor objects, while internal entitlement state is authoritative for product access after reconciliation.

## 9. Statefulness rule

No new stateful request-path service may be added without:

- HA analysis;
- persistence model;
- backup/recovery plan;
- capacity model;
- observability;
- failure/degraded behavior.

## 10. Microservice split criteria

A module should split into a separate service only when one or more is demonstrated:

- independent scaling requirement;
- security/isolation need;
- different runtime/resource profile;
- failure isolation benefit;
- deployment cadence ownership;
- data/transaction boundary supports it.

"Microservices are more scalable" is not sufficient justification.

## 11. Review process

During implementation:

1. author ADR;
2. link relevant specs/phase;
3. review consequences;
4. accept/reject;
5. implement only after required acceptance;
6. update if reality diverges materially.

## 12. ADR testing

An ADR does not replace implementation tests.

Architecture assumptions must be validated by:

- load tests;
- failure tests;
- security tests;
- recovery drills;
- production telemetry.

## 13. Initial ADR set required before Phase 00 closes

- modular monorepo and deployables;
- frontend/web framework;
- API runtime/framework;
- PostgreSQL and pooling;
- cache/rate-limit/queue architecture;
- object storage strategy;
- Clerk identity boundary;
- Stripe billing boundary;
- search strategy;
- realtime/CRDT strategy;
- editor architecture;
- observability strategy.

## 14. Definition of Done

### Planning

- [x] ADR format defined.
- [x] ADR triggers defined.
- [x] provider/source-of-truth/statefulness rules defined.
- [x] microservice split criteria defined.

### Implementation governance

- [ ] Initial ADR set exists and is accepted.
- [ ] Phase 00 tooling links ADRs where applicable.
- [ ] New architecture-impacting changes follow the ADR process.

## 15. Next document

Continue to `05-data-classification-retention.md`.
