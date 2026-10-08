create type "document_version_reason" as enum ('checkpoint', 'manual', 'restore');
create type "deletion_job_status" as enum ('queued', 'running', 'succeeded', 'failed');

create table "document_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "source_revision" integer not null check ("source_revision" > 0),
  "schema_version" integer not null check ("schema_version" > 0),
  "body" jsonb not null,
  "reason" document_version_reason not null default 'checkpoint',
  "label" text,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  constraint "document_versions_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade
);
create index "document_versions_timeline_idx"
  on "document_versions" ("workspace_id", "node_id", "created_at" desc, "id" desc);
create unique index "document_versions_source_revision_idx"
  on "document_versions" ("workspace_id", "node_id", "source_revision", "reason")
  where "reason" = 'checkpoint';

create table "workspace_retention_policies" (
  "workspace_id" uuid primary key references "workspaces"("id") on delete cascade,
  "trash_retention_days" integer not null default 30
    check ("trash_retention_days" between 1 and 3650),
  "updated_by_user_id" uuid references "users"("id") on delete set null,
  "updated_at" timestamptz not null default now()
);

create table "content_deletion_jobs" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "root_node_id" uuid not null,
  "status" deletion_job_status not null default 'queued',
  "reason" text not null default 'user_request',
  "requested_by_user_id" uuid references "users"("id") on delete set null,
  "processed_nodes" integer not null default 0,
  "total_nodes" integer not null default 0,
  "attempts" integer not null default 0,
  "max_attempts" integer not null default 8,
  "locked_at" timestamptz,
  "locked_by" text,
  "last_error" text,
  "run_after" timestamptz not null default now(),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create unique index "content_deletion_jobs_active_root_idx"
  on "content_deletion_jobs" ("workspace_id", "root_node_id")
  where "status" in ('queued','running');
create index "content_deletion_jobs_claim_idx"
  on "content_deletion_jobs" ("status", "run_after", "created_at", "id")
  where "status" in ('queued','running');

create or replace function "nexosophy_workspace_audit_immutable"()
returns trigger
language plpgsql
as $$
begin
  raise exception 'workspace audit events are append-only';
end;
$$;

drop trigger if exists "workspace_audit_events_immutable" on "workspace_audit_events";
create trigger "workspace_audit_events_immutable"
before update or delete on "workspace_audit_events"
for each row execute function "nexosophy_workspace_audit_immutable"();
