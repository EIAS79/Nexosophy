# Nexosophy Infrastructure

This directory contains provider-neutral deployment contracts and environment-specific infrastructure documentation.

## Principles

- immutable build artifacts are identified by Git commit SHA;
- runtime configuration enters through environment variables/secrets, not source edits;
- web, API, worker and realtime are independently deployable/scalable;
- PostgreSQL and Redis-compatible services are managed dependencies in production;
- large user objects use managed S3-compatible storage;
- production credentials never live in this repository.

## Environments

- `local` — developer machine / compose services;
- `preview` — pull-request or ephemeral integration environment;
- `staging` — production-like validation;
- `production` — customer traffic.

See `environments/staging/README.md` for the initial staging contract.
