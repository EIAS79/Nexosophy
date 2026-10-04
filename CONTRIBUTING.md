# Contributing to Nexosophy

Nexosophy is implemented against the canonical contracts in `plan/`.

## Development rules

1. Read the current phase execution contract and owning focused specifications.
2. Do not invent a parallel identity, permission, storage, history, search or billing model.
3. Architecture-impacting changes require an ADR.
4. New unbounded list APIs are not accepted; use cursor pagination.
5. Workspace-owned resources require server-side tenant/permission checks.
6. Retry-sensitive mutations define idempotency/concurrency semantics.
7. User-facing changes include responsive and accessibility behavior.
8. Critical backend changes include logs/metrics/traces and failure behavior.

## Local setup

```bash
cp .env.example .env
docker compose up -d
corepack enable
pnpm install
pnpm ci
pnpm dev
```

## Commit scope

Prefer conventional, phase-aware commits such as:

```text
feat(phase-03): enforce workspace membership
fix(phase-05): resume multipart upload after retry
docs(adr): select search provider
```

## Phase gates

A later phase does not waive an unmet earlier exit gate. See `plan/13-phases/`.
