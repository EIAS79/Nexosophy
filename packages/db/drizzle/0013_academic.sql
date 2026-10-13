create type "course_section_kind" as enum ('lecture','lab','tutorial','seminar','other');
create type "academic_link_type" as enum ('note','resource','formula','syllabus','other');
create type "assignment_status" as enum ('planned','in_progress','submitted','graded','cancelled');
create type "flashcard_type" as enum ('basic','reverse','cloze','image');
create type "flashcard_grade" as enum ('again','hard','good','easy');

create table "academic_terms" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "name" text not null,"code" text,"starts_on" date not null,"ends_on" date not null,
 "archived_at" timestamptz,"version" integer not null default 1,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 constraint "academic_terms_dates" check ("ends_on">="starts_on")
);
create index "academic_terms_workspace_idx" on "academic_terms" ("workspace_id","starts_on" desc,"id");

create table "academic_courses" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "term_id" uuid not null references "academic_terms"("id") on delete restrict,
 "code" text,"name" text not null,"description" text not null default '',
 "credits" numeric(6,2),"color" text,"instructor" jsonb not null default '{}'::jsonb,
 "resource_node_id" uuid,"syllabus_node_id" uuid,"version" integer not null default 1,
 "archived_at" timestamptz,
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "updated_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 foreign key ("workspace_id","resource_node_id") references "content_nodes"("workspace_id","id") on delete set null,
 foreign key ("workspace_id","syllabus_node_id") references "content_nodes"("workspace_id","id") on delete set null
);
create index "academic_courses_term_idx" on "academic_courses" ("workspace_id","term_id","archived_at","name");

create table "course_sections" (
 "id" uuid primary key default gen_random_uuid(),
 "course_id" uuid not null references "academic_courses"("id") on delete cascade,
 "kind" course_section_kind not null,"name" text not null,"metadata" jsonb not null default '{}'::jsonb,
 "created_at" timestamptz not null default now()
);
create table "course_links" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "course_id" uuid not null references "academic_courses"("id") on delete cascade,
 "node_id" uuid not null,"link_type" academic_link_type not null,"pinned" boolean not null default false,
 "created_at" timestamptz not null default now(),
 unique ("course_id","node_id","link_type"),
 foreign key ("workspace_id","node_id") references "content_nodes"("workspace_id","id") on delete cascade
);
create table "course_meetings" (
 "id" uuid primary key default gen_random_uuid(),
 "course_id" uuid not null references "academic_courses"("id") on delete cascade,
 "section_id" uuid references "course_sections"("id") on delete set null,
 "calendar_event_id" uuid not null references "calendar_events"("id") on delete cascade,
 "created_at" timestamptz not null default now()
);
create table "grade_items" (
 "id" uuid primary key default gen_random_uuid(),
 "course_id" uuid not null references "academic_courses"("id") on delete cascade,
 "name" text not null,"weight" numeric(7,4),"score" numeric(12,4),"max_score" numeric(12,4),
 "metadata" jsonb not null default '{}'::jsonb,"created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 constraint "grade_weight_range" check ("weight" is null or ("weight">=0 and "weight"<=1))
);
create table "assignments" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "course_id" uuid not null references "academic_courses"("id") on delete cascade,
 "task_id" uuid not null references "tasks"("id") on delete cascade,
 "status" assignment_status not null default 'planned',"weight" numeric(7,4),
 "points_possible" numeric(12,4),"rubric" jsonb not null default '{}'::jsonb,
 "submission" jsonb not null default '{}'::jsonb,"version" integer not null default 1,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 unique ("task_id")
);
create index "assignments_course_idx" on "assignments" ("workspace_id","course_id","status","id");
create table "exams" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "course_id" uuid not null references "academic_courses"("id") on delete cascade,
 "calendar_event_id" uuid not null references "calendar_events"("id") on delete cascade,
 "revision_task_id" uuid references "tasks"("id") on delete set null,
 "title" text not null,"format" text,"weight" numeric(7,4),"topics" jsonb not null default '[]'::jsonb,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now()
);
create index "exams_course_idx" on "exams" ("workspace_id","course_id","id");

create table "study_plans" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "course_id" uuid references "academic_courses"("id") on delete cascade,
 "exam_id" uuid references "exams"("id") on delete cascade,
 "title" text not null,"starts_on" date,"ends_on" date,"created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now()
);
create table "study_plan_topics" (
 "id" uuid primary key default gen_random_uuid(),
 "plan_id" uuid not null references "study_plans"("id") on delete cascade,
 "title" text not null,"progress" numeric(5,4) not null default 0,
 "linked_node_id" uuid,"created_at" timestamptz not null default now(),
 constraint "study_topic_progress" check ("progress" between 0 and 1)
);
create table "study_sessions" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "plan_id" uuid references "study_plans"("id") on delete set null,
 "course_id" uuid references "academic_courses"("id") on delete set null,
 "focus_session_id" uuid not null references "focus_sessions"("id") on delete cascade,
 "created_at" timestamptz not null default now(),
 unique ("focus_session_id")
);

create table "flashcard_decks" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "course_id" uuid references "academic_courses"("id") on delete set null,
 "parent_deck_id" uuid references "flashcard_decks"("id") on delete cascade,
 "name" text not null,"source_node_id" uuid,"algorithm_version" text not null default 'sm2-v1',
 "created_by_user_id" uuid not null references "users"("id") on delete restrict,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 foreign key ("workspace_id","source_node_id") references "content_nodes"("workspace_id","id") on delete set null
);
create table "flashcards" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "deck_id" uuid not null references "flashcard_decks"("id") on delete cascade,
 "type" flashcard_type not null,"front" text not null default '',"back" text not null default '',
 "cloze" text,"image_asset_id" uuid references "assets"("id") on delete set null,
 "source_node_id" uuid,"tags" jsonb not null default '[]'::jsonb,
 "due_at" timestamptz not null default now(),"interval_days" numeric(10,2) not null default 0,
 "ease_factor" numeric(6,3) not null default 2.5,"repetitions" integer not null default 0,
 "lapses" integer not null default 0,"leeched" boolean not null default false,"version" integer not null default 1,
 "created_at" timestamptz not null default now(),"updated_at" timestamptz not null default now(),
 foreign key ("workspace_id","source_node_id") references "content_nodes"("workspace_id","id") on delete set null
);
create index "flashcards_due_idx" on "flashcards" ("workspace_id","deck_id","due_at","id");
create table "flashcard_reviews" (
 "id" uuid primary key default gen_random_uuid(),
 "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
 "card_id" uuid not null references "flashcards"("id") on delete cascade,
 "grade" flashcard_grade not null,"algorithm_version" text not null,
 "before_state" jsonb not null,"after_state" jsonb not null,
 "reviewed_by_user_id" uuid not null references "users"("id") on delete restrict,
 "reviewed_at" timestamptz not null default now()
);
create index "flashcard_reviews_card_idx" on "flashcard_reviews" ("card_id","reviewed_at" desc);

with category as (
 select "id" from "template_categories" where "workspace_id" is null and "slug"='teaching' limit 1
), inserted as (
 insert into "templates" ("scope","category_id","name","description","status","current_version","role_suggestions","published_at")
 select 'system',category."id",'Student Course Starter','Course folder with syllabus, lecture notes and revision pages.','published',1,'["student"]'::jsonb,now() from category
 returning "id"
)
insert into "template_versions" ("template_id","version","snapshot")
select "id",1,'{"format":"nexosophy-archive","version":1,"exportedAt":"2026-10-09T00:00:00.000Z","source":{"scope":"template","sourceNodeId":null},"fidelity":"portable_archive","redactions":[],"nodes":[{"id":"course-root","parentId":null,"kind":"folder","name":"{{courseName}}","metadata":{"academicTemplate":true},"richDocument":null,"spatialDocument":null,"spatialElements":[],"tags":[]},{"id":"syllabus","parentId":"course-root","kind":"document","name":"Syllabus","metadata":{},"richDocument":{"type":"doc","blocks":[{"id":"intro","type":"heading","level":2,"text":"{{courseName}} syllabus"}]},"spatialDocument":null,"spatialElements":[],"tags":[]},{"id":"notes","parentId":"course-root","kind":"notebook","name":"Lecture notes","metadata":{},"richDocument":null,"spatialDocument":null,"spatialElements":[],"tags":[]},{"id":"revision","parentId":"course-root","kind":"document","name":"Revision plan","metadata":{},"richDocument":{"type":"doc","blocks":[{"id":"rev","type":"paragraph","text":"Revision plan for {{courseName}}"}]},"spatialDocument":null,"spatialElements":[],"tags":[]}],"relations":[]}'::jsonb
from inserted;
