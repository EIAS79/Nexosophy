# ADR 0012 — Observability and Operational Telemetry

**Status:** Accepted

## Decision
Use **OpenTelemetry-compatible instrumentation** across web, API, workers and realtime, plus centralized structured logs, error aggregation and metrics dashboards.

## Required signals
- request rate/error/duration;
- DB pool/query/lock metrics;
- Redis/cache metrics;
- queue depth/age/retries/DLQ;
- realtime connections/errors;
- provider latency and failures;
- auth/billing webhook health;
- frontend Core Web Vitals;
- synthetic critical journeys.

## Rules
- request/trace IDs propagate through async jobs;
- secrets/raw sensitive content are redacted;
- metric labels have bounded cardinality;
- P0/P1 alerts map to runbooks.

## References
- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
