create type "lab_project_status" as enum ('planned','active','paused','completed','archived');
create type "lab_classification" as enum ('internal','restricted','confidential');
create type "experiment_status" as enum ('planned','running','completed','failed','cancelled');
create type "eln_status" as enum ('draft','signed');
create type "protocol_version_status" as enum ('draft','approved','retired');
create type "sample_status" as enum ('active','consumed','disposed','recalled');
create type "inventory_lot_status" as enum ('active','quarantined','expired','recalled','depleted','disposed');
create type "inventory_transaction_type" as enum ('receive','consume','adjust','transfer','reserve','release','dispose','recall');
create type "equipment_status" as enum ('available','in_use','maintenance','out_of_service','retired');
create type "equipment_booking_status" as enum ('reserved','confirmed','checked_in','checked_out','cancelled');
create type "maintenance_status" as enum ('scheduled','in_progress','completed','cancelled');

create table "lab_projects" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "description" text not null default '',
  "status" lab_project_status not null default 'planned',
  "classification" lab_classification not null default 'internal',
  "restricted" boolean not null default false,
  "root_node_id" uuid,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "archived_at" timestamptz,
  foreign key ("workspace_id","root_node_id") references "content_nodes"("workspace_id","id") on delete set null ("root_node_id")
);
create index "lab_projects_workspace_idx" on "lab_projects" ("workspace_id","status","updated_at" desc,"id");

create table "lab_project_members" (
  "project_id" uuid not null references "lab_projects"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "role" text not null,
  "added_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  primary key ("project_id","user_id")
);

create table "lab_experiments" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid not null references "lab_projects"("id") on delete cascade,
  "title" text not null,
  "objective" text not null default '',
  "hypothesis" text not null default '',
  "status" experiment_status not null default 'planned',
  "planned_start_at" timestamptz,
  "planned_end_at" timestamptz,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create index "lab_experiments_project_idx" on "lab_experiments" ("workspace_id","project_id","status","updated_at" desc);

create table "eln_entries" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid not null references "lab_projects"("id") on delete cascade,
  "experiment_id" uuid references "lab_experiments"("id") on delete set null,
  "node_id" uuid not null,
  "title" text not null,
  "status" eln_status not null default 'draft',
  "signed_at" timestamptz,
  "signed_by_user_id" uuid references "users"("id") on delete set null,
  "content_hash" text,
  "witnessed_at" timestamptz,
  "witnessed_by_user_id" uuid references "users"("id") on delete set null,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("workspace_id","node_id"),
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete restrict
);
create index "eln_entries_project_idx" on "eln_entries" ("workspace_id","project_id","status","created_at" desc);

create table "eln_observations" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "entry_id" uuid not null references "eln_entries"("id") on delete cascade,
  "kind" text not null default 'note',
  "text" text not null,
  "structured" jsonb not null default '{}'::jsonb,
  "observed_at" timestamptz not null default now(),
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);

create table "eln_links" (
  "entry_id" uuid not null references "eln_entries"("id") on delete cascade,
  "target_type" text not null check ("target_type" in ('sample','inventory_lot','protocol_version','asset','dataset','equipment','node')),
  "target_id" text not null,
  "label" text,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  primary key ("entry_id","target_type","target_id")
);

create table "eln_signatures" (
  "id" uuid primary key default gen_random_uuid(),
  "entry_id" uuid not null references "eln_entries"("id") on delete restrict,
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "signature_type" text not null check ("signature_type" in ('author','witness')),
  "content_hash" text not null,
  "reason" text not null,
  "signed_by_user_id" uuid not null references "users"("id") on delete restrict,
  "signed_at" timestamptz not null default now()
);

create table "eln_amendments" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "entry_id" uuid not null references "eln_entries"("id") on delete restrict,
  "node_id" uuid not null,
  "reason" text not null,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete restrict
);

create table "protocols" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "description" text not null default '',
  "category" text,
  "node_id" uuid,
  "current_version" integer not null default 0,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "archived_at" timestamptz,
  foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete set null ("node_id")
);
create index "protocols_workspace_idx" on "protocols" ("workspace_id","updated_at" desc,"id");

create table "protocol_versions" (
  "id" uuid primary key default gen_random_uuid(),
  "protocol_id" uuid not null references "protocols"("id") on delete cascade,
  "version" integer not null,
  "title" text not null,
  "purpose" text not null default '',
  "materials" jsonb not null default '[]'::jsonb,
  "hazards" jsonb not null default '[]'::jsonb,
  "expected_duration_minutes" integer,
  "change_reason" text,
  "status" protocol_version_status not null default 'draft',
  "content_hash" text,
  "approved_at" timestamptz,
  "approved_by_user_id" uuid references "users"("id") on delete set null,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  unique ("protocol_id","version")
);

create table "protocol_steps" (
  "id" uuid primary key default gen_random_uuid(),
  "protocol_version_id" uuid not null references "protocol_versions"("id") on delete cascade,
  "position" integer not null,
  "instruction" text not null,
  "duration_seconds" integer,
  "parameters" jsonb not null default '{}'::jsonb,
  "safety_notes" text,
  unique ("protocol_version_id","position")
);

create table "protocol_approvals" (
  "id" uuid primary key default gen_random_uuid(),
  "protocol_version_id" uuid not null references "protocol_versions"("id") on delete restrict,
  "approved_by_user_id" uuid not null references "users"("id") on delete restrict,
  "reason" text not null,
  "created_at" timestamptz not null default now()
);
create table "protocol_acceptances" (
  "protocol_version_id" uuid not null references "protocol_versions"("id") on delete restrict,
  "user_id" uuid not null references "users"("id") on delete restrict,
  "accepted_at" timestamptz not null default now(),
  primary key ("protocol_version_id","user_id")
);

create table "experiment_runs" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "experiment_id" uuid not null references "lab_experiments"("id") on delete cascade,
  "protocol_version_id" uuid references "protocol_versions"("id") on delete restrict,
  "run_number" integer not null,
  "status" experiment_status not null default 'planned',
  "parameters" jsonb not null default '{}'::jsonb,
  "results" jsonb not null default '{}'::jsonb,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("experiment_id","run_number")
);
create table "experiment_deviations" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "run_id" uuid not null references "experiment_runs"("id") on delete cascade,
  "description" text not null,
  "reason" text not null,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);

create table "storage_locations" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "parent_id" uuid references "storage_locations"("id") on delete restrict,
  "name" text not null,
  "kind" text not null default 'storage',
  "temperature_c" numeric(8,3),
  "metadata" jsonb not null default '{}'::jsonb,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);
create index "storage_locations_parent_idx" on "storage_locations" ("workspace_id","parent_id","name");

create table "lab_samples" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid references "lab_projects"("id") on delete set null,
  "name" text not null,
  "sample_type" text,
  "barcode" text,
  "location_id" uuid references "storage_locations"("id") on delete set null,
  "status" sample_status not null default 'active',
  "metadata" jsonb not null default '{}'::jsonb,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("workspace_id","barcode")
);
create index "lab_samples_workspace_idx" on "lab_samples" ("workspace_id","status","name","id");

create table "sample_lineage" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "parent_sample_id" uuid not null references "lab_samples"("id") on delete cascade,
  "child_sample_id" uuid not null references "lab_samples"("id") on delete cascade,
  "relationship" text not null default 'derived',
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  primary key ("parent_sample_id","child_sample_id"),
  check ("parent_sample_id"<>"child_sample_id")
);

create table "inventory_items" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "category" text,
  "base_unit" text not null,
  "catalog_number" text,
  "vendor" text,
  "sds_asset_id" uuid references "assets"("id") on delete set null,
  "hazards" jsonb not null default '[]'::jsonb,
  "low_stock_threshold" numeric(20,6),
  "responsible_user_id" uuid references "users"("id") on delete set null,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create index "inventory_items_workspace_idx" on "inventory_items" ("workspace_id","name","id");

create table "inventory_lots" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "item_id" uuid not null references "inventory_items"("id") on delete cascade,
  "lot_number" text not null,
  "location_id" uuid references "storage_locations"("id") on delete set null,
  "received_at" timestamptz not null default now(),
  "expiry_date" date,
  "quantity" numeric(20,6) not null default 0 check ("quantity">=0),
  "reserved_quantity" numeric(20,6) not null default 0 check ("reserved_quantity">=0 and "reserved_quantity"<="quantity"),
  "status" inventory_lot_status not null default 'active',
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  unique ("item_id","lot_number")
);
create index "inventory_lots_fefo_idx" on "inventory_lots" ("workspace_id","item_id","status","expiry_date","received_at");

create table "inventory_transactions" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "lot_id" uuid not null references "inventory_lots"("id") on delete restrict,
  "type" inventory_transaction_type not null,
  "quantity_delta" numeric(20,6) not null,
  "unit" text not null,
  "reason" text not null,
  "actor_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);
create index "inventory_transactions_lot_idx" on "inventory_transactions" ("workspace_id","lot_id","created_at","id");

create table "inventory_reservations" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "lot_id" uuid not null references "inventory_lots"("id") on delete cascade,
  "quantity" numeric(20,6) not null check ("quantity">0),
  "unit" text not null,
  "purpose" text not null default '',
  "status" text not null default 'active' check ("status" in ('active','consumed','released','cancelled')),
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "resolved_at" timestamptz
);

create table "equipment" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "category" text,
  "serial_number" text,
  "location_id" uuid references "storage_locations"("id") on delete set null,
  "status" equipment_status not null default 'available',
  "manual_asset_id" uuid references "assets"("id") on delete set null,
  "responsible_user_id" uuid references "users"("id") on delete set null,
  "training_requirement" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("workspace_id","serial_number")
);
create index "equipment_workspace_idx" on "equipment" ("workspace_id","status","name","id");

create table "lab_training_records" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "requirement" text not null,
  "completed_at" timestamptz not null,
  "valid_until" timestamptz,
  "evidence_asset_id" uuid references "assets"("id") on delete set null,
  "recorded_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);

create table "equipment_bookings" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "equipment_id" uuid not null references "equipment"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete restrict,
  "experiment_run_id" uuid references "experiment_runs"("id") on delete set null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "timezone" text not null default 'UTC',
  "purpose" text not null default '',
  "status" equipment_booking_status not null default 'reserved',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  check ("ends_at">"starts_at")
);
create index "equipment_bookings_range_idx" on "equipment_bookings" ("workspace_id","equipment_id","starts_at","ends_at","status");

create table "equipment_usage_logs" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "equipment_id" uuid not null references "equipment"("id") on delete cascade,
  "booking_id" uuid references "equipment_bookings"("id") on delete set null,
  "user_id" uuid not null references "users"("id") on delete restrict,
  "checked_in_at" timestamptz,
  "checked_out_at" timestamptz,
  "notes" text not null default '',
  "created_at" timestamptz not null default now()
);

create table "equipment_maintenance" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "equipment_id" uuid not null references "equipment"("id") on delete cascade,
  "kind" text not null,
  "starts_at" timestamptz not null,
  "ends_at" timestamptz,
  "description" text not null default '',
  "performed_by" text,
  "status" maintenance_status not null default 'scheduled',
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);
create index "equipment_maintenance_range_idx" on "equipment_maintenance" ("workspace_id","equipment_id","status","starts_at","ends_at");

create table "equipment_calibrations" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "equipment_id" uuid not null references "equipment"("id") on delete cascade,
  "performed_at" timestamptz not null,
  "valid_until" timestamptz,
  "result" text not null,
  "certificate_asset_id" uuid references "assets"("id") on delete set null,
  "performed_by" text,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);

create table "lab_policies" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "content" text not null,
  "version" integer not null default 1,
  "active" boolean not null default true,
  "requires_acknowledgement" boolean not null default false,
  "reason_for_change_required" boolean not null default false,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now()
);
create table "lab_policy_acknowledgements" (
  "policy_id" uuid not null references "lab_policies"("id") on delete restrict,
  "user_id" uuid not null references "users"("id") on delete restrict,
  "policy_version" integer not null,
  "acknowledged_at" timestamptz not null default now(),
  primary key ("policy_id","user_id","policy_version")
);
create table "lab_retention_rules" (
  "workspace_id" uuid primary key references "workspaces"("id") on delete cascade,
  "eln_retention_days" integer not null default 3650 check ("eln_retention_days">=30),
  "inventory_retention_days" integer not null default 3650 check ("inventory_retention_days">=30),
  "updated_by_user_id" uuid references "users"("id") on delete set null,
  "updated_at" timestamptz not null default now()
);
create table "lab_legal_holds" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid references "lab_projects"("id") on delete set null,
  "reason" text not null,
  "active" boolean not null default true,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "released_at" timestamptz
);
create table "lab_access_reviews" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid references "lab_projects"("id") on delete set null,
  "reviewed_by_user_id" uuid not null references "users"("id") on delete restrict,
  "snapshot" jsonb not null,
  "findings" text not null default '',
  "created_at" timestamptz not null default now()
);
create table "lab_alert_state" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "alert_key" text not null,
  "category" text not null,
  "target_id" text,
  "created_at" timestamptz not null default now(),
  "acknowledged_at" timestamptz,
  primary key ("workspace_id","alert_key")
);
create table "lab_integrity_events" (
  "id" bigserial primary key,
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid references "lab_projects"("id") on delete set null,
  "event_type" text not null,
  "target_type" text not null,
  "target_id" text not null,
  "actor_user_id" uuid references "users"("id") on delete set null,
  "reason" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);
create index "lab_integrity_events_idx" on "lab_integrity_events" ("workspace_id","id" desc);
create table "lab_export_records" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid references "lab_projects"("id") on delete set null,
  "requested_by_user_id" uuid not null references "users"("id") on delete restrict,
  "format" text not null check ("format" in ('json','csv')),
  "scope" text not null check ("scope" in ('project','inventory','equipment','audit','workspace')),
  "legal_hold_active" boolean not null default false,
  "artifact_summary" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);

create or replace function "nexosophy_lab_append_only"()
returns trigger language plpgsql as $$
begin
  raise exception 'append-only laboratory record';
end;
$$;
create trigger "eln_signatures_append_only" before update or delete on "eln_signatures" for each row execute function "nexosophy_lab_append_only"();
create trigger "eln_amendments_append_only" before update or delete on "eln_amendments" for each row execute function "nexosophy_lab_append_only"();
create trigger "protocol_approvals_append_only" before update or delete on "protocol_approvals" for each row execute function "nexosophy_lab_append_only"();
create trigger "protocol_acceptances_append_only" before update or delete on "protocol_acceptances" for each row execute function "nexosophy_lab_append_only"();
create trigger "inventory_transactions_append_only" before update or delete on "inventory_transactions" for each row execute function "nexosophy_lab_append_only"();
create trigger "lab_integrity_events_append_only" before update or delete on "lab_integrity_events" for each row execute function "nexosophy_lab_append_only"();
create trigger "lab_access_reviews_append_only" before update or delete on "lab_access_reviews" for each row execute function "nexosophy_lab_append_only"();
create trigger "lab_export_records_append_only" before update or delete on "lab_export_records" for each row execute function "nexosophy_lab_append_only"();

create or replace function "nexosophy_guard_signed_eln_document"()
returns trigger language plpgsql as $$
declare row_workspace uuid;
declare row_node uuid;
begin
  row_workspace := case when tg_op='DELETE' then old."workspace_id" else new."workspace_id" end;
  row_node := case when tg_op='DELETE' then old."node_id" else new."node_id" end;
  if exists (
    select 1 from "eln_entries"
    where "workspace_id"=row_workspace and "node_id"=row_node and "status"='signed'
  ) then
    raise exception 'signed ELN document is immutable; create an amendment';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger "documents_signed_eln_guard"
before update or delete on "documents"
for each row execute function "nexosophy_guard_signed_eln_document"();

create or replace function "nexosophy_guard_signed_eln_child"()
returns trigger language plpgsql as $$
declare entry uuid;
begin
  entry := case when tg_op='DELETE' then old."entry_id" else new."entry_id" end;
  if exists(select 1 from "eln_entries" where "id"=entry and "status"='signed') then
    raise exception 'signed ELN record is immutable; create an amendment';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger "eln_observations_signed_guard"
before insert or update or delete on "eln_observations"
for each row execute function "nexosophy_guard_signed_eln_child"();
create trigger "eln_links_signed_guard"
before insert or update or delete on "eln_links"
for each row execute function "nexosophy_guard_signed_eln_child"();

create or replace function "nexosophy_protocol_version_guard"()
returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if old."status"='approved' then raise exception 'approved protocol version is immutable'; end if;
    return old;
  end if;
  if old."status"='approved' and (
    old."title" is distinct from new."title" or
    old."purpose" is distinct from new."purpose" or
    old."materials" is distinct from new."materials" or
    old."hazards" is distinct from new."hazards" or
    old."expected_duration_minutes" is distinct from new."expected_duration_minutes" or
    old."content_hash" is distinct from new."content_hash" or
    old."approved_at" is distinct from new."approved_at" or
    old."approved_by_user_id" is distinct from new."approved_by_user_id"
  ) then raise exception 'approved protocol version is immutable'; end if;
  return new;
end;
$$;
create trigger "protocol_version_guard" before update or delete on "protocol_versions"
for each row execute function "nexosophy_protocol_version_guard"();

create or replace function "nexosophy_protocol_step_guard"()
returns trigger language plpgsql as $$
declare version_id uuid;
begin
  version_id := case when tg_op='DELETE' then old."protocol_version_id" else new."protocol_version_id" end;
  if exists(select 1 from "protocol_versions" where "id"=version_id and "status"='approved') then
    raise exception 'approved protocol steps are immutable';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger "protocol_step_guard" before insert or update or delete on "protocol_steps"
for each row execute function "nexosophy_protocol_step_guard"();

create or replace function "nexosophy_sample_lineage_guard"()
returns trigger language plpgsql as $$
begin
  if exists (
    with recursive descendants(id) as (
      select new."child_sample_id"
      union all
      select sl."child_sample_id"
      from "sample_lineage" sl join descendants d on sl."parent_sample_id"=d.id
      where sl."workspace_id"=new."workspace_id"
    )
    select 1 from descendants where id=new."parent_sample_id"
  ) then raise exception 'sample lineage cycle'; end if;
  return new;
end;
$$;
create trigger "sample_lineage_guard" before insert or update on "sample_lineage"
for each row execute function "nexosophy_sample_lineage_guard"();

with cat as (
  select "id" from "template_categories"
  where "workspace_id" is null and "slug"='research' limit 1
), inserted as (
  insert into "templates" ("scope","category_id","name","description","status","current_version","role_suggestions","published_at")
  select 'system',cat."id",'Electronic Lab Notebook Starter','Research project and ELN starter structure.','published',1,'["researcher","lab"]'::jsonb,now()
  from cat returning "id"
)
insert into "template_versions" ("template_id","version","snapshot")
select "id",1,'{"format":"nexosophy-archive","version":1,"exportedAt":"2026-10-09T00:00:00.000Z","source":{"scope":"template","sourceNodeId":null},"fidelity":"portable_archive","redactions":[],"nodes":[{"id":"eln","parentId":null,"kind":"lab_record","name":"{{experimentName}} ELN","metadata":{"labTemplate":"eln"},"richDocument":{"type":"doc","blocks":[{"id":"h","type":"heading","level":1,"text":"{{experimentName}}"},{"id":"o","type":"heading","level":2,"text":"Objective / hypothesis"},{"id":"m","type":"heading","level":2,"text":"Materials & methods"},{"id":"r","type":"heading","level":2,"text":"Results / observations"},{"id":"c","type":"heading","level":2,"text":"Conclusion"}]},"spatialDocument":null,"spatialElements":[],"tags":[]}],"relations":[]}'::jsonb
from inserted;

with cat as (
  select "id" from "template_categories"
  where "workspace_id" is null and "slug"='research' limit 1
), inserted as (
  insert into "templates" ("scope","category_id","name","description","status","current_version","role_suggestions","published_at")
  select 'system',cat."id",'SOP / Protocol Starter','Version-ready standard operating procedure structure.','published',1,'["researcher","lab"]'::jsonb,now()
  from cat returning "id"
)
insert into "template_versions" ("template_id","version","snapshot")
select "id",1,'{"format":"nexosophy-archive","version":1,"exportedAt":"2026-10-09T00:00:00.000Z","source":{"scope":"template","sourceNodeId":null},"fidelity":"portable_archive","redactions":[],"nodes":[{"id":"sop","parentId":null,"kind":"lab_record","name":"{{protocolName}}","metadata":{"labTemplate":"sop"},"richDocument":{"type":"doc","blocks":[{"id":"h","type":"heading","level":1,"text":"{{protocolName}}"},{"id":"p","type":"heading","level":2,"text":"Purpose"},{"id":"s","type":"heading","level":2,"text":"Scope & safety"},{"id":"m","type":"heading","level":2,"text":"Materials"},{"id":"steps","type":"heading","level":2,"text":"Procedure"},{"id":"q","type":"heading","level":2,"text":"Quality / acceptance criteria"}]},"spatialDocument":null,"spatialElements":[],"tags":[]}],"relations":[]}'::jsonb
from inserted;