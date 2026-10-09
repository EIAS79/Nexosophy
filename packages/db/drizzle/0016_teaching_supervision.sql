create type "teaching_member_role" as enum ('instructor','assistant','student','supervisee');
create type "teaching_release_state" as enum ('draft','scheduled','released','withdrawn');
create type "teaching_review_state" as enum ('draft','submitted','released');
create type "supervision_status" as enum ('active','paused','completed','ended');
create type "milestone_status" as enum ('planned','in_progress','submitted','approved','blocked');

create table "teaching_courses"(
 "course_id" uuid primary key references "academic_courses"("id") on delete cascade,
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "owner_user_id" uuid not null references "users"("id") on delete restrict,
 "resource_policy" jsonb not null default '{"defaultVisibility":"members"}'::jsonb,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create table "teaching_course_members"(
 "course_id" uuid not null references "teaching_courses"("course_id") on delete cascade,
 "user_id" uuid not null references "users"("id") on delete cascade,
 "role" teaching_member_role not null,
 "active" boolean not null default true,
 "added_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"revoked_at" timestamptz,
 primary key("course_id","user_id")
);
create index "teaching_members_user_idx" on "teaching_course_members"("user_id","active","course_id");

create table "teaching_resources"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "course_id" uuid not null references "teaching_courses"("course_id") on delete cascade,
 "node_id" uuid not null,
 "title" text not null,
 "state" teaching_release_state not null default 'draft',
 "release_at" timestamptz,"withdrawn_at" timestamptz,
 "audience" jsonb not null default '{"roles":["student","supervisee"]}'::jsonb,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique("course_id","node_id"),
 foreign key("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create index "teaching_resources_release_idx" on "teaching_resources"("workspace_id","course_id","state","release_at");

create table "teaching_assignment_feedback"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "assignment_id" uuid not null references "assignments"("id") on delete cascade,
 "student_user_id" uuid not null references "users"("id") on delete cascade,
 "reviewer_user_id" uuid not null references "users"("id") on delete restrict,
 "state" teaching_review_state not null default 'draft',
 "feedback" text not null default '',
 "rubric_result" jsonb not null default '{}'::jsonb,
 "score" numeric(12,4),"max_score" numeric(12,4),
 "version" integer not null default 1,
 "submitted_at" timestamptz,"released_at" timestamptz,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique("assignment_id","student_user_id")
);
create index "teaching_feedback_student_idx" on "teaching_assignment_feedback"("workspace_id","student_user_id","state","updated_at" desc);

create table "supervision_relationships"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "supervisor_user_id" uuid not null references "users"("id") on delete restrict,
 "supervisee_user_id" uuid not null references "users"("id") on delete restrict,
 "title" text not null,
 "status" supervision_status not null default 'active',
 "root_node_id" uuid,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),"ended_at" timestamptz,
 unique("workspace_id","supervisor_user_id","supervisee_user_id","title"),
 foreign key("workspace_id","root_node_id") references "content_nodes"("workspace_id","id") on delete set null ("root_node_id")
);
create index "supervision_party_idx" on "supervision_relationships"("workspace_id","supervisor_user_id","supervisee_user_id","status");

create table "supervision_milestones"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "relationship_id" uuid not null references "supervision_relationships"("id") on delete cascade,
 "title" text not null,"description" text not null default '',
 "status" milestone_status not null default 'planned',
 "due_at" timestamptz,"linked_node_id" uuid,"version" integer not null default 1,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 foreign key("workspace_id","linked_node_id") references "content_nodes"("workspace_id","id") on delete set null ("linked_node_id")
);
create table "supervision_meetings"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "relationship_id" uuid not null references "supervision_relationships"("id") on delete cascade,
 "calendar_event_id" uuid references "calendar_events"("id") on delete set null,
 "note_node_id" uuid,
 "title" text not null,"occurred_at" timestamptz not null,
 "private_supervisor_note" text not null default '',
 "shared_summary" text not null default '',
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),
 foreign key("workspace_id","note_node_id") references "content_nodes"("workspace_id","id") on delete set null ("note_node_id")
);
create table "office_hour_windows"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "instructor_user_id" uuid not null references "users"("id") on delete cascade,
 "course_id" uuid references "teaching_courses"("course_id") on delete cascade,
 "starts_at" timestamptz not null,"ends_at" timestamptz not null,"timezone" text not null default 'UTC',
 "location" text,"meeting_url" text,"capacity" integer not null default 1 check("capacity">0),
 "created_at" timestamptz not null default now(),
 check("ends_at">"starts_at")
);
create table "office_hour_bookings"(
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "window_id" uuid not null references "office_hour_windows"("id") on delete cascade,
 "student_user_id" uuid not null references "users"("id") on delete cascade,
 "calendar_event_id" uuid references "calendar_events"("id") on delete set null,
 "note" text not null default '',
 "status" text not null default 'booked' check("status" in('booked','cancelled','completed')),
 "created_at" timestamptz not null default now(),
 unique("window_id","student_user_id")
);