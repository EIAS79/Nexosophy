import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { Pool, PoolClient } from "pg";

export type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function withWorkspaceTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function newWorkspaceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashWorkspaceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeWorkspaceEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashWorkspacePassword(password: string, salt: string): Buffer {
  return scryptSync(password, salt, 32);
}

export function verifyWorkspacePassword(password: string, salt: string, expectedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = hashWorkspacePassword(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function bumpWorkspacePermissionVersion(
  db: Queryable,
  workspaceId: string,
): Promise<void> {
  await db.query(
    `update "workspaces"
     set "permission_version" = "permission_version" + 1,
         "updated_at" = now()
     where "id" = $1`,
    [workspaceId],
  );
}

export async function appendWorkspaceAudit(
  db: Queryable,
  input: {
    workspaceId: string;
    actorUserId?: string | undefined;
    action: string;
    targetType: string;
    targetId?: string | null | undefined;
    requestId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  },
): Promise<void> {
  await db.query(
    `insert into "workspace_audit_events"
       ("workspace_id", "actor_user_id", "action", "target_type", "target_id", "request_id", "metadata")
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.workspaceId,
      input.actorUserId ?? null,
      input.action,
      input.targetType,
      input.targetId ?? null,
      input.requestId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
