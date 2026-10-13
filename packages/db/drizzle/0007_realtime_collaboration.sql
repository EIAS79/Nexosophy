create table "collaboration_rooms" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "protocol" text not null default 'nexosophy-crdt-v1',
  "checkpoint" jsonb not null default '{"registers":{}}'::jsonb,
  "checkpoint_sequence" bigint not null default 0,
  "version" integer not null default 1,
  "updated_at" timestamptz not null default now(),
  constraint "collaboration_rooms_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade,
  constraint "collaboration_rooms_node_unique" unique ("workspace_id", "node_id")
);

create table "collaboration_updates" (
  "id" uuid primary key default gen_random_uuid(),
  "room_id" uuid not null references "collaboration_rooms"("id") on delete cascade,
  "sequence" bigint generated always as identity,
  "client_id" text not null,
  "client_clock" bigint not null check ("client_clock" >= 0),
  "update" jsonb not null,
  "update_hash" text not null,
  "created_at" timestamptz not null default now(),
  constraint "collaboration_updates_client_clock_unique"
    unique ("room_id", "client_id", "client_clock")
);
create index "collaboration_updates_room_sequence_idx"
  on "collaboration_updates" ("room_id", "sequence");

create table "collaboration_comments" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "node_id" uuid not null,
  "parent_comment_id" uuid references "collaboration_comments"("id") on delete cascade,
  "body" text not null check (char_length("body") between 1 and 10000),
  "anchor" jsonb not null default '{}'::jsonb,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "resolved_at" timestamptz,
  "resolved_by_user_id" uuid references "users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "collaboration_comments_node_fk"
    foreign key ("workspace_id", "node_id")
    references "content_nodes"("workspace_id", "id") on delete cascade
);
create index "collaboration_comments_node_idx"
  on "collaboration_comments" ("workspace_id", "node_id", "created_at", "id");

create table "collaboration_comment_mentions" (
  "comment_id" uuid not null references "collaboration_comments"("id") on delete cascade,
  "mentioned_user_id" uuid not null references "users"("id") on delete cascade,
  "created_at" timestamptz not null default now(),
  primary key ("comment_id", "mentioned_user_id")
);
create index "collaboration_comment_mentions_user_idx"
  on "collaboration_comment_mentions" ("mentioned_user_id", "created_at" desc);

create table "collaboration_room_members" (
  "room_id" uuid not null references "collaboration_rooms"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "last_seen_at" timestamptz not null default now(),
  "last_client_id" text,
  primary key ("room_id", "user_id")
);
