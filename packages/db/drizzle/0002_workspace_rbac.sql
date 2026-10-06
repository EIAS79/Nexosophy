create type "workspace_type" as enum ('personal', 'team', 'research', 'lab', 'class', 'institution');
create type "workspace_role" as enum ('owner', 'admin', 'member', 'viewer', 'guest');
create type "workspace_member_status" as enum ('active', 'suspended');
create type "workspace_invitation_status" as enum ('pending', 'accepted', 'revoked', 'expired');
create type "ownership_transfer_status" as enum ('pending', 'accepted', 'cancelled', 'expired');

create table "workspaces" (
  "id" uuid primary key default gen_random_uuid(),
  "type" workspace_type not null,
  "owner_user_id" uuid not null references "users"("id") on delete restrict,
  "name" text not null,
  "slug" text not null,
  "version" integer not null default 1,
  "permission_version" integer not null default 1,
  "archived_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "workspaces_name_check" check (char_length(trim("name")) between 1 and 120),
  constraint "workspaces_slug_check" check ("slug" ~ '^[a-z0-9][a-z0-9-]{0,62}$')
);

create unique index "workspaces_owner_personal_uidx"
  on "workspaces" ("owner_user_id")
  where "type" = 'personal' and "archived_at" is null;
create unique index "workspaces_slug_uidx" on "workspaces" ("slug") where "archived_at" is null;
create index "workspaces_owner_idx" on "workspaces" ("owner_user_id", "created_at");

create table "workspace_roles" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "name" text not null,
  "description" text,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("workspace_id", "name")
);

create table "workspace_role_permissions" (
  "role_id" uuid not null references "workspace_roles"("id") on delete cascade,
  "permission" text not null,
  primary key ("role_id", "permission")
);

create table "workspace_members" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "user_id" uuid not null references "users"("id") on delete cascade,
  "role" workspace_role not null,
  "status" workspace_member_status not null default 'active',
  "custom_role_id" uuid references "workspace_roles"("id") on delete set null,
  "version" integer not null default 1,
  "joined_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique ("workspace_id", "user_id")
);
create index "workspace_members_user_idx" on "workspace_members" ("user_id", "status", "workspace_id");
create index "workspace_members_workspace_idx" on "workspace_members" ("workspace_id", "status", "role");

create table "workspace_invitations" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "email" text not null,
  "role" workspace_role not null,
  "token_hash" text not null unique,
  "status" workspace_invitation_status not null default 'pending',
  "invited_by_user_id" uuid not null references "users"("id") on delete restrict,
  "accepted_by_user_id" uuid references "users"("id") on delete set null,
  "expires_at" timestamptz not null,
  "accepted_at" timestamptz,
  "revoked_at" timestamptz,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint "workspace_invitation_email_check" check (char_length(trim("email")) between 3 and 320)
);
create index "workspace_invitations_workspace_idx"
  on "workspace_invitations" ("workspace_id", "status", "created_at" desc);
create index "workspace_invitations_email_idx"
  on "workspace_invitations" (lower("email"), "status", "expires_at");

create table "resource_grants" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "principal_user_id" uuid not null references "users"("id") on delete cascade,
  "resource_type" text not null,
  "resource_id" text not null,
  "permission" text not null,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "created_at" timestamptz not null default now(),
  unique ("workspace_id", "principal_user_id", "resource_type", "resource_id", "permission")
);
create index "resource_grants_lookup_idx"
  on "resource_grants" ("workspace_id", "resource_type", "resource_id");

create table "workspace_share_links" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "resource_type" text not null,
  "resource_id" text not null,
  "token_hash" text not null unique,
  "password_salt" text,
  "password_hash" text,
  "allow_download" boolean not null default false,
  "expires_at" timestamptz,
  "revoked_at" timestamptz,
  "created_by_user_id" uuid not null references "users"("id") on delete restrict,
  "access_count" bigint not null default 0,
  "last_accessed_at" timestamptz,
  "created_at" timestamptz not null default now(),
  constraint "workspace_share_password_pair_check" check (
    ("password_salt" is null and "password_hash" is null)
    or ("password_salt" is not null and "password_hash" is not null)
  )
);
create index "workspace_share_links_resource_idx"
  on "workspace_share_links" ("workspace_id", "resource_type", "resource_id", "revoked_at");

create table "workspace_ownership_transfers" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "from_user_id" uuid not null references "users"("id") on delete restrict,
  "to_user_id" uuid not null references "users"("id") on delete restrict,
  "token_hash" text not null unique,
  "status" ownership_transfer_status not null default 'pending',
  "expires_at" timestamptz not null,
  "accepted_at" timestamptz,
  "created_at" timestamptz not null default now()
);
create unique index "workspace_ownership_transfer_pending_uidx"
  on "workspace_ownership_transfers" ("workspace_id")
  where "status" = 'pending';

create table "workspace_audit_events" (
  "id" uuid primary key default gen_random_uuid(),
  "workspace_id" uuid not null references "workspaces"("id") on delete cascade,
  "actor_user_id" uuid references "users"("id") on delete set null,
  "action" text not null,
  "target_type" text not null,
  "target_id" text,
  "request_id" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "created_at" timestamptz not null default now()
);
create index "workspace_audit_events_workspace_idx"
  on "workspace_audit_events" ("workspace_id", "created_at" desc, "id" desc);

with inserted as (
  insert into "workspaces" ("type", "owner_user_id", "name", "slug")
  select
    'personal'::workspace_type,
    u."id",
    case when nullif(trim(p."display_name"), '') is null then 'Personal workspace'
         else left(trim(p."display_name") || '''s workspace', 120) end,
    'personal-' || replace(u."id"::text, '-', '')
  from "users" u
  left join "user_profiles" p on p."user_id" = u."id"
  where not exists (
    select 1 from "workspaces" w
    where w."owner_user_id" = u."id" and w."type" = 'personal' and w."archived_at" is null
  )
  returning "id", "owner_user_id"
)
insert into "workspace_members" ("workspace_id", "user_id", "role")
select "id", "owner_user_id", 'owner'::workspace_role from inserted;
