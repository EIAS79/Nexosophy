create type "investigation_status" as enum ('open','paused','closed','archived');
create type "investigation_classification" as enum ('internal','confidential','restricted','public');
create type "lead_status" as enum ('new','triaged','assigned','closed');
create type "source_confidentiality" as enum ('public','internal','confidential','restricted');
create type "claim_status" as enum ('unverified','in_review','supported','disputed','false','inconclusive');
create type "report_status" as enum ('draft','review','approved','published','withdrawn');
create type "report_review_status" as enum ('pending','approved','changes_requested');

create table "investigations"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "title" text not null,"summary" text not null default '',
 "status" investigation_status not null default 'open',
 "classification" investigation_classification not null default 'internal',
 "embargo_until" timestamptz,"version" integer not null default 1,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create index "investigations_workspace_idx" on "investigations"("workspace_id","status","updated_at" desc);

create table "reporting_leads"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "investigation_id" uuid references "investigations"("id") on delete set null,"title" text not null,"description" text not null default '',
 "status" lead_status not null default 'new',"assigned_user_id" uuid references "users"("id") on delete set null,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "reporting_sources"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "display_name" text not null,"confidentiality" source_confidentiality not null default 'confidential',
 "contact_mode" text not null default 'on_record',"public_profile" jsonb not null default '{}'::jsonb,
 "sensitive_profile" jsonb not null default '{}'::jsonb,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "reporting_source_grants"(
 "source_id" uuid not null references "reporting_sources"("id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,
 "granted_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),primary key("source_id","user_id")
);
create table "reporting_interviews"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "investigation_id" uuid not null references "investigations"("id") on delete cascade,
 "source_id" uuid references "reporting_sources"("id") on delete set null,
 "title" text not null,"occurred_at" timestamptz,"audio_asset_id" uuid references "assets"("id") on delete set null,
 "note_node_id" uuid,"consent" jsonb not null default '{}'::jsonb,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),
 foreign key("workspace_id","note_node_id") references "content_nodes"("workspace_id","id") on delete set null ("note_node_id")
);
create table "reporting_evidence"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "investigation_id" uuid not null references "investigations"("id") on delete cascade,
 "title" text not null,"kind" text not null,"node_id" uuid,"asset_id" uuid references "assets"("id") on delete restrict,
 "provenance" jsonb not null,"content_hash" text not null,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),
 foreign key("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete restrict,
 check(("node_id" is not null)::int+("asset_id" is not null)::int=1)
);
create table "reporting_claims"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "investigation_id" uuid not null references "investigations"("id") on delete cascade,
 "claim" text not null,"status" claim_status not null default 'unverified',"reviewer_notes" text not null default '',
 "version" integer not null default 1,"reviewed_by_user_id" uuid references "users"("id") on delete set null,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "claim_evidence"(
 "claim_id" uuid not null references "reporting_claims"("id") on delete cascade,
 "evidence_id" uuid not null references "reporting_evidence"("id") on delete cascade,
 "relationship" text not null default 'supports',
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),
 primary key("claim_id","evidence_id")
);
create table "investigation_timeline"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "investigation_id" uuid not null references "investigations"("id") on delete cascade,
 "occurred_at" timestamptz not null,"title" text not null,"description" text not null default '',
 "evidence_id" uuid references "reporting_evidence"("id") on delete set null,"source_id" uuid references "reporting_sources"("id") on delete set null,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now()
);
create table "investigation_tasks"(
 "investigation_id" uuid not null references "investigations"("id") on delete cascade,
 "task_id" uuid not null references "tasks"("id") on delete cascade,primary key("investigation_id","task_id")
);

create table "reports"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "investigation_id" uuid references "investigations"("id") on delete set null,
 "title" text not null,"document_node_id" uuid not null,"status" report_status not null default 'draft',
 "visibility" text not null default 'private' check("visibility" in('private','workspace','public')),
 "version" integer not null default 1,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique("workspace_id","document_node_id"),
 foreign key("workspace_id","document_node_id") references "content_nodes"("workspace_id","id") on delete restrict
);
create table "report_reviews"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "report_id" uuid not null references "reports"("id") on delete cascade,"reviewer_user_id" uuid not null references "users"("id") on delete restrict,
 "status" report_review_status not null default 'pending',"notes" text not null default '',
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique("report_id","reviewer_user_id")
);
create table "report_redactions"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "report_id" uuid not null references "reports"("id") on delete cascade,"block_id" text,"pattern" text,"replacement" text not null default '[REDACTED]',
 "reason" text not null,"created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now()
);
create table "report_publications"(
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "report_id" uuid not null references "reports"("id") on delete restrict,"version" integer not null,
 "document_revision" integer not null,"snapshot" jsonb not null,"redacted_snapshot" jsonb not null,
 "content_hash" text not null,"published_by_user_id" uuid not null references "users"("id") on delete restrict,
 "published_at" timestamptz not null default now(),"withdrawn_at" timestamptz,
 unique("report_id","version")
);
create or replace function "nexosophy_reporting_evidence_guard"()returns trigger language plpgsql as $$begin raise exception 'evidence provenance is immutable';end;$$;
create trigger "reporting_evidence_immutable" before update or delete on "reporting_evidence" for each row execute function "nexosophy_reporting_evidence_guard"();
create or replace function "nexosophy_report_publication_guard"()returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    raise exception 'published report snapshot is immutable';
  end if;
  if old."withdrawn_at" is null and new."withdrawn_at" is not null
     and (to_jsonb(new)-'withdrawn_at') is not distinct from (to_jsonb(old)-'withdrawn_at') then
    return new;
  end if;
  raise exception 'published report snapshot is immutable';
end;
$$;
create trigger "report_publications_immutable" before update or delete on "report_publications" for each row execute function "nexosophy_report_publication_guard"();