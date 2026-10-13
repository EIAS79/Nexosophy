import { randomBytes } from "node:crypto";

import type { WorkspacePermission } from "./workspace-types.js";
import type { Pool } from "pg";

import {
  bumpWorkspacePermissionVersion,
  hashWorkspacePassword,
  hashWorkspaceToken,
  newWorkspaceToken,
  verifyWorkspacePassword,
  withWorkspaceTransaction,
  type Queryable,
} from "./workspace-store-common.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Only explicitly verified workspace resources may be shared. Never trust a
// caller-supplied resource ID merely because the caller owns the workspace.
async function checkSharedResource(
  db: Queryable,
  workspaceId: string,
  resourceType: string,
  resourceId: string,
) {
  if (!["workspace", "node"].includes(resourceType) || !uuidPattern.test(resourceId))
    throw new Error("RESOURCE_SCOPE_NOT_FOUND");
  const row = await db.query(
    `select 1 from "workspaces" w
     where w."id"=$1::uuid and w."archived_at" is null
     and (($2='workspace' and w."id"=$3::uuid)
       or ($2='node' and exists (
         select 1 from "content_nodes" n where n."id"=$3::uuid
         and n."workspace_id"=w."id" and n."trashed_at" is null
       )))`,
    [workspaceId, resourceType, resourceId],
  );
  if (!row.rowCount) throw new Error("RESOURCE_SCOPE_NOT_FOUND");
}

export async function createResourceGrant(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    principalUserId: string;
    resourceType: string;
    resourceId: string;
    permission: WorkspacePermission;
  },
) {
  return withWorkspaceTransaction(pool, async (client) => {
    await checkSharedResource(client,input.workspaceId,input.resourceType,input.resourceId);
    const member = await client.query(
      `select 1 from "workspace_members" m
       join "users" u on u."id"=m."user_id"
       where m."workspace_id"=$1::uuid and m."user_id"=$2::uuid
         and m."status"='active'
         and u."status" in ('active','pending_onboarding','deletion_requested')`,
      [input.workspaceId,input.principalUserId],
    );
    if (!member.rowCount) throw new Error("GRANT_PRINCIPAL_NOT_ACTIVE");
    const result = await client.query<{ id: string }>(
      `insert into "resource_grants"
       ("workspace_id","principal_user_id","resource_type","resource_id","permission","created_by_user_id")
       values ($1,$2,$3,$4,$5,$6)
       on conflict ("workspace_id","principal_user_id","resource_type","resource_id","permission")
       do update set "created_by_user_id"=excluded."created_by_user_id"
       returning "id"`,
      [input.workspaceId,input.principalUserId,input.resourceType,input.resourceId,input.permission,input.actorUserId],
    );
    await bumpWorkspacePermissionVersion(client,input.workspaceId);
    return { id: result.rows[0]?.id ?? "" };
  });
}

export async function listResourceGrants(
  pool: Pool,
  workspaceId: string,
  resourceType: string,
  resourceId: string,
) {
  const result = await pool.query(
    `select "id", "principal_user_id", "permission", "created_at"
     from "resource_grants"
     where "workspace_id" = $1 and "resource_type" = $2 and "resource_id" = $3
     order by "created_at", "id"`,
    [workspaceId, resourceType, resourceId],
  );
  return result.rows;
}

export async function deleteResourceGrant(
  pool: Pool,
  workspaceId: string,
  grantId: string,
): Promise<boolean> {
  const result = await pool.query(
    `delete from "resource_grants" where "workspace_id" = $1 and "id" = $2`,
    [workspaceId, grantId],
  );
  if ((result.rowCount ?? 0) === 1) {
    await bumpWorkspacePermissionVersion(pool, workspaceId);
  }
  return (result.rowCount ?? 0) === 1;
}

export async function createShareLink(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    resourceType: string;
    resourceId: string;
    password?: string | undefined;
    allowDownload: boolean;
    expiresAt?: Date | undefined;
  },
) {
  return withWorkspaceTransaction(pool, async (client) => {
    await checkSharedResource(client,input.workspaceId,input.resourceType,input.resourceId);
    const token = newWorkspaceToken();
    const passwordSalt = input.password ? randomBytes(16).toString("hex") : null;
    const passwordHash = input.password && passwordSalt
      ? hashWorkspacePassword(input.password,passwordSalt).toString("hex") : null;
    const result = await client.query<{ id: string }>(
      `insert into "workspace_share_links"
       ("workspace_id","resource_type","resource_id","token_hash","password_salt",
        "password_hash","allow_download","expires_at","created_by_user_id")
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning "id"`,
      [input.workspaceId,input.resourceType,input.resourceId,hashWorkspaceToken(token),
       passwordSalt,passwordHash,input.allowDownload,input.expiresAt ?? null,input.actorUserId],
    );
    return { id: result.rows[0]?.id ?? "", token };
  });
}

export async function revokeShareLink(
  pool: Pool,
  workspaceId: string,
  shareLinkId: string,
): Promise<boolean> {
  const result = await pool.query(
    `update "workspace_share_links"
     set "revoked_at" = now()
     where "id" = $1 and "workspace_id" = $2 and "revoked_at" is null`,
    [shareLinkId, workspaceId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function resolveShareLink(
  pool: Pool,
  token: string,
  password?: string,
) {
  const result = await pool.query<{
    id: string; workspace_id: string; resource_type: string; resource_id: string;
    password_salt: string | null; password_hash: string | null; allow_download: boolean;
    expires_at: Date | null; revoked_at: Date | null;
  }>(
    `select l."id", l."workspace_id", l."resource_type", l."resource_id",
            l."password_salt", l."password_hash", l."allow_download", l."expires_at", l."revoked_at"
     from "workspace_share_links" l
     join "workspaces" w on w."id" = l."workspace_id"
     where l."token_hash" = $1 and w."archived_at" is null
       and l."revoked_at" is null
       and (l."expires_at" is null or l."expires_at" > now())
       and (
         (l."resource_type"='workspace' and l."resource_id"=w."id"::text)
         or (l."resource_type"='node' and exists (
           select 1 from "content_nodes" n
           where n."workspace_id"=w."id"
             and n."id"::text=l."resource_id" and n."trashed_at" is null
         ))
       )
     limit 1`,
    [hashWorkspaceToken(token)],
  );
  const row = result.rows[0];
  if (!row || row.revoked_at || (row.expires_at && row.expires_at.getTime() <= Date.now())) {
    return null;
  }
  if (
    row.password_hash &&
    row.password_salt &&
    (!password || !verifyWorkspacePassword(password, row.password_salt, row.password_hash))
  ) {
    return null;
  }
  // Re-check at update time so concurrent revocation cannot grant stale access.
  const checked = await pool.query(
    `update "workspace_share_links" l
     set "access_count"=l."access_count"+1, "last_accessed_at"=now()
     from "workspaces" w
     where l."id"=$1 and w."id"=l."workspace_id"
       and w."archived_at" is null and l."revoked_at" is null
       and (l."expires_at" is null or l."expires_at">now())
       and (
         (l."resource_type"='workspace' and l."resource_id"=w."id"::text)
         or (l."resource_type"='node' and exists (
           select 1 from "content_nodes" n
           where n."workspace_id"=w."id"
             and n."id"::text=l."resource_id" and n."trashed_at" is null
         ))
       )
     returning l."id"`,
    [row.id],
  );
  if (!checked.rowCount) return null;
  return {
    workspaceId: row.workspace_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    allowDownload: row.allow_download,
  };
}
