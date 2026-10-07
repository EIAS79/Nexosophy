create type "content_node_kind" as enum (
  'folder',
  'note',
  'document',
  'whiteboard',
  'dataset',
  'spreadsheet',
  'notebook',
  'report',
  'research_item',
  'lab_record',
  'attachment',
  'shortcut'
);

create type "content_operation_type" as enum ('copy_subtree', 'trash_subtree', 'restore_subtree');
create type "content_operation_status" as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table "content_nodes" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "parent_id" uuid,
  "kind" content_node_kind not null,
  "name" text not null,
  "target_node_id" uuid,
  "metadata" jsonb not null default '{}'::jsonb,
  "original_parent_id" uuid,
  "trashed_at" timestamptz,
  "trashed_by_user_id" uuid references "users"("id") on delete set null,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "content_nodes_name_check" check (char_length(trim("name")) between 1 and 255),
  constraint "content_nodes_shortcut_target_check" check (
    ("kind" = 'shortcut' and "target_node_id" is not null)
    or ("kind" <> 'shortcut' and "target_node_id" is null)
  ),
  constraint "content_nodes_workspace_id_id_unique" unique ("workspace_id", "id"),
  constraint "content_nodes_parent_same_workspace_fk"
    foreign key ("workspace_id", "parent_id")
    references "content_nodes" ("workspace_id", "id")
    on delete restrict,
  constraint "content_nodes_target_same_workspace_fk"
    foreign key ("workspace_id", "target_node_id")
    references "content_nodes" ("workspace_id", "id")
    on delete restrict
);

create unique index "content_nodes_active_sibling_name_uidx"
  on "content_nodes" ("workspace_id", "parent_id", lower(trim("name"))) nulls not distinct
  where "trashed_at" is null;

create index "content_nodes_children_idx"
  on "content_nodes" ("workspace_id", "parent_id", lower(trim("name")), "id")
  where "trashed_at" is null;

create index "content_nodes_trash_idx"
  on "content_nodes" ("workspace_id", "trashed_at", "id")
  where "trashed_at" is not null;

create index "content_nodes_target_idx"
  on "content_nodes" ("workspace_id", "target_node_id")
  where "target_node_id" is not null;

create table "content_node_favorites" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "node_id" uuid not null,
  "pinned" boolean not null default false,
  "pin_position" bigint,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id", "user_id", "node_id"),
  constraint "content_node_favorites_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes" ("workspace_id", "id")
    on delete cascade
);

create index "content_node_favorites_list_idx"
  on "content_node_favorites" ("workspace_id", "user_id", "pinned" desc, "pin_position", "updated_at" desc);

create table "content_node_recent" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "node_id" uuid not null,
  "open_count" integer not null default 1,
  "last_opened_at" timestamptz not null default now(),
  primary key ("workspace_id", "user_id", "node_id"),
  constraint "content_node_recent_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes" ("workspace_id", "id")
    on delete cascade
);

create index "content_node_recent_list_idx"
  on "content_node_recent" ("workspace_id", "user_id", "last_opened_at" desc, "node_id" desc);

create table "content_operation_jobs" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "operation" content_operation_type not null,
  "status" content_operation_status not null default 'queued',
  "root_node_id" uuid not null,
  "target_parent_id" uuid,
  "payload" jsonb not null default '{}'::jsonb,
  "processed_nodes" integer not null default 0,
  "total_nodes" integer not null default 0,
  "attempts" integer not null default 0,
  "max_attempts" integer not null default 5,
  "idempotency_key" text,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "locked_at" timestamptz,
  "locked_by" text,
  "error_code" text,
  "error_message" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "content_operation_jobs_root_fk"
    foreign key ("workspace_id", "root_node_id")
    references "content_nodes" ("workspace_id", "id")
    on delete cascade,
  constraint "content_operation_jobs_target_fk"
    foreign key ("workspace_id", "target_parent_id")
    references "content_nodes" ("workspace_id", "id")
    on delete restrict,
  constraint "content_operation_jobs_counts_check" check (
    "processed_nodes" >= 0 and "total_nodes" >= 0 and "processed_nodes" <= "total_nodes"
  ),
  unique ("workspace_id", "idempotency_key")
);

create index "content_operation_jobs_claim_idx"
  on "content_operation_jobs" ("status", "created_at", "id")
  where "status" in ('queued', 'running');

create table "content_operation_items" (
  "job_id" uuid not null references "content_operation_jobs"("id") on delete cascade,
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "source_node_id" uuid not null,
  "source_parent_id" uuid,
  "destination_node_id" uuid,
  "depth" integer not null,
  "processed" boolean not null default false,
  "processed_at" timestamptz,
  primary key ("job_id", "source_node_id"),
  constraint "content_operation_items_depth_check" check ("depth" >= 0),
  constraint "content_operation_items_source_fk"
    foreign key ("workspace_id", "source_node_id")
    references "content_nodes" ("workspace_id", "id")
    on delete cascade
);

create index "content_operation_items_batch_idx"
  on "content_operation_items" ("job_id", "processed", "depth", "source_node_id");

create table "content_idempotency" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "idempotency_key" text not null,
  "request_hash" text not null,
  "response" jsonb not null,
  "created_at" timestamptz not null default now(),
  "expires_at" timestamptz not null default (now() + interval '24 hours'),
  primary key ("workspace_id", "idempotency_key")
);

create index "content_idempotency_expiry_idx" on "content_idempotency" ("expires_at");