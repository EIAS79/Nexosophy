create type "structured_document_kind" as enum ('sheet','database');
create type "structured_column_type" as enum ('text','number','boolean','date','select','formula');
create type "structured_view_type" as enum ('table','board','calendar','gallery');
create type "structured_chart_type" as enum ('bar','line','pie');
create type "notebook_cell_type" as enum ('markdown','code');
create type "notebook_output_kind" as enum ('text','html','json','image','error');

create table "structured_documents" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "kind" structured_document_kind not null,
  "settings" jsonb not null default '{}'::jsonb,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("workspace_id","node_id"),
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create table "structured_sheets" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid not null references "structured_documents"("id") on delete cascade,
  "name" text not null,
  "rank" bigint not null default 1024,
  "frozen_rows" integer not null default 1 check ("frozen_rows">=0),
  "frozen_columns" integer not null default 0 check ("frozen_columns">=0),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("document_id","name")
);
create table "structured_columns" (
  "id" uuid primary key default gen_random_uuid(),
  "sheet_id" uuid not null references "structured_sheets"("id") on delete cascade,
  "key" text not null,
  "name" text not null,
  "type" structured_column_type not null,
  "formula" text,
  "validation" jsonb not null default '{}'::jsonb,
  "options" jsonb not null default '[]'::jsonb,
  "sort_order" integer not null default 0,
  "width" integer not null default 180 check ("width" between 60 and 800),
  "version" integer not null default 1,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("sheet_id","key")
);
create index "structured_columns_order_idx" on "structured_columns" ("sheet_id","sort_order","id");
create table "structured_rows" (
  "id" uuid primary key default gen_random_uuid(),
  "sheet_id" uuid not null references "structured_sheets"("id") on delete cascade,
  "position" bigint not null,
  "values" jsonb not null default '{}'::jsonb,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("sheet_id","position")
);
create index "structured_rows_page_idx" on "structured_rows" ("sheet_id","position","id");
create index "structured_rows_values_gin" on "structured_rows" using gin ("values");
create table "structured_views" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid not null references "structured_documents"("id") on delete cascade,
  "name" text not null,
  "type" structured_view_type not null default 'table',
  "config" jsonb not null default '{}'::jsonb,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create table "structured_named_ranges" (
  "id" uuid primary key default gen_random_uuid(),
  "sheet_id" uuid not null references "structured_sheets"("id") on delete cascade,
  "name" text not null,
  "row_start" bigint not null,
  "row_end" bigint not null,
  "column_keys" jsonb not null default '[]'::jsonb,
  unique ("sheet_id","name")
);
create table "structured_charts" (
  "id" uuid primary key default gen_random_uuid(),
  "document_id" uuid not null references "structured_documents"("id") on delete cascade,
  "name" text not null,
  "type" structured_chart_type not null,
  "config" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create table "code_documents" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "language" text not null default 'text',
  "source" text not null default '',
  "schema_version" integer not null default 1,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id","node_id"),
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);

create table "notebook_cells" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "position" bigint not null,
  "type" notebook_cell_type not null,
  "language" text,
  "source" text not null default '',
  "metadata" jsonb not null default '{}'::jsonb,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("workspace_id","node_id","position"),
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create index "notebook_cells_order_idx" on "notebook_cells" ("workspace_id","node_id","position","id");
create table "notebook_outputs" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "cell_id" uuid not null references "notebook_cells"("id") on delete cascade,
  "kind" notebook_output_kind not null,
  "content" jsonb not null,
  "size_bytes" integer not null check ("size_bytes" between 0 and 5000000),
  "created_at" timestamptz not null default now(),
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create index "notebook_outputs_cell_idx" on "notebook_outputs" ("cell_id","created_at","id");

create table "workspace_execution_policy" (
  "workspace_id" uuid primary key references "workspaces"("id") on delete cascade,
  "enabled" boolean not null default false,
  "sandbox_provider" text,
  "updated_at" timestamptz not null default now(),
  constraint "workspace_execution_policy_no_unapproved_enable" check (not "enabled")
);

create table "specialized_history" (
  "id" bigserial primary key,
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "event_type" text not null,
  "payload" jsonb not null default '{}'::jsonb,
  "actor_user_id" uuid references "users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create index "specialized_history_node_idx" on "specialized_history" ("workspace_id","node_id","id" desc);
