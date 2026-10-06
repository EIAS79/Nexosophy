import { randomBytes } from "node:crypto";

import type { WorkspacePermission } from "./workspace-types.js";
import type { Pool } from "pg";

import {
  bumpWorkspacePermissionVersion,
  hashWorkspacePassword,
  hashWorkspaceToken,
  newWorkspaceToken,
  verifyWorkspacePassword,
} from "./workspace-store-common.js";

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
  const result = await pool.query<{ id: string }>(
    `insert into "resource_grants"
       ("workspace_id", "principal_user_id", "resource_type", "resource_id", "permission", "created_by_user_id")
     values ($1, $2, $3, $4, $5, $6)
     on conflict ("workspace_id", "principal_user_id", "resource_type", "resource_id", "permission")
     do update set "created_by_user_id" = excluded."created_by_user_id"
     returning "id"`,
    [
      input.workspaceId, input.principalUserId, input.resourceType,
      input.resourceId, input.permission, input.actorUserId,
    ],
  );
  await bumpWorkspacePermissionVersion(pool, input.workspaceId);
  return { id: result.rows[0]?.id ?? "" };
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
  const token = newWorkspaceToken();
  const passwordSalt = input.password ? randomBytes(16).toString("hex") : null;
  const passwordHash =
    input.password && passwordSalt
      ? hashWorkspacePassword(input.password, passwordSalt).toString("hex")
      : null;

  const result = await pool.query<{ id: string }>(
    `insert into "workspace_share_links"
       ("workspace_id", "resource_type", "resource_id", "token_hash", "password_salt",
        "password_hash", "allow_download", "expires_at", "created_by_user_id")
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning "id"`,
    [
      input.workspaceId, input.resourceType, input.resourceId, hashWorkspaceToken(token),
      passwordSalt, passwordHash, input.allowDownload, input.expiresAt ?? null, input.actorUserId,
    ],
  );
  return { id: result.rows[0]?.id ?? "", token };
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
  await pool.query(
    `update "workspace_share_links"
     set "access_count" = "access_count" + 1, "last_accessed_at" = now()
     where "id" = $1`,
    [row.id],
  );
  return {
    workspaceId: row.workspace_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    allowDownload: row.allow_download,
  };
}
