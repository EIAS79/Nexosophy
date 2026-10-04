# Nexosophy

Nexosophy is a production-grade connected knowledge and work platform for students, researchers, professors, laboratories, reporters and analysts.

## Repository status

Implementation follows the canonical plan in [`plan/`](plan/README.md). Work proceeds Phase 00 → Phase 24 and a phase closes only when its exit gate passes.

## Toolchain

- Node.js 24 LTS
- pnpm 12
- Turborepo
- Next.js web application
- Fastify API
- PostgreSQL / Drizzle
- Redis-compatible coordination / BullMQ workers
- dedicated realtime process

## Local bootstrap

1. Copy `.env.example` to `.env` and configure required values.
2. Start local infrastructure: `docker compose up -d`.
3. Install dependencies: `corepack enable && pnpm install`.
4. Run validation: `pnpm ci`.
5. Start development services: `pnpm dev`.

The repository intentionally separates web, API, worker and realtime deployables so each can scale independently.
