# ADR 0009 — Search Architecture

**Status:** Accepted

## Decision
PostgreSQL remains the source of truth. Search uses a provider-neutral adapter.

Bootstrap/fallback may use PostgreSQL FTS/trigram capabilities. A dedicated search engine is introduced when production index size/query load justifies it and before large public scale if needed.

## Rules
- indexing is asynchronous through durable jobs/outbox;
- workspace and permission filters are first-class;
- revocation cannot rely only on stale index deletion;
- the index is rebuildable from canonical data;
- backfills are throttled.

## Provider decision
OpenSearch, Typesense, Meilisearch or equivalent will be benchmarked before Phase 10.

## References
- [Architecture Decision Framework](../04-architecture-decisions.md)
- [Canonical Specification Index](../../SPEC_INDEX.md)
