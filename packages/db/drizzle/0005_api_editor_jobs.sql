create type "durable_job_status" as enum (
  'queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter'
);
create type "outbox_status" as enum ('pending', 'processing', 'published', 'dead_letter');

create table "documents" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "schema_version" integer not null default 1 check ("schema_version" > 0),
  "body" jsonb not null default '{"type":"doc","blocks":[]}'::jsonb,
  "revision" integer not null default 1 check ("revision" > 0),
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id", "node_id"),
  constraint "documents_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade
);
create index "documents_updated_idx"
  on "documents" ("workspace_id", "updated_at" desc, "node_id");

create table "api_idempotency_records" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "actor_user_id" uuid not null references "users"("id") on delete cascade,
  "idempotency_key" text not null,
  "request_hash" text not null,
  "response_status" integer not null,
  "response" jsonb not null,
  "created_at" timestamptz not null default now(),
  "expires_at" timestamptz not null default (now() + interval '24 hours'),
  primary key ("workspace_id", "actor_user_id", "idempotency_key")
);
create index "api_idempotency_expiry_idx"
  on "api_idempotency_records" ("expires_at");

create table "durable_jobs" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid references "workspaces"("id") on delete cascade,
  "queue" text not null,
  "job_type" text not null,
  "dedupe_key" text,
  "status" durable_job_status not null default 'queued',
  "payload" jsonb not null default '{}'::jsonb,
  "progress" jsonb not null default '{}'::jsonb,
  "attempts" integer not null default 0,
  "max_attempts" integer not null default 8,
  "run_after" timestamptz not null default now(),
  "locked_at" timestamptz,
  "locked_by" text,
  "last_error_code" text,
  "last_error_message" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create unique index "durable_jobs_dedupe_idx"
  on "durable_jobs" ("queue", "dedupe_key")
  where "dedupe_key" is not null and "status" in ('queued','running','succeeded');
create index "durable_jobs_claim_idx"
  on "durable_jobs" ("queue", "status", "run_after", "created_at", "id")
  where "status" in ('queued','running');

create table "outbox_events" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid references "workspaces"("id") on delete cascade,
  "aggregate_type" text not null,
  "aggregate_id" text not null,
  "event_type" text not null,
  "payload" jsonb not null default '{}'::jsonb,
  "status" outbox_status not null default 'pending',
  "attempts" integer not null default 0,
  "available_at" timestamptz not null default now(),
  "locked_at" timestamptz,
  "locked_by" text,
  "published_at" timestamptz,
  "last_error" text,
  "created_at" timestamptz not null default now()
);
create index "outbox_claim_idx"
  on "outbox_events" ("status", "available_at", "created_at", "id")
  where "status" in ('pending','processing');

create table "dead_letters" (
  "id" uuid primary key default gen_random_uuid(),
  "source_type" text not null,
  "source_id" uuid not null,
  "queue" text not null,
  "payload" jsonb not null,
  "error_code" text,
  "error_message" text,
  "attempts" integer not null,
  "failed_at" timestamptz not null default now(),
  "replayed_at" timestamptz
);
create index "dead_letters_queue_idx" on "dead_letters" ("queue", "failed_at" desc, "id" desc);
