import type { WorkspaceMemberStatus, WorkspaceRole } from "./workspace-types.js";
import type { Pool } from "pg";

import {
  appendWorkspaceAudit,
  bumpWorkspacePermissionVersion,
  hashWorkspaceToken,
  newWorkspaceToken,
  normalizeWorkspaceEmail,
  withWorkspaceTransaction,
} from "./workspace-store-common.js";

export async function listWorkspaceMembers(pool: Pool, workspaceId: string) {
  const result = await pool.query<{
    id: string;
    user_id: string;
    display_name: string;
    email: string | null;
    role: WorkspaceRole;
    status: WorkspaceMemberStatus;
    version: number;
    joined_at: Date;
  }>(
    `select m."id", m."user_id", coalesce(p."display_name", '') as "display_name",
            i."primary_email_snapshot" as "email", m."role", m."status", m."version", m."joined_at"
     from "workspace_members" m
     left join "user_profiles" p on p."user_id" = m."user_id"
     left join lateral (
       select ui."primary_email_snapshot"
       from "user_identities" ui
       where ui."user_id" = m."user_id" and ui."provider_deleted_at" is null
       order by ui."created_at"
       limit 1
     ) i on true
     where m."workspace_id" = $1
     order by case m."role" when 'owner' then 0 when 'admin' then 1 else 2 end,
              lower(coalesce(p."display_name", '')), m."id"`,
    [workspaceId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    version: row.version,
    joinedAt: row.joined_at,
  }));
}

export async function createWorkspaceInvitation(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    email: string;
    role: Exclude<WorkspaceRole, "owner">;
    expiresInHours: number;
    requestId?: string | undefined;
  },
) {
  const token = newWorkspaceToken();
  const result = await pool.query<{ id: string; expires_at: Date }>(
    `insert into "workspace_invitations"
       ("workspace_id", "email", "role", "token_hash", "invited_by_user_id", "expires_at")
     values ($1, $2, $3, $4, $5, now() + ($6 * interval '1 hour'))
     returning "id", "expires_at"`,
    [
      input.workspaceId,
      normalizeWorkspaceEmail(input.email),
      input.role,
      hashWorkspaceToken(token),
      input.actorUserId,
      input.expiresInHours,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Failed to create invitation");
  await appendWorkspaceAudit(pool, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "member.invited",
    targetType: "workspace_invitation",
    targetId: row.id,
    requestId: input.requestId,
    metadata: { email: normalizeWorkspaceEmail(input.email), role: input.role },
  });
  return { id: row.id, token, expiresAt: row.expires_at };
}

export async function listWorkspaceInvitations(pool: Pool, workspaceId: string) {
  const result = await pool.query<{
    id: string; email: string; role: WorkspaceRole; status: string;
    expires_at: Date; created_at: Date;
  }>(
    `select "id", "email", "role", "status", "expires_at", "created_at"
     from "workspace_invitations"
     where "workspace_id" = $1
     order by "created_at" desc, "id" desc
     limit 200`,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function revokeWorkspaceInvitation(
  pool: Pool,
  workspaceId: string,
  invitationId: string,
): Promise<boolean> {
  const result = await pool.query(
    `update "workspace_invitations"
     set "status" = 'revoked', "revoked_at" = now(), "updated_at" = now()
     where "id" = $1 and "workspace_id" = $2 and "status" = 'pending'`,
    [invitationId, workspaceId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function acceptWorkspaceInvitation(
  pool: Pool,
  input: { token: string; userId: string; requestId?: string | undefined },
) {
  return withWorkspaceTransaction(pool, async (client) => {
    const tokenHash = hashWorkspaceToken(input.token);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `workspace-invite:${tokenHash}`,
    ]);
    const invitation = await client.query<{
      id: string; workspace_id: string; email: string;
      role: Exclude<WorkspaceRole, "owner">; status: string; expires_at: Date;
    }>(
      `select "id", "workspace_id", "email", "role", "status", "expires_at"
       from "workspace_invitations"
       where "token_hash" = $1
       limit 1 for update`,
      [tokenHash],
    );
    const invite = invitation.rows[0];
    if (!invite || invite.status !== "pending") {
      return { accepted: false as const, reason: "unavailable" as const };
    }
    if (invite.expires_at.getTime() <= Date.now()) {
      await client.query(
        `update "workspace_invitations" set "status" = 'expired', "updated_at" = now() where "id" = $1`,
        [invite.id],
      );
      return { accepted: false as const, reason: "unavailable" as const };
    }
    const identity = await client.query<{ email: string | null }>(
      `select "primary_email_snapshot" as "email"
       from "user_identities"
       where "user_id" = $1 and "provider_deleted_at" is null and "disabled_at" is null
       order by "created_at" limit 1`,
      [input.userId],
    );
    const email = identity.rows[0]?.email;
    if (!email || normalizeWorkspaceEmail(email) !== normalizeWorkspaceEmail(invite.email)) {
      return { accepted: false as const, reason: "wrong_recipient" as const };
    }

    const membershipInsert = await client.query(
      `insert into "workspace_members" ("workspace_id", "user_id", "role", "status")
       values ($1, $2, $3, 'active')
       on conflict ("workspace_id", "user_id") do nothing`,
      [invite.workspace_id, input.userId, invite.role],
    );
    await client.query(
      `update "workspace_invitations"
       set "status" = 'accepted', "accepted_by_user_id" = $2, "accepted_at" = now(), "updated_at" = now()
       where "id" = $1`,
      [invite.id, input.userId],
    );
    if ((membershipInsert.rowCount ?? 0) === 1) {
      await bumpWorkspacePermissionVersion(client, invite.workspace_id);
    }
    await appendWorkspaceAudit(client, {
      workspaceId: invite.workspace_id,
      actorUserId: input.userId,
      action:
        (membershipInsert.rowCount ?? 0) === 1
          ? "member.invitation_accepted"
          : "member.invitation_accepted_existing",
      targetType: "workspace_invitation",
      targetId: invite.id,
      requestId: input.requestId,
    });
    return { accepted: true as const, workspaceId: invite.workspace_id };
  });
}

export async function updateWorkspaceMember(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    expectedVersion: number;
    role?: Exclude<WorkspaceRole, "owner"> | undefined;
    status?: WorkspaceMemberStatus | undefined;
  },
): Promise<boolean> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query(
      `update "workspace_members"
       set "role" = case when $4 then $5::workspace_role else "role" end,
           "status" = case when $6 then $7::workspace_member_status else "status" end,
           "version" = "version" + 1, "updated_at" = now()
       where "workspace_id" = $1 and "user_id" = $2 and "version" = $3 and "role" <> 'owner'`,
      [
        input.workspaceId, input.userId, input.expectedVersion,
        input.role !== undefined, input.role ?? "member",
        input.status !== undefined, input.status ?? "active",
      ],
    );
    if ((result.rowCount ?? 0) !== 1) return false;
    await bumpWorkspacePermissionVersion(client, input.workspaceId);
    return true;
  });
}

export async function removeWorkspaceMember(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query(
      `delete from "workspace_members"
       where "workspace_id" = $1 and "user_id" = $2 and "role" <> 'owner'`,
      [workspaceId, userId],
    );
    if ((result.rowCount ?? 0) !== 1) return false;
    await bumpWorkspacePermissionVersion(client, workspaceId);
    return true;
  });
}
