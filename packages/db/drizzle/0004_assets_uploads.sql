create type "asset_trust_state" as enum (
  'pending_upload', 'pending_scan', 'quarantined', 'trusted', 'rejected', 'deleted'
);
create type "upload_session_status" as enum (
  'initiated', 'uploading', 'completing', 'scanning', 'processing',
  'complete', 'aborted', 'expired', 'failed'
);
create type "asset_scan_status" as enum ('pending', 'clean', 'infected', 'error');
create type "asset_variant_status" as enum ('queued', 'processing', 'ready', 'failed');
create type "asset_variant_kind" as enum (
  'thumbnail', 'image_preview', 'pdf_preview', 'pdf_text', 'office_preview',
  'media_metadata', 'waveform', 'video_poster'
);
create type "asset_job_type" as enum (
  'scan', 'thumbnail', 'image_preview', 'pdf_preview', 'pdf_text', 'office_preview',
  'media_metadata', 'waveform', 'video_poster', 'cleanup'
);
create type "asset_job_status" as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table "workspace_storage_limits" (
  "workspace_id" uuid primary key references "workspaces"("id") on delete cascade,
  "max_bytes" bigint not null default 10737418240 check ("max_bytes" > 0),
  "max_concurrent_uploads" integer not null default 4 check ("max_concurrent_uploads" between 1 and 32),
  "updated_at" timestamptz not null default now()
);

create table "assets" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid,
  "object_key" text not null,
  "original_filename" text not null,
  "declared_mime" text not null,
  "detected_mime" text,
  "size_bytes" bigint not null check ("size_bytes" >= 0),
  "checksum_sha256" text,
  "etag" text,
  "trust_state" asset_trust_state not null default 'pending_upload',
  "metadata" jsonb not null default '{}'::jsonb,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "deleted_at" timestamptz,
  constraint "assets_node_same_workspace_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete set null,
  constraint "assets_object_key_unique" unique ("object_key")
);
create index "assets_workspace_idx" on "assets" ("workspace_id", "created_at" desc, "id" desc);
create index "assets_node_idx" on "assets" ("workspace_id", "node_id") where "node_id" is not null;
create index "assets_trust_idx" on "assets" ("workspace_id", "trust_state", "created_at");

create table "upload_sessions" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "asset_id" uuid not null references "assets"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "storage_upload_id" text,
  "status" upload_session_status not null default 'initiated',
  "expected_size_bytes" bigint not null check ("expected_size_bytes" >= 0),
  "declared_mime" text not null,
  "expected_checksum_sha256" text,
  "part_size_bytes" integer not null check ("part_size_bytes" between 5242880 and 134217728),
  "expected_parts" integer not null check ("expected_parts" between 1 and 10000),
  "uploaded_bytes" bigint not null default 0 check ("uploaded_bytes" >= 0),
  "last_error" text,
  "expires_at" timestamptz not null,
  "completed_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "upload_sessions_asset_unique" unique ("asset_id")
);
create index "upload_sessions_active_idx"
  on "upload_sessions" ("workspace_id", "status", "expires_at")
  where "status" in ('initiated','uploading','completing','scanning','processing');

create table "upload_parts" (
  "upload_session_id" uuid not null references "upload_sessions"("id") on delete cascade,
  "part_number" integer not null check ("part_number" between 1 and 10000),
  "etag" text not null,
  "size_bytes" integer not null check ("size_bytes" > 0),
  "checksum_sha256" text,
  "created_at" timestamptz not null default now(),
  primary key ("upload_session_id", "part_number")
);

create table "asset_scans" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "asset_id" uuid not null references "assets"("id") on delete cascade,
  "scanner" text not null,
  "scanner_version" text,
  "status" asset_scan_status not null default 'pending',
  "result_code" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz not null default now()
);
create index "asset_scans_asset_idx" on "asset_scans" ("asset_id", "created_at" desc);

create table "asset_variants" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "asset_id" uuid not null references "assets"("id") on delete cascade,
  "kind" asset_variant_kind not null,
  "status" asset_variant_status not null default 'queued',
  "object_key" text,
  "mime_type" text,
  "size_bytes" bigint,
  "checksum_sha256" text,
  "fidelity_label" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "error_message" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "asset_variants_unique_kind" unique ("asset_id", "kind")
);
create index "asset_variants_asset_idx" on "asset_variants" ("asset_id", "kind");

create table "asset_processing_jobs" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "asset_id" uuid not null references "assets"("id") on delete cascade,
  "job_type" asset_job_type not null,
  "status" asset_job_status not null default 'queued',
  "payload" jsonb not null default '{}'::jsonb,
  "attempts" integer not null default 0,
  "max_attempts" integer not null default 5,
  "locked_at" timestamptz,
  "locked_by" text,
  "last_error" text,
  "run_after" timestamptz not null default now(),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "asset_processing_jobs_dedupe" unique ("asset_id", "job_type")
);
create index "asset_processing_jobs_claim_idx"
  on "asset_processing_jobs" ("status", "run_after", "created_at")
  where "status" in ('queued','running');
