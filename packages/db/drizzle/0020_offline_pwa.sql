create type "offline_mutation_status" as enum ('queued','applied','conflict','failed');
create type "offline_conflict_status" as enum ('open','resolved_server','resolved_client','resolved_manual');

create table "workspace_offline_policies"(
 "workspace_id" uuid primary key references "workspaces"("id") on delete cascade,
 "offline_allowed" boolean not null default true,
 "attachments_allowed" boolean not null default false,
 "background_sync_allowed" boolean not null default true,
 "max_device_bytes" bigint not null default 262144000 check("max_device_bytes" between 1048576 and 5368709120),
 "updated_by_user_id" uuid references "users"("id") on delete set null,"updated_at" timestamptz not null default now()
);
create table "offline_devices"(
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,"device_id" text not null,"label" text not null default '',
 "platform" text,"app_version" text,"reported_bytes" bigint not null default 0,"last_seen_at" timestamptz not null default now(),
 "revoked_at" timestamptz,"created_at" timestamptz not null default now(),primary key("workspace_id","user_id","device_id")
);
create table "offline_mutations"(
 "operation_id" uuid primary key,"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,"device_id" text not null,
 "mutation_type" text not null check("mutation_type" in('document.save','task.create','task.update')),
 "target_id" text,"payload_hash" text not null,"status" offline_mutation_status not null default 'queued',
 "result" jsonb not null default '{}'::jsonb,"error_code" text,"error_message" text,
 "created_at" timestamptz not null default now(),"applied_at" timestamptz
);
create table "offline_conflicts"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,"device_id" text not null,
 "operation_id" uuid not null unique references "offline_mutations"("operation_id") on delete cascade,
 "mutation_type" text not null,"target_id" text,"client_payload" jsonb not null,"server_snapshot" jsonb not null,
 "status" offline_conflict_status not null default 'open',"resolution" jsonb not null default '{}'::jsonb,
 "resolved_at" timestamptz,"created_at" timestamptz not null default now()
);
create table "offline_pins"(
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,"device_id" text not null,
 "resource_type" text not null check("resource_type" in('node','attachment')),"resource_id" text not null,
 "pinned_at" timestamptz not null default now(),"last_confirmed_at" timestamptz not null default now(),
 primary key("workspace_id","user_id","device_id","resource_type","resource_id")
);
