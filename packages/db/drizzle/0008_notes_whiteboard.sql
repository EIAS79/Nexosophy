create type "spatial_page_mode" as enum ('infinite', 'vertical', 'fixed');
create type "spatial_background_kind" as enum ('plain', 'ruled', 'grid', 'dot');
create type "spatial_element_type" as enum (
  'text_region',
  'ink_stroke',
  'highlighter_stroke',
  'shape',
  'sticky',
  'connector',
  'frame',
  'image',
  'audio_anchor',
  'file_attachment',
  'link_card',
  'embed',
  'group'
);

create table "spatial_documents" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "page_mode" spatial_page_mode not null default 'infinite',
  "background_kind" spatial_background_kind not null default 'plain',
  "paper_size" text not null default 'A4',
  "orientation" text not null default 'portrait'
    check ("orientation" in ('portrait','landscape')),
  "settings" jsonb not null default '{"snap":true,"backgroundSpacing":24}'::jsonb,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id", "node_id"),
  constraint "spatial_documents_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade
);

create table "spatial_elements" (
  "id" uuid primary key,
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "type" spatial_element_type not null,
  "x" double precision not null default 0,
  "y" double precision not null default 0,
  "width" double precision not null default 200 check ("width" > 0),
  "height" double precision not null default 120 check ("height" > 0),
  "rotation" double precision not null default 0,
  "z_rank" bigint not null default 0,
  "group_id" uuid,
  "locked" boolean not null default false,
  "payload" jsonb not null default '{}'::jsonb,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "spatial_elements_document_fk"
    foreign key ("workspace_id", "node_id")
    references "spatial_documents"("workspace_id", "node_id") on delete cascade,
  constraint "spatial_elements_group_not_self" check ("group_id" is null or "group_id" <> "id")
);
create index "spatial_elements_view_idx"
  on "spatial_elements" ("workspace_id", "node_id", "z_rank", "id");
create index "spatial_elements_group_idx"
  on "spatial_elements" ("workspace_id", "node_id", "group_id")
  where "group_id" is not null;

create table "spatial_viewports" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "device_key" text not null default 'default',
  "origin_x" double precision not null default 0,
  "origin_y" double precision not null default 0,
  "zoom" double precision not null default 1 check ("zoom" between 0.05 and 20),
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id", "node_id", "user_id", "device_key"),
  constraint "spatial_viewports_document_fk"
    foreign key ("workspace_id", "node_id")
    references "spatial_documents"("workspace_id", "node_id") on delete cascade
);

create table "note_node_order" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "parent_node_id" uuid not null,
  "node_id" uuid not null,
  "rank" bigint not null default 1024,
  "color" text,
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id", "node_id"),
  constraint "note_node_order_parent_fk"
    foreign key ("workspace_id", "parent_node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade,
  constraint "note_node_order_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade
);
create index "note_node_order_list_idx"
  on "note_node_order" ("workspace_id", "parent_node_id", "rank", "node_id");
