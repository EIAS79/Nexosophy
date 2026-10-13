# Phase 06 load harness

This directory contains the repeatable mixed-workload scenario used by the Phase 06 API-scale gate.

## Prerequisites

Install k6 outside the repository. The harness deliberately adds no production runtime dependency.

Required environment values:

- `API_BASE_URL` — production-like API origin.
- `AUTH_TOKEN` — valid bearer token for the load-test principal.
- `WORKSPACE_ID` — isolated load-test workspace.
- `DOCUMENT_NODE_IDS` — comma-separated editable node IDs. Use enough nodes to avoid turning the test into a single-document lock benchmark unless hot-key contention is the goal.

Run:

```bash
pnpm load:phase06
```

The scenario combines ordinary content reads, document reads/writes, job reads and a short arrival-rate burst. Writes use unique idempotency keys and treat optimistic `412` conflicts as expected concurrency behavior rather than data-loss failures.

Default thresholds encode the Phase 06 target envelope for simple reads and ordinary writes. Production certification should also capture service CPU/memory, database pool totals/waiters, Redis latency and queue age from the deployment observability stack.
