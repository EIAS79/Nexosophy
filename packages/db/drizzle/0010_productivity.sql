create type "task_status" as enum ('todo', 'in_progress', 'waiting', 'done', 'cancelled');
create type "task_priority" as enum ('none', 'low', 'medium', 'high', 'urgent');
create type "reminder_status" as enum ('active', 'completed', 'cancelled');
create type "calendar_exception_action" as enum ('cancelled', 'modified');
create type "notification_channel" as enum ('web', 'email', 'push');
create type "notification_delivery_status" as enum ('queued', 'processing', 'delivered', 'failed', 'suppressed');
create type "focus_session_status" as enum ('running', 'paused', 'completed', 'cancelled');

create table "task_projects" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "description" text not null default '',
  "color" text,
  "version" integer not null default 1,
  "archived_at" timestamptz,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "task_projects_name_check" check (char_length(trim("name")) between 1 and 160)
);
create index "task_projects_list_idx"
  on "task_projects" ("workspace_id", "archived_at", "updated_at" desc, "id" desc);

create table "tasks" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "project_id" uuid references "task_projects"("id") on delete set null,
  "parent_task_id" uuid references "tasks"("id") on delete cascade,
  "title" text not null,
  "description" text not null default '',
  "status" task_status not null default 'todo',
  "priority" task_priority not null default 'none',
  "start_at" timestamptz,
  "due_at" timestamptz,
  "recurrence_anchor_at" timestamptz,
  "timezone" text not null default 'UTC',
  "recurrence_rule" text,
  "assigned_user_id" uuid references "users"("id") on delete set null,
  "linked_node_id" uuid,
  "version" integer not null default 1,
  "completed_at" timestamptz,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "tasks_title_check" check (char_length(trim("title")) between 1 and 500),
  constraint "tasks_linked_node_fk"
    foreign key ("workspace_id", "linked_node_id")
    references "content_nodes"("workspace_id", "id") on delete set null
);
create index "tasks_workspace_due_idx"
  on "tasks" ("workspace_id", "status", "due_at", "priority", "id");
create index "tasks_project_idx"
  on "tasks" ("workspace_id", "project_id", "status", "updated_at" desc);
create index "tasks_parent_idx"
  on "tasks" ("workspace_id", "parent_task_id", "status", "id");

create table "task_dependencies" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "task_id" uuid not null references "tasks"("id") on delete cascade,
  "depends_on_task_id" uuid not null references "tasks"("id") on delete cascade,
  "created_at" timestamptz not null default now(),
  primary key ("workspace_id", "task_id", "depends_on_task_id"),
  constraint "task_dependencies_not_self" check ("task_id" <> "depends_on_task_id")
);

create table "task_tags" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "task_id" uuid not null references "tasks"("id") on delete cascade,
  "tag_id" uuid not null references "workspace_tags"("id") on delete cascade,
  "created_at" timestamptz not null default now(),
  primary key ("workspace_id", "task_id", "tag_id")
);

create table "task_occurrences" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "task_id" uuid not null references "tasks"("id") on delete cascade,
  "occurrence_at" timestamptz not null,
  "completed_at" timestamptz,
  "completed_by_user_id" uuid references "users"("id") on delete set null,
  "created_at" timestamptz not null default now(),
  unique ("task_id", "occurrence_at")
);

create table "focus_sessions" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "task_id" uuid references "tasks"("id") on delete set null,
  "status" focus_session_status not null default 'running',
  "started_at" timestamptz not null default now(),
  "paused_at" timestamptz,
  "ended_at" timestamptz,
  "accumulated_seconds" integer not null default 0 check ("accumulated_seconds" >= 0),
  "notes" text not null default '',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create index "focus_sessions_user_idx"
  on "focus_sessions" ("workspace_id", "user_id", "started_at" desc);

create table "calendar_events" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "title" text not null,
  "description" text not null default '',
  "starts_at" timestamptz not null,
  "ends_at" timestamptz not null,
  "all_day" boolean not null default false,
  "timezone" text not null default 'UTC',
  "recurrence_rule" text,
  "linked_node_id" uuid,
  "version" integer not null default 1,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "calendar_events_time_check" check ("ends_at" > "starts_at"),
  constraint "calendar_events_title_check" check (char_length(trim("title")) between 1 and 500),
  constraint "calendar_events_linked_node_fk"
    foreign key ("workspace_id", "linked_node_id")
    references "content_nodes"("workspace_id", "id") on delete set null
);
create index "calendar_events_range_idx"
  on "calendar_events" ("workspace_id", "starts_at", "ends_at", "id");

create table "calendar_event_exceptions" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "series_id" uuid not null references "calendar_events"("id") on delete cascade,
  "original_start_at" timestamptz not null,
  "action" calendar_exception_action not null,
  "overrides" jsonb not null default '{}'::jsonb,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("series_id", "original_start_at")
);

create table "reminders" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "task_id" uuid references "tasks"("id") on delete cascade,
  "event_id" uuid references "calendar_events"("id") on delete cascade,
  "linked_node_id" uuid,
  "title" text not null,
  "message" text not null default '',
  "next_occurrence_at" timestamptz not null,
  "recurrence_anchor_at" timestamptz not null,
  "timezone" text not null default 'UTC',
  "recurrence_rule" text,
  "status" reminder_status not null default 'active',
  "snoozed_until" timestamptz,
  "last_fired_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "reminders_title_check" check (char_length(trim("title")) between 1 and 500),
  constraint "reminders_linked_node_fk"
    foreign key ("workspace_id", "linked_node_id")
    references "content_nodes"("workspace_id", "id") on delete set null
);
create index "reminders_due_idx"
  on "reminders" ("status", "next_occurrence_at", "id")
  where "status" = 'active';

create table "reminder_occurrences" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "reminder_id" uuid not null references "reminders"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "occurrence_at" timestamptz not null,
  "notification_id" uuid,
  "created_at" timestamptz not null default now(),
  unique ("reminder_id", "occurrence_at")
);

create table "notifications" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "category" text not null,
  "title" text not null,
  "body" text not null default '',
  "action_url" text,
  "source_type" text,
  "source_id" text,
  "dedupe_key" text not null,
  "read_at" timestamptz,
  "created_at" timestamptz not null default now(),
  unique ("workspace_id", "user_id", "dedupe_key")
);
create index "notifications_inbox_idx"
  on "notifications" ("workspace_id", "user_id", "read_at", "created_at" desc, "id" desc);

alter table "reminder_occurrences"
  add constraint "reminder_occurrences_notification_fk"
  foreign key ("notification_id") references "notifications"("id") on delete set null;

create table "notification_preferences" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "web_enabled" boolean not null default true,
  "email_enabled" boolean not null default false,
  "push_enabled" boolean not null default false,
  "digest_mode" text not null default 'immediate'
    check ("digest_mode" in ('immediate','hourly','daily')),
  "quiet_start" time,
  "quiet_end" time,
  "timezone" text not null default 'UTC',
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id", "user_id")
);

create table "notification_subscriptions" (
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "source_type" text not null,
  "source_id" text not null,
  "muted" boolean not null default false,
  "updated_at" timestamptz not null default now(),
  primary key ("workspace_id", "user_id", "source_type", "source_id")
);

create table "notification_deliveries" (
  "id" uuid primary key default gen_random_uuid(),
  "notification_id" uuid not null references "notifications"("id") on delete cascade,
  "channel" notification_channel not null,
  "status" notification_delivery_status not null default 'queued',
  "attempts" integer not null default 0,
  "run_after" timestamptz not null default now(),
  "locked_at" timestamptz,
  "locked_by" text,
  "last_error" text,
  "delivered_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("notification_id", "channel")
);
create index "notification_deliveries_claim_idx"
  on "notification_deliveries" ("status", "run_after", "created_at", "id")
  where "status" in ('queued','processing');
