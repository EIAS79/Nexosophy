import type {
  WorkspaceMemberStatus,
  WorkspacePermission,
  WorkspaceRole,
  WorkspaceSummary,
  WorkspaceType,
} from "@nexosophy/contracts";
import type { Pool } from "pg";

import {
  appendWorkspaceAudit,
  withWorkspaceTransaction,
} from "./workspace-store-common.js";

function workspaceSlug(name: string, suffix: string): string {
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";
  return `${base}-${suffix.replaceAll("-", "").slice(0, 10)}`;
}

export async function ensurePersonalWorkspace(
  pool: Pool,
  userId: string,
  displayName?: string | null,
): Promise<string> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `personal-workspace:${userId}`,
    ]);
    const existing = await client.query<{ id: string }>(
      `select "id" from "workspaces"
       where "owner_user_id" = $1 and "type" = 'personal' and "archived_at" is null
       limit 1`,
      [userId],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const idResult = await client.query<{ id: string }>("select gen_random_uuid() as id");
    const workspaceId = idResult.rows[0]?.id;
    if (!workspaceId) throw new Error("Unable to allocate personal workspace ID");
    const name = displayName?.trim() ? `${displayName.trim()}'s workspace` : "Personal workspace";

    await client.query(
      `insert into "workspaces" ("id", "type", "owner_user_id", "name", "slug")
       values ($1, 'personal', $2, $3, $4)`,
      [workspaceId, userId, name.slice(0, 120), workspaceSlug("personal", workspaceId)],
    );
    await client.query(
      `insert into "workspace_members" ("workspace_id", "user_id", "role", "status")
       values ($1, $2, 'owner', 'active')`,
      [workspaceId, userId],
    );
    return workspaceId;
  });
}

export async function listUserWorkspaces(
  pool: Pool,
  userId: string,
): Promise<WorkspaceSummary[]> {
  const result = await pool.query<{
    id: string;
    type: WorkspaceType;
    name: string;
    slug: string;
    role: WorkspaceRole;
    status: WorkspaceMemberStatus;
    permission_version: number;
    version: number;
    archived_at: Date | null;
  }>(
    `select w."id", w."type", w."name", w."slug", m."role", m."status",
            w."permission_version", w."version", w."archived_at"
     from "workspace_members" m
     join "workspaces" w on w."id" = m."workspace_id"
     where m."user_id" = $1 and m."status" = 'active' and w."archived_at" is null
     order by case when w."type" = 'personal' then 0 else 1 end, w."created_at", w."id"`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    slug: row.slug,
    role: row.role,
    memberStatus: row.status,
    permissionVersion: row.permission_version,
    version: row.version,
    archivedAt: row.archived_at,
  }));
}

export async function createWorkspace(
  pool: Pool,
  input: {
    userId: string;
    name: string;
    type: Exclude<WorkspaceType, "personal">;
    requestId?: string | undefined;
  },
): Promise<WorkspaceSummary> {
  return withWorkspaceTransaction(pool, async (client) => {
    const idResult = await client.query<{ id: string }>("select gen_random_uuid() as id");
    const id = idResult.rows[0]?.id;
    if (!id) throw new Error("Unable to allocate workspace ID");
    const slug = workspaceSlug(input.name, id);
    await client.query(
      `insert into "workspaces" ("id", "type", "owner_user_id", "name", "slug")
       values ($1, $2, $3, $4, $5)`,
      [id, input.type, input.userId, input.name.trim(), slug],
    );
    await client.query(
      `insert into "workspace_members" ("workspace_id", "user_id", "role", "status")
       values ($1, $2, 'owner', 'active')`,
      [id, input.userId],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: id,
      actorUserId: input.userId,
      action: "workspace.created",
      targetType: "workspace",
      targetId: id,
      requestId: input.requestId,
      metadata: { type: input.type },
    });
    return {
      id,
      type: input.type,
      name: input.name.trim(),
      slug,
      role: "owner",
      memberStatus: "active",
      permissionVersion: 1,
      version: 1,
      archivedAt: null,
    };
  });
}

export type WorkspaceAuthorization = {
  workspaceId: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  permissionVersion: number;
  customPermissions: WorkspacePermission[];
  archivedAt: Date | null;
};

export async function getWorkspaceAuthorization(
  pool: Pool,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceAuthorization | null> {
  const result = await pool.query<{
    workspace_id: string;
    role: WorkspaceRole;
    status: WorkspaceMemberStatus;
    permission_version: number;
    archived_at: Date | null;
    custom_permissions: string[] | null;
  }>(
    `select m."workspace_id", m."role", m."status", w."permission_version", w."archived_at",
            coalesce(array_agg(rp."permission") filter (where rp."permission" is not null), '{}') as "custom_permissions"
     from "workspace_members" m
     join "workspaces" w on w."id" = m."workspace_id"
     left join "workspace_role_permissions" rp on rp."role_id" = m."custom_role_id"
     where m."workspace_id" = $1 and m."user_id" = $2
     group by m."workspace_id", m."role", m."status", w."permission_version", w."archived_at"
     limit 1`,
    [workspaceId, userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    workspaceId: row.workspace_id,
    role: row.role,
    status: row.status,
    permissionVersion: row.permission_version,
    customPermissions: (row.custom_permissions ?? []) as WorkspacePermission[],
    archivedAt: row.archived_at,
  };
}

export async function updateWorkspace(
  pool: Pool,
  workspaceId: string,
  expectedVersion: number,
  patch: { name?: string | undefined },
): Promise<WorkspaceSummary | null> {
  const result = await pool.query<{
    id: string; type: WorkspaceType; name: string; slug: string;
    permission_version: number; version: number; archived_at: Date | null;
  }>(
    `update "workspaces"
     set "name" = case when $3 then $4 else "name" end,
         "version" = "version" + 1,
         "updated_at" = now()
     where "id" = $1 and "version" = $2 and "archived_at" is null
     returning "id", "type", "name", "slug", "permission_version", "version", "archived_at"`,
    [workspaceId, expectedVersion, patch.name !== undefined, patch.name ?? ""],
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.id, type: row.type, name: row.name, slug: row.slug,
        role: "owner", memberStatus: "active",
        permissionVersion: row.permission_version, version: row.version, archivedAt: row.archived_at,
      }
    : null;
}

export async function archiveWorkspace(pool: Pool, workspaceId: string): Promise<boolean> {
  const result = await pool.query(
    `update "workspaces"
     set "archived_at" = now(), "version" = "version" + 1, "updated_at" = now()
     where "id" = $1 and "type" <> 'personal' and "archived_at" is null`,
    [workspaceId],
  );
  if ((result.rowCount ?? 0) === 0) {
    const type = await pool.query<{ type: WorkspaceType }>(
      `select "type" from "workspaces" where "id" = $1`,
      [workspaceId],
    );
    if (type.rows[0]?.type === "personal") throw new Error("Personal workspaces cannot be archived");
  }
  return (result.rowCount ?? 0) === 1;
}

export async function appendWorkspaceAuditEvent(
  pool: Pool,
  input: Parameters<typeof appendWorkspaceAudit>[1],
): Promise<void> {
  await appendWorkspaceAudit(pool, input);
}

export async function listWorkspaceAuditEvents(pool: Pool, workspaceId: string, limit = 100) {
  const result = await pool.query(
    `select "id", "actor_user_id", "action", "target_type", "target_id",
            "request_id", "metadata", "created_at"
     from "workspace_audit_events"
     where "workspace_id" = $1
     order by "created_at" desc, "id" desc
     limit $2`,
    [workspaceId, Math.min(Math.max(limit, 1), 200)],
  );
  return result.rows;
}
