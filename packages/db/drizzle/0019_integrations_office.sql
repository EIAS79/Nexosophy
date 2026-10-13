create type "integration_provider" as enum ('google','microsoft','mendeley');
create type "integration_connection_status" as enum ('active','degraded','revoked','error');
create type "integration_sync_direction" as enum ('import','export','bidirectional');
create type "integration_conflict_status" as enum ('open','resolved_remote','resolved_local','resolved_manual');
create type "office_provider_kind" as enum ('disabled','onlyoffice','collabora');

create table "integration_connections"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,"provider" integration_provider not null,
 "status" integration_connection_status not null default 'active',"external_account_id" text,"external_account_label" text,
 "scopes" jsonb not null default '[]'::jsonb,"access_token_ciphertext" text,"refresh_token_ciphertext" text,
 "token_expires_at" timestamptz,"token_key_id" text not null,"provider_metadata" jsonb not null default '{}'::jsonb,
 "last_synced_at" timestamptz,"last_error" text,"version" integer not null default 1,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique("workspace_id","user_id","provider")
);
create table "integration_oauth_states"(
 "state_hash" text primary key,"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,"provider" integration_provider not null,
 "code_verifier_ciphertext" text,"key_id" text,"return_path" text not null default '/app',
 "expires_at" timestamptz not null,"consumed_at" timestamptz,"created_at" timestamptz not null default now()
);
create index "integration_oauth_expiry_idx" on "integration_oauth_states"("expires_at");
create table "integration_mappings"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "connection_id" uuid not null references "integration_connections"("id") on delete cascade,
 "resource_type" text not null,"local_id" text not null,"external_id" text not null,"external_etag" text,
 "direction" integration_sync_direction not null default 'bidirectional',"last_local_version" integer,
 "last_external_modified_at" timestamptz,"sync_cursor" text,"metadata" jsonb not null default '{}'::jsonb,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique("connection_id","resource_type","external_id"),unique("connection_id","resource_type","local_id")
);
create table "integration_sync_conflicts"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "connection_id" uuid not null references "integration_connections"("id") on delete cascade,
 "mapping_id" uuid references "integration_mappings"("id") on delete cascade,"resource_type" text not null,
 "local_id" text,"external_id" text,"local_snapshot" jsonb not null default '{}'::jsonb,"remote_snapshot" jsonb not null default '{}'::jsonb,
 "status" integration_conflict_status not null default 'open',"resolution" jsonb not null default '{}'::jsonb,
 "resolved_by_user_id" uuid references "users"("id") on delete set null,"created_at" timestamptz not null default now(),"resolved_at" timestamptz
);
create table "integration_webhook_subscriptions"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "connection_id" uuid not null references "integration_connections"("id") on delete cascade,"provider" integration_provider not null,
 "external_subscription_id" text not null,"resource" text not null,"secret_ciphertext" text,"key_id" text,
 "expires_at" timestamptz,"status" text not null default 'active' check("status" in('active','renewing','expired','revoked','error')),
 "last_error" text,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique("provider","external_subscription_id")
);
create table "integration_webhook_events"(
 "id" uuid primary key default gen_random_uuid(),"provider" integration_provider not null,"external_event_id" text not null,
 "workspace_id" uuid references "workspaces"("id") on delete cascade,"connection_id" uuid references "integration_connections"("id") on delete cascade,
 "payload" jsonb not null default '{}'::jsonb,"received_at" timestamptz not null default now(),"processed_at" timestamptz,
 unique("provider","external_event_id")
);
create table "integration_sync_runs"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "connection_id" uuid not null references "integration_connections"("id") on delete cascade,"resource_type" text not null,
 "durable_job_id" uuid references "durable_jobs"("id") on delete set null,"status" durable_job_status not null default 'queued',
 "direction" integration_sync_direction not null,"cursor_before" text,"cursor_after" text,"stats" jsonb not null default '{}'::jsonb,
 "error_message" text,"created_at" timestamptz not null default now(),"completed_at" timestamptz
);
create table "office_document_versions"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "node_id" uuid not null,"version" integer not null,"asset_id" uuid not null references "assets"("id") on delete restrict,
 "provider" office_provider_kind not null,"provider_version_id" text,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),unique("workspace_id","node_id","version"),
 foreign key("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create table "office_edit_sessions"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "node_id" uuid not null,"asset_id" uuid not null references "assets"("id") on delete restrict,
 "user_id" uuid not null references "users"("id") on delete cascade,"provider" office_provider_kind not null,
 "expected_version" integer not null,"session_token_hash" text not null unique,"provider_session_id" text,
 "status" text not null default 'active' check("status" in('active','saving','saved','expired','failed','revoked')),
 "expires_at" timestamptz not null,"saved_asset_id" uuid references "assets"("id") on delete set null,"last_error" text,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 foreign key("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create table "office_provider_callbacks"(
 "provider" office_provider_kind not null,"callback_id" text not null,
 "session_id" uuid not null references "office_edit_sessions"("id") on delete cascade,
 "payload_hash" text not null,"received_at" timestamptz not null default now(),
 primary key("provider","callback_id")
);
