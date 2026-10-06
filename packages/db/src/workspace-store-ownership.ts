import type { WorkspaceMemberStatus, WorkspaceRole } from "./workspace-types.js";
import type { Pool } from "pg";

import {
  hashWorkspaceToken,
  newWorkspaceToken,
  withWorkspaceTransaction,
} from "./workspace-store-common.js";

export async function requestOwnershipTransfer(
  pool: Pool,
  input: {
    workspaceId: string;
    fromUserId: string;
    toUserId: string;
    expiresInHours: number;
  },
) {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `workspace-owner:${input.workspaceId}`,
    ]);
    const target = await client.query<{ role: WorkspaceRole; status: WorkspaceMemberStatus }>(
      `select "role", "status" from "workspace_members"
       where "workspace_id" = $1 and "user_id" = $2 for update`,
      [input.workspaceId, input.toUserId],
    );
    if (target.rows[0]?.status !== "active") return null;

    await client.query(
      `update "workspace_ownership_transfers"
       set "status" = 'cancelled'
       where "workspace_id" = $1 and "status" = 'pending'`,
      [input.workspaceId],
    );

    const token = newWorkspaceToken();
    const inserted = await client.query<{ id: string; expires_at: Date }>(
      `insert into "workspace_ownership_transfers"
         ("workspace_id", "from_user_id", "to_user_id", "token_hash", "expires_at")
       values ($1, $2, $3, $4, now() + ($5 * interval '1 hour'))
       returning "id", "expires_at"`,
      [
        input.workspaceId,
        input.fromUserId,
        input.toUserId,
        hashWorkspaceToken(token),
        input.expiresInHours,
      ],
    );
    const row = inserted.rows[0];
    return row ? { id: row.id, token, expiresAt: row.expires_at } : null;
  });
}

export async function acceptOwnershipTransfer(
  pool: Pool,
  input: { token: string; userId: string },
): Promise<boolean> {
  return withWorkspaceTransaction(pool, async (client) => {
    const tokenHash = hashWorkspaceToken(input.token);
    const transfer = await client.query<{
      id: string; workspace_id: string; from_user_id: string;
      to_user_id: string; status: string; expires_at: Date;
    }>(
      `select "id", "workspace_id", "from_user_id", "to_user_id", "status", "expires_at"
       from "workspace_ownership_transfers"
       where "token_hash" = $1 limit 1`,
      [tokenHash],
    );
    const row = transfer.rows[0];
    if (
      !row || row.status !== "pending" || row.to_user_id !== input.userId ||
      row.expires_at.getTime() <= Date.now()
    ) return false;

    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `workspace-owner:${row.workspace_id}`,
    ]);
    const locked = await client.query<{ status: string }>(
      `select "status" from "workspace_ownership_transfers" where "id" = $1 for update`,
      [row.id],
    );
    if (locked.rows[0]?.status !== "pending") return false;

    const memberships = await client.query<{
      user_id: string;
      role: WorkspaceRole;
      status: WorkspaceMemberStatus;
    }>(
      `select "user_id", "role", "status"
       from "workspace_members"
       where "workspace_id" = $1 and "user_id" = any($2::uuid[])
       for update`,
      [row.workspace_id, [row.from_user_id, row.to_user_id]],
    );
    const currentOwner = memberships.rows.find(
      (membership) =>
        membership.user_id === row.from_user_id &&
        membership.role === "owner" &&
        membership.status === "active",
    );
    const target = memberships.rows.find(
      (membership) =>
        membership.user_id === row.to_user_id &&
        membership.status === "active" &&
        membership.role !== "owner",
    );
    if (!currentOwner || !target) return false;

    const demoted = await client.query(
      `update "workspace_members"
       set "role" = 'admin', "version" = "version" + 1, "updated_at" = now()
       where "workspace_id" = $1 and "user_id" = $2 and "role" = 'owner' and "status" = 'active'`,
      [row.workspace_id, row.from_user_id],
    );
    if ((demoted.rowCount ?? 0) !== 1) {
      throw new Error("Ownership transfer lost the current owner invariant");
    }

    const promoted = await client.query(
      `update "workspace_members"
       set "role" = 'owner', "status" = 'active',
           "version" = "version" + 1, "updated_at" = now()
       where "workspace_id" = $1 and "user_id" = $2 and "status" = 'active'`,
      [row.workspace_id, row.to_user_id],
    );
    if ((promoted.rowCount ?? 0) !== 1) {
      throw new Error("Ownership transfer lost the target membership invariant");
    }

    const workspaceUpdate = await client.query(
      `update "workspaces"
       set "owner_user_id" = $2, "permission_version" = "permission_version" + 1,
           "version" = "version" + 1, "updated_at" = now()
       where "id" = $1 and "owner_user_id" = $3`,
      [row.workspace_id, row.to_user_id, row.from_user_id],
    );
    if ((workspaceUpdate.rowCount ?? 0) !== 1) {
      throw new Error("Ownership transfer lost the workspace owner invariant");
    }

    const accepted = await client.query(
      `update "workspace_ownership_transfers"
       set "status" = 'accepted', "accepted_at" = now()
       where "id" = $1 and "status" = 'pending'`,
      [row.id],
    );
    if ((accepted.rowCount ?? 0) !== 1) {
      throw new Error("Ownership transfer was concurrently consumed");
    }
    return true;
  });
}
