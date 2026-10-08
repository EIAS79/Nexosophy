create type "content_relation_type" as enum (
  'related',
  'references',
  'supports',
  'depends_on',
  'contradicts',
  'duplicates',
  'derived_from'
);

create table "workspace_tags" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "normalized_name" text generated always as (lower(trim("name"))) stored,
  "color" text,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "workspace_tags_name_check" check (char_length(trim("name")) between 1 and 80),
  constraint "workspace_tags_unique_name" unique ("workspace_id", "normalized_name")
);
create index "workspace_tags_list_idx"
  on "workspace_tags" ("workspace_id", "normalized_name", "id");

create table "content_node_tags" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "tag_id" uuid not null references "workspace_tags"("id") on delete cascade,
  "assigned_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  primary key ("workspace_id", "node_id", "tag_id"),
  constraint "content_node_tags_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade
);
create index "content_node_tags_tag_idx"
  on "content_node_tags" ("workspace_id", "tag_id", "node_id");

create table "content_relations" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "from_node_id" uuid not null,
  "to_node_id" uuid not null,
  "relation_type" content_relation_type not null default 'related',
  "label" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "content_relations_from_fk"
    foreign key ("workspace_id", "from_node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade,
  constraint "content_relations_to_fk"
    foreign key ("workspace_id", "to_node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade,
  constraint "content_relations_not_self" check ("from_node_id" <> "to_node_id"),
  constraint "content_relations_unique"
    unique ("workspace_id", "from_node_id", "to_node_id", "relation_type")
);
create index "content_relations_backlink_idx"
  on "content_relations" ("workspace_id", "to_node_id", "relation_type", "from_node_id");
create index "content_relations_forward_idx"
  on "content_relations" ("workspace_id", "from_node_id", "relation_type", "to_node_id");

create table "saved_searches" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "owner_user_id" uuid not null references "users"("id") on delete cascade,
  "name" text not null,
  "query" jsonb not null,
  "shared" boolean not null default false,
  "version" integer not null default 1,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "saved_searches_name_check" check (char_length(trim("name")) between 1 and 120)
);
create index "saved_searches_list_idx"
  on "saved_searches" ("workspace_id", "owner_user_id", "updated_at" desc, "id" desc);

create table "search_query_history" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "query_hash" text not null,
  "query_text" text not null,
  "filters" jsonb not null default '{}'::jsonb,
  "use_count" integer not null default 1,
  "last_used_at" timestamptz not null default now(),
  primary key ("workspace_id", "user_id", "query_hash")
);
create index "search_query_history_recent_idx"
  on "search_query_history" ("workspace_id", "user_id", "last_used_at" desc);

create table "search_documents" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "kind" content_node_kind not null,
  "title" text not null,
  "path_text" text not null default '',
  "content_text" text not null default '',
  "metadata_text" text not null default '',
  "owner_user_id" uuid not null references "users"("id") on delete restrict,
  "source_updated_at" timestamptz not null,
  "indexed_at" timestamptz not null default now(),
  "search_vector" tsvector generated always as (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("path_text", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("content_text", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("metadata_text", '')), 'C')
  ) stored,
  primary key ("workspace_id", "node_id"),
  constraint "search_documents_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade
);
create index "search_documents_vector_idx" on "search_documents" using gin ("search_vector");
create index "search_documents_facets_idx"
  on "search_documents" ("workspace_id", "kind", "owner_user_id", "source_updated_at" desc, "node_id");

create table "search_index_state" (
  "workspace_id" uuid primary key references "workspaces"("id") on delete cascade,
  "last_reconciled_at" timestamptz,
  "last_backfill_started_at" timestamptz,
  "last_backfill_completed_at" timestamptz,
  "last_error" text,
  "indexed_nodes" bigint not null default 0,
  "lagging_nodes" bigint not null default 0,
  "updated_at" timestamptz not null default now()
);
