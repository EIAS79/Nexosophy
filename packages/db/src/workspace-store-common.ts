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

const AUDIT_REDACTED_KEYS = new Set([
  "body",
  "document",
  "content",
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "accessToken",
  "refreshToken",
]);

function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      output[key] = AUDIT_REDACTED_KEYS.has(key)
        ? "[redacted]"
        : sanitizeAuditMetadata(nested, depth + 1);
    }
    return output;
  }
  if (typeof value === "string" && value.length > 2000) {
    return value.slice(0, 2000) + "…";
  }
  return value;
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
      JSON.stringify(sanitizeAuditMetadata(input.metadata ?? {})),
    ],
  );
}
