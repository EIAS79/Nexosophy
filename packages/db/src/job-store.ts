import type { Pool } from "pg";

import { withWorkspaceTransaction } from "./workspace-store-common.js";

export type DurableJobRecord = {
  id: string;
  workspaceId: string | null;
  queue: string;
  jobType: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
  payload: Record<string, unknown>;
  progress: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
};

type JobRow = {
  id: string;
  workspace_id: string | null;
  queue: string;
  job_type: string;
  status: DurableJobRecord["status"];
  payload: Record<string, unknown>;
  progress: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  created_at: Date;
  updated_at: Date;
};

function toJob(row: JobRow): DurableJobRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    queue: row.queue,
    jobType: row.job_type,
    status: row.status,
    payload: row.payload ?? {},
    progress: row.progress ?? {},
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function enqueueDurableJob(
  pool: Pool,
  input: {
    workspaceId?: string | null | undefined;
    queue: string;
    jobType: string;
    payload?: Record<string, unknown> | undefined;
    dedupeKey?: string | undefined;
    runAfter?: Date | undefined;
    maxAttempts?: number | undefined;
  },
): Promise<DurableJobRecord> {
  if (input.dedupeKey) {
    const existing = await pool.query<JobRow>(
      `select * from "durable_jobs"
       where "queue" = $1 and "dedupe_key" = $2
         and "status" in ('queued','running','succeeded')
       order by "created_at" desc
       limit 1`,
      [input.queue, input.dedupeKey],
    );
    if (existing.rows[0]) return toJob(existing.rows[0]);
  }

  const result = await pool.query<JobRow>(
    `insert into "durable_jobs"
       ("workspace_id", "queue", "job_type", "dedupe_key", "payload", "run_after", "max_attempts")
     values ($1, $2, $3, $4, $5::jsonb, coalesce($6, now()), $7)
     returning *`,
    [
      input.workspaceId ?? null,
      input.queue,
      input.jobType,
      input.dedupeKey ?? null,
      JSON.stringify(input.payload ?? {}),
      input.runAfter ?? null,
      input.maxAttempts ?? 8,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Durable job insert did not return a row.");
  return toJob(row);
}

export async function getDurableJob(
  pool: Pool,
  jobId: string,
): Promise<DurableJobRecord | null> {
  const result = await pool.query<JobRow>(
    `select * from "durable_jobs" where "id" = $1 limit 1`,
    [jobId],
  );
  return result.rows[0] ? toJob(result.rows[0]) : null;
}

type JobCursor = { createdAt: string; id: string };

function decodeJobCursor(cursor?: string): JobCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as JobCursor;
    if (!parsed.createdAt || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeJobCursor(job: DurableJobRecord): string {
  return Buffer.from(
    JSON.stringify({ createdAt: job.createdAt.toISOString(), id: job.id }),
    "utf8",
  ).toString("base64url");
}

export async function listWorkspaceJobs(
  pool: Pool,
  workspaceId: string,
  options: { limit?: number; cursor?: string | undefined } = {},
): Promise<{ items: DurableJobRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const cursor = decodeJobCursor(options.cursor);
  const result = await pool.query<JobRow>(
    `select * from "durable_jobs"
     where "workspace_id" = $1
       and (
         $2::timestamptz is null
         or ("created_at", "id") < ($2::timestamptz, $3::uuid)
       )
     order by "created_at" desc, "id" desc
     limit $4`,
    [workspaceId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  );
  const mapped = result.rows.map(toJob);
  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  return {
    items,
    nextCursor: hasMore && items.length > 0 ? encodeJobCursor(items[items.length - 1]!) : null,
  };
}

export async function claimNextDurableJob(
  pool: Pool,
  queue: string,
  workerId: string,
): Promise<DurableJobRecord | null> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "durable_jobs"
       set "status" = 'queued', "locked_at" = null, "locked_by" = null, "updated_at" = now()
       where "queue" = $1 and "status" = 'running'
         and "locked_at" < now() - interval '10 minutes'
         and "attempts" < "max_attempts"`,
      [queue],
    );
    const selected = await client.query<{ id: string }>(
      `select "id"
       from "durable_jobs"
       where "queue" = $1 and "status" = 'queued'
         and "run_after" <= now()
         and "attempts" < "max_attempts"
       order by "run_after", "created_at", "id"
       for update skip locked
       limit 1`,
      [queue],
    );
    const id = selected.rows[0]?.id;
    if (!id) return null;
    const result = await client.query<JobRow>(
      `update "durable_jobs"
       set "status" = 'running', "attempts" = "attempts" + 1,
           "locked_at" = now(), "locked_by" = $2, "updated_at" = now()
       where "id" = $1
       returning *`,
      [id, workerId],
    );
    return result.rows[0] ? toJob(result.rows[0]) : null;
  });
}

export async function updateDurableJobProgress(
  pool: Pool,
  jobId: string,
  progress: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `update "durable_jobs"
     set "progress" = $2::jsonb, "updated_at" = now()
     where "id" = $1 and "status" = 'running'`,
    [jobId, JSON.stringify(progress)],
  );
}

export async function completeDurableJob(
  pool: Pool,
  jobId: string,
  progress: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `update "durable_jobs"
     set "status" = 'succeeded', "progress" = $2::jsonb,
         "locked_at" = null, "locked_by" = null, "updated_at" = now()
     where "id" = $1 and "status" = 'running'`,
    [jobId, JSON.stringify(progress)],
  );
}

export async function failDurableJob(
  pool: Pool,
  jobId: string,
  input: { code: string; message: string; retryable: boolean },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const current = await client.query<JobRow>(
      `select * from "durable_jobs" where "id" = $1 for update`,
      [jobId],
    );
    const row = current.rows[0];
    if (!row || row.status !== "running") return;

    const retry = input.retryable && row.attempts < row.max_attempts;
    if (retry) {
      const delaySeconds = Math.min(900, 5 * 2 ** Math.min(row.attempts, 7));
      await client.query(
        `update "durable_jobs"
         set "status" = 'queued',
             "run_after" = now() + make_interval(secs => $2),
             "last_error_code" = $3,
             "last_error_message" = left($4, 1000),
             "locked_at" = null, "locked_by" = null, "updated_at" = now()
         where "id" = $1`,
        [jobId, delaySeconds, input.code, input.message],
      );
      return;
    }

    await client.query(
      `update "durable_jobs"
       set "status" = 'dead_letter',
           "last_error_code" = $2,
           "last_error_message" = left($3, 1000),
           "locked_at" = null, "locked_by" = null, "updated_at" = now()
       where "id" = $1`,
      [jobId, input.code, input.message],
    );
    await client.query(
      `insert into "dead_letters"
         ("source_type", "source_id", "queue", "payload", "error_code", "error_message", "attempts")
       values ('job', $1, $2, $3::jsonb, $4, $5, $6)`,
      [
        row.id,
        row.queue,
        JSON.stringify({
          jobType: row.job_type,
          workspaceId: row.workspace_id,
          payload: row.payload,
          progress: row.progress,
        }),
        input.code,
        input.message.slice(0, 1000),
        row.attempts,
      ],
    );
  });
}

export type OutboxEvent = {
  id: string;
  workspaceId: string | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export async function claimOutboxEvent(
  pool: Pool,
  workerId: string,
): Promise<OutboxEvent | null> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "outbox_events"
       set "status" = 'pending', "locked_at" = null, "locked_by" = null
       where "status" = 'processing' and "locked_at" < now() - interval '5 minutes'`,
    );
    const selected = await client.query<{ id: string }>(
      `select "id" from "outbox_events"
       where "status" = 'pending' and "available_at" <= now()
       order by "available_at", "created_at", "id"
       for update skip locked
       limit 1`,
    );
    const id = selected.rows[0]?.id;
    if (!id) return null;
    const result = await client.query<{
      id: string;
      workspace_id: string | null;
      aggregate_type: string;
      aggregate_id: string;
      event_type: string;
      payload: Record<string, unknown>;
      attempts: number;
    }>(
      `update "outbox_events"
       set "status" = 'processing', "attempts" = "attempts" + 1,
           "locked_at" = now(), "locked_by" = $2
       where "id" = $1
       returning "id", "workspace_id", "aggregate_type", "aggregate_id",
                 "event_type", "payload", "attempts"`,
      [id, workerId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          workspaceId: row.workspace_id,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          eventType: row.event_type,
          payload: row.payload ?? {},
          attempts: row.attempts,
        }
      : null;
  });
}

export async function markOutboxPublished(pool: Pool, eventId: string): Promise<void> {
  await pool.query(
    `update "outbox_events"
     set "status" = 'published', "published_at" = now(),
         "locked_at" = null, "locked_by" = null
     where "id" = $1`,
    [eventId],
  );
}

export async function failOutboxEvent(
  pool: Pool,
  event: OutboxEvent,
  error: Error,
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    if (event.attempts < 8) {
      await client.query(
        `update "outbox_events"
         set "status" = 'pending',
             "available_at" = now() + make_interval(secs => least(900, 5 * power(2, "attempts")::int)),
             "last_error" = left($2, 1000),
             "locked_at" = null, "locked_by" = null
         where "id" = $1`,
        [event.id, error.message],
      );
      return;
    }
    await client.query(
      `update "outbox_events"
       set "status" = 'dead_letter', "last_error" = left($2, 1000),
           "locked_at" = null, "locked_by" = null
       where "id" = $1`,
      [event.id, error.message],
    );
    await client.query(
      `insert into "dead_letters"
         ("source_type", "source_id", "queue", "payload", "error_message", "attempts")
       values ('outbox', $1, 'outbox', $2::jsonb, $3, $4)`,
      [event.id, JSON.stringify(event), error.message.slice(0, 1000), event.attempts],
    );
  });
}

export async function replayDeadLetter(pool: Pool, deadLetterId: string): Promise<boolean> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query<{
      source_type: string;
      source_id: string;
      payload: Record<string, unknown>;
    }>(
      `select "source_type", "source_id", "payload"
       from "dead_letters"
       where "id" = $1 and "replayed_at" is null
       for update`,
      [deadLetterId],
    );
    const row = result.rows[0];
    if (!row) return false;
    if (row.source_type === "job") {
      await client.query(
        `update "durable_jobs"
         set "status" = 'queued', "attempts" = 0, "run_after" = now(),
             "last_error_code" = null, "last_error_message" = null, "updated_at" = now()
         where "id" = $1`,
        [row.source_id],
      );
    } else if (row.source_type === "outbox") {
      await client.query(
        `update "outbox_events"
         set "status" = 'pending', "attempts" = 0, "available_at" = now(),
             "last_error" = null
         where "id" = $1`,
        [row.source_id],
      );
    } else {
      return false;
    }
    await client.query(
      `update "dead_letters" set "replayed_at" = now() where "id" = $1`,
      [deadLetterId],
    );
    return true;
  });
}


export async function listWorkspaceDeadLetters(
  pool: Pool,
  workspaceId: string,
  limit = 50,
): Promise<Array<{
  id: string;
  sourceType: string;
  sourceId: string;
  queue: string;
  payload: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  failedAt: Date;
  replayedAt: Date | null;
}>> {
  const result = await pool.query<{
    id: string;
    source_type: string;
    source_id: string;
    queue: string;
    payload: Record<string, unknown>;
    error_code: string | null;
    error_message: string | null;
    attempts: number;
    failed_at: Date;
    replayed_at: Date | null;
  }>(
    `select "id", "source_type", "source_id", "queue", "payload",
            "error_code", "error_message", "attempts", "failed_at", "replayed_at"
     from "dead_letters"
     where coalesce("payload" ->> 'workspaceId', '') = $1
     order by "failed_at" desc, "id" desc
     limit $2`,
    [workspaceId, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    queue: row.queue,
    payload: row.payload ?? {},
    errorCode: row.error_code,
    errorMessage: row.error_message,
    attempts: row.attempts,
    failedAt: row.failed_at,
    replayedAt: row.replayed_at,
  }));
}
