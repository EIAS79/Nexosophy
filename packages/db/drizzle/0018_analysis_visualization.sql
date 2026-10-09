create type "analysis_dataset_status" as enum ('pending','ready','failed','archived');
create type "analysis_run_status" as enum ('queued','running','succeeded','failed','cancelled');
create type "visualization_type" as enum ('bar','line','area','scatter','pie','histogram','table','metric');

create table "analysis_datasets"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "name" text not null,"source_type" text not null check("source_type" in('structured','csv_asset','transformation')),
 "source_structured_document_id" uuid references "structured_documents"("id") on delete set null,
 "source_asset_id" uuid references "assets"("id") on delete set null,
 "structured_document_id" uuid references "structured_documents"("id") on delete set null,
 "parent_dataset_id" uuid references "analysis_datasets"("id") on delete set null,
 "source_version" integer,"status" analysis_dataset_status not null default 'pending',
 "row_count" bigint,"column_count" integer,"profile" jsonb not null default '{}'::jsonb,
 "version" integer not null default 1,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create index "analysis_datasets_workspace_idx" on "analysis_datasets"("workspace_id","status","updated_at" desc);

create table "analysis_recipes"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "name" text not null,"description" text not null default '',"current_version" integer not null default 0,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "analysis_recipe_versions"(
 "id" uuid primary key default gen_random_uuid(),"recipe_id" uuid not null references "analysis_recipes"("id") on delete cascade,
 "version" integer not null,"operations" jsonb not null,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),unique("recipe_id","version")
);
create table "analysis_runs"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "input_dataset_id" uuid not null references "analysis_datasets"("id") on delete restrict,
 "recipe_version_id" uuid not null references "analysis_recipe_versions"("id") on delete restrict,
 "output_dataset_id" uuid references "analysis_datasets"("id") on delete set null,
 "durable_job_id" uuid references "durable_jobs"("id") on delete set null,
 "status" analysis_run_status not null default 'queued',"input_fingerprint" text not null,"output_fingerprint" text,
 "parameters" jsonb not null default '{}'::jsonb,"error_code" text,"error_message" text,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"started_at" timestamptz,"completed_at" timestamptz
);
create index "analysis_runs_idx" on "analysis_runs"("workspace_id","created_at" desc);
create table "analysis_visualizations"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "dataset_id" uuid not null references "analysis_datasets"("id") on delete cascade,"name" text not null,
 "type" visualization_type not null,"spec" jsonb not null,"accessible_description" text not null default '',
 "version" integer not null default 1,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "analysis_dashboards"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "name" text not null,"description" text not null default '',"layout" jsonb not null default '{}'::jsonb,
 "version" integer not null default 1,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "analysis_dashboard_widgets"(
 "dashboard_id" uuid not null references "analysis_dashboards"("id") on delete cascade,
 "visualization_id" uuid not null references "analysis_visualizations"("id") on delete cascade,
 "position" integer not null,"config" jsonb not null default '{}'::jsonb,
 primary key("dashboard_id","visualization_id"),unique("dashboard_id","position")
);
create table "analysis_notebook_links"(
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "dataset_id" uuid not null references "analysis_datasets"("id") on delete cascade,
 "notebook_node_id" uuid not null,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),primary key("dataset_id","notebook_node_id"),
 foreign key("workspace_id","notebook_node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create table "analysis_exports"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "source_type" text not null check("source_type" in('dataset','visualization','dashboard')),"source_id" uuid not null,
 "format" text not null check("format" in('csv','json','svg','html')),"artifact_object_key" text,"artifact_filename" text,"artifact_mime" text,
 "durable_job_id" uuid references "durable_jobs"("id") on delete set null,"status" analysis_run_status not null default 'queued',
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),"completed_at" timestamptz
);
create table "analysis_cache"(
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,"cache_key" text not null,
 "payload" jsonb not null,"expires_at" timestamptz not null,"created_at" timestamptz not null default now(),
 primary key("workspace_id","cache_key")
);
