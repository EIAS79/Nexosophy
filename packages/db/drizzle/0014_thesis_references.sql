create type "thesis_status" as enum ('proposal','research','writing','review','submitted','defended','archived');
create type "research_statement_type" as enum ('question','hypothesis','objective');
create type "chapter_status" as enum ('planned','drafting','review','approved','final');
create type "identifier_type" as enum ('doi','isbn','pmid','arxiv','other');
create type "reference_type" as enum ('article','book','chapter','conference','thesis','report','web','dataset','other');
create type "ethics_status" as enum ('not_required','planned','submitted','approved','rejected','expired');

create table "thesis_projects" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "title" text not null,"degree" text,"field" text,"status" thesis_status not null default 'proposal',
 "proposal" text not null default '',"root_node_id" uuid,"proposal_node_id" uuid,"version" integer not null default 1,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"updated_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 foreign key ("workspace_id","root_node_id") references "content_nodes"("workspace_id","id") on delete set null,
 foreign key ("workspace_id","proposal_node_id") references "content_nodes"("workspace_id","id") on delete set null
);
create table "thesis_supervisors" (
 "id" uuid primary key default gen_random_uuid(),"project_id" uuid not null references "thesis_projects"("id") on delete cascade,
 "name" text not null,"email" text,"role" text not null default 'supervisor',"active" boolean not null default true,
 "created_at" timestamptz not null default now()
);
create table "research_statements" (
 "id" uuid primary key default gen_random_uuid(),"project_id" uuid not null references "thesis_projects"("id") on delete cascade,
 "type" research_statement_type not null,"text" text not null,"position" integer not null default 0,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "thesis_chapters" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "project_id" uuid not null references "thesis_projects"("id") on delete cascade,"node_id" uuid not null,
 "title" text not null,"position" integer not null,"status" chapter_status not null default 'planned',
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique ("project_id","position"),foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create table "thesis_milestones" (
 "id" uuid primary key default gen_random_uuid(),"project_id" uuid not null references "thesis_projects"("id") on delete cascade,
 "task_id" uuid not null references "tasks"("id") on delete cascade,"kind" text not null default 'milestone',
 "created_at" timestamptz not null default now(),unique("task_id")
);
create table "thesis_supervision_meetings" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "project_id" uuid not null references "thesis_projects"("id") on delete cascade,
 "calendar_event_id" uuid not null references "calendar_events"("id") on delete cascade,"notes_node_id" uuid,
 "agenda" text not null default '',"created_at" timestamptz not null default now(),
 foreign key ("workspace_id","notes_node_id") references "content_nodes"("workspace_id","id") on delete set null
);
create table "thesis_decisions" (
 "id" bigserial primary key,"project_id" uuid not null references "thesis_projects"("id") on delete cascade,
 "decision" text not null,"rationale" text not null default '',"actor_user_id" uuid references "users"("id") on delete set null,
 "created_at" timestamptz not null default now()
);
create table "ethics_records" (
 "id" uuid primary key default gen_random_uuid(),"project_id" uuid not null references "thesis_projects"("id") on delete cascade,
 "status" ethics_status not null default 'planned',"authority" text,"reference_number" text,"submitted_on" date,"approved_on" date,"expires_on" date,
 "notes" text not null default '',"updated_at" timestamptz not null default now()
);
create table "thesis_links" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "project_id" uuid not null references "thesis_projects"("id") on delete cascade,"node_id" uuid not null,"kind" text not null,
 "created_at" timestamptz not null default now(),unique("project_id","node_id","kind"),
 foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create table "submission_checklist" (
 "id" uuid primary key default gen_random_uuid(),"project_id" uuid not null references "thesis_projects"("id") on delete cascade,
 "label" text not null,"done" boolean not null default false,"position" integer not null default 0,"updated_at" timestamptz not null default now()
);

create table "references_library" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "type" reference_type not null default 'article',"title" text not null,"year" integer,"container_title" text,"volume" text,"issue" text,
 "pages" text,"publisher" text,"url" text,"abstract" text,"metadata" jsonb not null default '{}'::jsonb,"version" integer not null default 1,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"updated_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create index "references_search_idx" on "references_library" ("workspace_id","year" desc,"title","id");
create table "reference_authors" (
 "id" uuid primary key default gen_random_uuid(),"reference_id" uuid not null references "references_library"("id") on delete cascade,
 "position" integer not null,"family" text,"given" text,"literal" text,unique("reference_id","position")
);
create table "reference_identifiers" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "reference_id" uuid not null references "references_library"("id") on delete cascade,
 "type" identifier_type not null,"value" text not null,
 "normalized_value" text generated always as (lower(trim("value"))) stored,
 unique ("workspace_id","type","normalized_value")
);
create index "reference_identifiers_reference_idx" on "reference_identifiers" ("reference_id","type");
create table "reference_attachments" (
 "reference_id" uuid not null references "references_library"("id") on delete cascade,
 "asset_id" uuid not null references "assets"("id") on delete cascade,"label" text,
 "created_at" timestamptz not null default now(),primary key("reference_id","asset_id")
);
create table "literature_collections" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "project_id" uuid references "thesis_projects"("id") on delete set null,"name" text not null,"created_at" timestamptz not null default now()
);
create table "literature_collection_items" (
 "collection_id" uuid not null references "literature_collections"("id") on delete cascade,
 "reference_id" uuid not null references "references_library"("id") on delete cascade,
 "created_at" timestamptz not null default now(),primary key("collection_id","reference_id")
);
create table "citation_styles" (
 "id" text primary key,"label" text not null,"config" jsonb not null default '{}'::jsonb
);
insert into "citation_styles"("id","label") values ('apa7','APA 7th'),('ieee','IEEE'),('harvard','Harvard') on conflict do nothing;
create table "citation_instances" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "document_node_id" uuid not null,"reference_id" uuid not null references "references_library"("id") on delete restrict,
 "style_id" text not null references "citation_styles"("id"),"locator" text,"citation_key" text not null,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,"created_at" timestamptz not null default now(),
 foreign key ("workspace_id","document_node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create index "citation_doc_idx" on "citation_instances" ("workspace_id","document_node_id","created_at","id");
create table "reference_annotations" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "reference_id" uuid not null references "references_library"("id") on delete cascade,"note_node_id" uuid,
 "quote" text,"comment" text not null default '',"page_locator" text,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),
 foreign key ("workspace_id","note_node_id") references "content_nodes"("workspace_id","id") on delete set null
);
create table "literature_matrix_rows" (
 "id" uuid primary key default gen_random_uuid(),"workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "project_id" uuid references "thesis_projects"("id") on delete cascade,"reference_id" uuid not null references "references_library"("id") on delete cascade,
 "question" text,"method" text,"sample" text,"findings" text,"limitations" text,"relevance" text,
 "custom" jsonb not null default '{}'::jsonb,"updated_at" timestamptz not null default now(),
 unique ("project_id","reference_id")
);
