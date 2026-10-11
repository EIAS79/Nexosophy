create type "template_scope" as enum ('system', 'personal', 'workspace');
create type "template_status" as enum ('draft', 'published', 'archived');
create type "template_variable_type" as enum ('text', 'multiline', 'number', 'date', 'select', 'boolean');
create type "transfer_kind" as enum ('import', 'export');
create type "transfer_fidelity" as enum ('native_editable', 'partially_editable', 'preview_only', 'portable_archive');

create table "template_categories" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid references "workspaces"("id") on delete cascade,
  "slug" text not null,
  "name" text not null,
  "description" text not null default '',
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now(),
  unique ("workspace_id", "slug")
);

create table "templates" (
  "id" uuid primary key default gen_random_uuid(),
  "scope" template_scope not null,
  "workspace_id" uuid references "workspaces"("id") on delete cascade,
  "owner_user_id" uuid references "users"("id") on delete cascade,
  "category_id" uuid references "template_categories"("id") on delete set null,
  "name" text not null,
  "description" text not null default '',
  "status" template_status not null default 'draft',
  "source_node_id" uuid,
  "current_version" integer not null default 0,
  "role_suggestions" jsonb not null default '[]'::jsonb,
  "version" integer not null default 1,
  "published_at" timestamptz,
  "archived_at" timestamptz,
  "created_by_user_id" uuid references "users"("id") on delete set null,
  "updated_by_user_id" uuid references "users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "templates_name_check" check (char_length(trim("name")) between 1 and 180),
  constraint "templates_scope_check" check (
    ("scope" = 'system' and "workspace_id" is null and "owner_user_id" is null)
    or ("scope" = 'personal' and "owner_user_id" is not null)
    or ("scope" = 'workspace' and "workspace_id" is not null)
  )
);
create index "templates_gallery_idx" on "templates" ("scope","workspace_id","status","updated_at" desc,"id" desc);
create index "templates_owner_idx" on "templates" ("owner_user_id","status","updated_at" desc);

create table "template_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "template_id" uuid not null references "templates"("id") on delete cascade,
  "version" integer not null check ("version" > 0),
  "manifest_version" text not null default 'nexosophy-archive-v1',
  "snapshot" jsonb not null,
  "changelog" text not null default '',
  "created_by_user_id" uuid references "users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  unique ("template_id","version")
);

create table "template_variables" (
  "id" uuid primary key default gen_random_uuid(),
  "template_version_id" uuid not null references "template_versions"("id") on delete cascade,
  "key" text not null,
  "label" text not null,
  "type" template_variable_type not null default 'text',
  "required" boolean not null default false,
  "default_value" jsonb,
  "options" jsonb not null default '[]'::jsonb,
  "sort_order" integer not null default 0,
  unique ("template_version_id","key"),
  constraint "template_variables_key_check" check ("key" ~ '^[A-Za-z][A-Za-z0-9_.-]{0,79}$')
);

create table "template_usage" (
  "id" uuid primary key default gen_random_uuid(),
  "template_id" uuid not null references "templates"("id") on delete restrict,
  "template_version_id" uuid not null references "template_versions"("id") on delete restrict,
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "requested_by_user_id" uuid not null references "users"("id") on delete restrict,
  "destination_parent_id" uuid,
  "durable_job_id" uuid references "durable_jobs"("id") on delete set null,
  "variable_values" jsonb not null default '{}'::jsonb,
  "root_node_ids" jsonb not null default '[]'::jsonb,
  "created_at" timestamptz not null default now(),
  constraint "template_usage_parent_fk" foreign key ("workspace_id","destination_parent_id")
    references "content_nodes"("workspace_id","id") on delete set null
);
create index "template_usage_workspace_idx" on "template_usage" ("workspace_id","created_at" desc,"id" desc);

create table "template_usage_node_map" (
  "usage_id" uuid not null references "template_usage"("id") on delete cascade,
  "source_node_id" text not null,
  "new_node_id" uuid not null,
  primary key ("usage_id","source_node_id")
);

create table "transfer_records" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "kind" transfer_kind not null,
  "durable_job_id" uuid references "durable_jobs"("id") on delete set null,
  "requested_by_user_id" uuid not null references "users"("id") on delete restrict,
  "source_node_id" uuid,
  "source_asset_id" uuid references "assets"("id") on delete set null,
  "destination_parent_id" uuid,
  "format" text not null,
  "fidelity" transfer_fidelity not null,
  "options" jsonb not null default '{}'::jsonb,
  "artifact_object_key" text,
  "artifact_filename" text,
  "artifact_mime" text,
  "manifest_version" text,
  "result_root_node_ids" jsonb not null default '[]'::jsonb,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "transfer_source_node_fk" foreign key ("workspace_id","source_node_id")
    references "content_nodes"("workspace_id","id") on delete set null,
  constraint "transfer_destination_parent_fk" foreign key ("workspace_id","destination_parent_id")
    references "content_nodes"("workspace_id","id") on delete set null
);
create unique index "transfer_records_job_idx" on "transfer_records" ("durable_job_id") where "durable_job_id" is not null;
create index "transfer_records_activity_idx" on "transfer_records" ("workspace_id","created_at" desc,"id" desc);

create table "transfer_node_map" (
  "transfer_id" uuid not null references "transfer_records"("id") on delete cascade,
  "source_node_id" text not null,
  "new_node_id" uuid not null,
  primary key ("transfer_id","source_node_id")
);

create table "conversion_artifacts" (
  "id" uuid primary key default gen_random_uuid(),
  "transfer_id" uuid not null references "transfer_records"("id") on delete cascade,
  "kind" text not null,
  "fidelity" transfer_fidelity not null,
  "object_key" text,
  "mime_type" text,
  "filename" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);
create index "conversion_artifacts_transfer_idx" on "conversion_artifacts" ("transfer_id","created_at","id");

insert into "template_categories" ("workspace_id","slug","name","description","sort_order")
values
  (null,'general','General','Reusable documents and notes.',10),
  (null,'research','Research','Research notes, reviews and evidence structures.',20),
  (null,'projects','Projects','Project planning and execution structures.',30),
  (null,'teaching','Teaching','Course and teaching structures.',40),
  (null,'reports','Reports','Reporting and publishing structures.',50)
on conflict do nothing;
