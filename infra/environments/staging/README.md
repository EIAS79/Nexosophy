# Staging Environment Contract

Staging must be deployable from the same commit/artifacts intended for production. No source-code edits are allowed between staging and production promotion.

## Deployables

- `nexosophy-web` — port 3000;
- `nexosophy-api` — port 4000;
- `nexosophy-worker` — health port 4200;
- `nexosophy-realtime` — port 4100.

## Required managed dependencies

- PostgreSQL;
- Redis/Valkey-compatible service;
- S3-compatible object storage before upload features are enabled.

## Artifact identity

Container/build artifacts use the source Git SHA as the immutable revision identifier. Human-friendly environment tags may point at a SHA artifact, but deployment records must retain the underlying digest/SHA.

## Required configuration

Base:
- `NODE_ENV=production`
- `APP_ENV=staging`
- `LOG_LEVEL=info`

Data:
- `DATABASE_URL`
- `REDIS_URL`

Service ports/hosts use the values documented in `.env.example` or platform-provided `PORT` adapters.

Provider secrets such as Clerk and Stripe are configured only when their implementation phase activates them.

## Promotion rule

A staging revision may be promoted only when its required phase gate is green. Production should promote the same immutable artifact rather than rebuilding from mutable source state.
