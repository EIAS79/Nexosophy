import type { Pool, PoolClient } from "pg";

import { isQuietTime, nextOccurrenceAfter, nextQuietEnd } from "./recurrence.js";
import { withWorkspaceTransaction } from "./workspace-store-common.js";

export type NotificationRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  actionUrl: string | null;
  sourceType: string | null;
  sourceId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationPreferencesRecord = {
  webEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestMode: "immediate" | "hourly" | "daily";
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string;
};

function toNotification(row: any): NotificationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    sourceType: row.source_type,
    sourceId: row.source_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

async function preferences(
  db: Pool | PoolClient,
  workspaceId: string,
  userId: string,
): Promise<NotificationPreferencesRecord> {
  const result = await db.query<any>(
    `select "web_enabled","email_enabled","push_enabled","digest_mode",
            "quiet_start"::text as "quiet_start","quiet_end"::text as "quiet_end","timezone"
     from "notification_preferences"
     where "workspace_id" = $1 and "user_id" = $2
     limit 1`,
    [workspaceId, userId],
  );
  const row = result.rows[0];
  return row
    ? {
        webEnabled: row.web_enabled,
        emailEnabled: row.email_enabled,
        pushEnabled: row.push_enabled,
        digestMode: row.digest_mode,
        quietStart: row.quiet_start?.slice(0, 5) ?? null,
        quietEnd: row.quiet_end?.slice(0, 5) ?? null,
        timezone: row.timezone,
      }
    : {
        webEnabled: true,
        emailEnabled: false,
        pushEnabled: false,
        digestMode: "immediate",
        quietStart: null,
        quietEnd: null,
        timezone: "UTC",
      };
}

function digestRunAfter(
  now: Date,
  prefs: NotificationPreferencesRecord,
  category: string,
): Date {
  if (category === "security") return now;
  let runAfter = now;
  if (isQuietTime(now, prefs.timezone, prefs.quietStart, prefs.quietEnd)) {
    runAfter = nextQuietEnd(now, prefs.timezone, prefs.quietStart, prefs.quietEnd);
  }
  if (prefs.digestMode === "hourly") {
    const rounded = new Date(runAfter);
    rounded.setUTCMinutes(0, 0, 0);
    rounded.setUTCHours(rounded.getUTCHours() + 1);
    return rounded;
  }
  if (prefs.digestMode === "daily") {
    return new Date(runAfter.getTime() + 24 * 60 * 60 * 1000);
  }
  return runAfter;
}

async function createNotificationWithClient(
  client: PoolClient,
  input: {
    workspaceId: string;
    userId: string;
    category: string;
    title: string;
    body?: string | undefined;
    actionUrl?: string | undefined;
    sourceType?: string | undefined;
    sourceId?: string | undefined;
    dedupeKey: string;
  },
): Promise<NotificationRecord> {
  if (input.sourceType && input.sourceId) {
    const mute = await client.query<{ muted: boolean }>(
      `select "muted"
       from "notification_subscriptions"
       where "workspace_id" = $1 and "user_id" = $2
         and "source_type" = $3 and "source_id" = $4
       limit 1`,
      [input.workspaceId, input.userId, input.sourceType, input.sourceId],
    );
    if (mute.rows[0]?.muted) throw new Error("NOTIFICATION_MUTED");
  }

  const result = await client.query<any>(
    `insert into "notifications"
       ("workspace_id","user_id","category","title","body","action_url",
        "source_type","source_id","dedupe_key")
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict ("workspace_id","user_id","dedupe_key")
     do update set "dedupe_key" = excluded."dedupe_key"
     returning *`,
    [
      input.workspaceId,
      input.userId,
      input.category,
      input.title,
      input.body ?? "",
      input.actionUrl ?? null,
      input.sourceType ?? null,
      input.sourceId ?? null,
      input.dedupeKey,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("NOTIFICATION_CREATE_FAILED");
  const prefs = await preferences(client, input.workspaceId, input.userId);
  const runAfter = digestRunAfter(new Date(), prefs, input.category);

  if (prefs.webEnabled) {
    await client.query(
      `insert into "notification_deliveries"
         ("notification_id","channel","status","delivered_at")
       values ($1,'web','delivered',now())
       on conflict ("notification_id","channel") do nothing`,
      [row.id],
    );
  }
  for (const [channel, enabled] of [
    ["email", prefs.emailEnabled],
    ["push", prefs.pushEnabled],
  ] as const) {
    if (!enabled) continue;
    await client.query(
      `insert into "notification_deliveries"
         ("notification_id","channel","run_after")
       values ($1,$2::notification_channel,$3)
       on conflict ("notification_id","channel") do nothing`,
      [row.id, channel, runAfter],
    );
  }
  return toNotification(row);
}

export async function createNotification(
  pool: Pool,
  input: Parameters<typeof createNotificationWithClient>[1],
): Promise<NotificationRecord | null> {
  try {
    return await withWorkspaceTransaction(pool, (client) =>
      createNotificationWithClient(client, input),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NOTIFICATION_MUTED") return null;
    throw error;
  }
}

export async function listNotifications(
  pool: Pool,
  workspaceId: string,
  userId: string,
  limit = 100,
): Promise<{ items: NotificationRecord[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    pool.query<any>(
      `select * from "notifications"
       where "workspace_id" = $1 and "user_id" = $2
       order by "created_at" desc, "id" desc
       limit $3`,
      [workspaceId, userId, Math.min(Math.max(limit, 1), 200)],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as "count"
       from "notifications"
       where "workspace_id" = $1 and "user_id" = $2 and "read_at" is null`,
      [workspaceId, userId],
    ),
  ]);
  return {
    items: rows.rows.map(toNotification),
    unread: Number(unread.rows[0]?.count ?? 0),
  };
}

export async function markNotificationRead(
  pool: Pool,
  workspaceId: string,
  userId: string,
  notificationId?: string,
): Promise<void> {
  await pool.query(
    notificationId
      ? `update "notifications"
         set "read_at" = coalesce("read_at", now())
         where "workspace_id" = $1 and "user_id" = $2 and "id" = $3`
      : `update "notifications"
         set "read_at" = coalesce("read_at", now())
         where "workspace_id" = $1 and "user_id" = $2 and "read_at" is null`,
    notificationId ? [workspaceId, userId, notificationId] : [workspaceId, userId],
  );
}

export async function getNotificationPreferences(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<NotificationPreferencesRecord> {
  return preferences(pool, workspaceId, userId);
}

export async function setNotificationPreferences(
  pool: Pool,
  workspaceId: string,
  userId: string,
  input: NotificationPreferencesRecord,
): Promise<NotificationPreferencesRecord> {
  await pool.query(
    `insert into "notification_preferences"
       ("workspace_id","user_id","web_enabled","email_enabled","push_enabled",
        "digest_mode","quiet_start","quiet_end","timezone")
     values ($1,$2,$3,$4,$5,$6,$7::time,$8::time,$9)
     on conflict ("workspace_id","user_id")
     do update set "web_enabled" = excluded."web_enabled",
                   "email_enabled" = excluded."email_enabled",
                   "push_enabled" = excluded."push_enabled",
                   "digest_mode" = excluded."digest_mode",
                   "quiet_start" = excluded."quiet_start",
                   "quiet_end" = excluded."quiet_end",
                   "timezone" = excluded."timezone",
                   "updated_at" = now()`,
    [
      workspaceId,
      userId,
      input.webEnabled,
      input.emailEnabled,
      input.pushEnabled,
      input.digestMode,
      input.quietStart,
      input.quietEnd,
      input.timezone,
    ],
  );
  return input;
}

export async function setNotificationSubscription(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    sourceType: string;
    sourceId: string;
    muted: boolean;
  },
): Promise<void> {
  await pool.query(
    `insert into "notification_subscriptions"
       ("workspace_id","user_id","source_type","source_id","muted")
     values ($1,$2,$3,$4,$5)
     on conflict ("workspace_id","user_id","source_type","source_id")
     do update set "muted" = excluded."muted", "updated_at" = now()`,
    [input.workspaceId, input.userId, input.sourceType, input.sourceId, input.muted],
  );
}

export async function processDueReminderBatch(
  pool: Pool,
  limit = 100,
): Promise<number> {
  const due = await pool.query<{ id: string }>(
    `select "id"
     from "reminders"
     where "status" = 'active'
       and greatest("next_occurrence_at", coalesce("snoozed_until","next_occurrence_at")) <= now()
     order by greatest("next_occurrence_at", coalesce("snoozed_until","next_occurrence_at")), "id"
     limit $1`,
    [limit],
  );
  let processed = 0;

  for (const candidate of due.rows) {
    await withWorkspaceTransaction(pool, async (client) => {
      const locked = await client.query<any>(
        `select * from "reminders"
         where "id" = $1 and "status" = 'active'
         for update skip locked`,
        [candidate.id],
      );
      const reminder = locked.rows[0];
      if (!reminder) return;
      const effectiveAt =
        reminder.snoozed_until && reminder.snoozed_until > reminder.next_occurrence_at
          ? reminder.snoozed_until
          : reminder.next_occurrence_at;
      if (effectiveAt > new Date()) return;

      let occurrenceAt: Date | null = reminder.next_occurrence_at;
      let loops = 0;
      while (occurrenceAt && occurrenceAt <= new Date() && loops < 100) {
        loops += 1;
        const occurrence = await client.query<{ id: string }>(
          `insert into "reminder_occurrences"
             ("workspace_id","reminder_id","user_id","occurrence_at")
           values ($1,$2,$3,$4)
           on conflict ("reminder_id","occurrence_at") do nothing
           returning "id"`,
          [
            reminder.workspace_id,
            reminder.id,
            reminder.user_id,
            occurrenceAt,
          ],
        );
        if (occurrence.rows[0]) {
          try {
            const notification = await createNotificationWithClient(client, {
              workspaceId: reminder.workspace_id,
              userId: reminder.user_id,
              category: "reminder",
              title: reminder.title,
              body: reminder.message,
              actionUrl:
                reminder.task_id
                  ? "/app/tasks"
                  : reminder.event_id
                    ? "/app/calendar"
                    : reminder.linked_node_id
                      ? "/app/workspaces/" +
                        reminder.workspace_id +
                        "/node/" +
                        reminder.linked_node_id
                      : "/app/inbox",
              sourceType: "reminder",
              sourceId: reminder.id,
              dedupeKey: "reminder:" + reminder.id + ":" + occurrenceAt.toISOString(),
            });
            await client.query(
              `update "reminder_occurrences"
               set "notification_id" = $2
               where "id" = $1`,
              [occurrence.rows[0].id, notification.id],
            );
          } catch (error) {
            if (!(error instanceof Error && error.message === "NOTIFICATION_MUTED")) throw error;
          }
          processed += 1;
        }

        occurrenceAt =
          reminder.recurrence_rule && reminder.recurrence_anchor_at
            ? nextOccurrenceAfter(
                reminder.recurrence_anchor_at,
                occurrenceAt,
                reminder.timezone,
                reminder.recurrence_rule,
              )
            : null;
      }

      await client.query(
        `update "reminders"
         set "next_occurrence_at" = coalesce($2,"next_occurrence_at"),
             "status" = case when $2::timestamptz is null then 'completed'::reminder_status else "status" end,
             "snoozed_until" = null,
             "last_fired_at" = now(),
             "updated_at" = now()
         where "id" = $1`,
        [reminder.id, occurrenceAt],
      );
    });
  }
  return processed;
}

export async function fanoutOutboxNotification(
  pool: Pool,
  eventType: string,
  data: {
    workspaceId?: string | null;
    aggregateType?: string;
    aggregateId?: string;
    payload?: Record<string, unknown>;
    outboxEventId?: string;
  },
): Promise<number> {
  const workspaceId = data.workspaceId;
  if (!workspaceId) return 0;
  const payload = data.payload ?? {};
  const recipients = new Set<string>();
  for (const key of ["recipientUserId", "assignedUserId", "userId"] as const) {
    const value = payload[key];
    if (typeof value === "string") recipients.add(value);
  }
  for (const key of ["recipientUserIds", "mentionedUserIds"] as const) {
    const value = payload[key];
    if (Array.isArray(value)) {
      for (const userId of value) if (typeof userId === "string") recipients.add(userId);
    }
  }
  if (recipients.size === 0) return 0;

  const category =
    eventType.includes("mention") || eventType.includes("comment")
      ? "collaboration"
      : eventType.includes("security")
        ? "security"
        : eventType.includes("calendar")
          ? "calendar"
          : eventType.includes("task")
            ? "task"
            : eventType.includes("import") || eventType.includes("export")
              ? "transfer"
              : "activity";
  const title =
    category === "collaboration"
      ? "You were mentioned"
      : category === "calendar"
        ? "Calendar update"
        : category === "task"
          ? "Task update"
          : category === "transfer"
            ? "Import/export update"
            : category === "security"
              ? "Security alert"
              : "Workspace activity";

  let count = 0;
  for (const userId of recipients) {
    try {
      const notification = await createNotification(pool, {
        workspaceId,
        userId,
        category,
        title,
        body:
          typeof payload.message === "string"
            ? payload.message
            : eventType.replaceAll(".", " "),
        actionUrl:
          typeof payload.nodeId === "string"
            ? "/app/workspaces/" + workspaceId + "/node/" + payload.nodeId
            : category === "calendar"
              ? "/app/calendar"
              : category === "task"
                ? "/app/tasks"
                : "/app/inbox",
        sourceType: data.aggregateType,
        sourceId: data.aggregateId,
        dedupeKey:
          "outbox:" +
          eventType +
          ":" +
          (data.outboxEventId ?? String(payload.outboxEventId ?? data.aggregateId ?? "event")) +
          ":" +
          userId,
      });
      if (notification) count += 1;
    } catch {
      // A muted source is intentionally not a delivery failure.
    }
  }
  return count;
}

export type ClaimedNotificationDelivery = {
  id: string;
  notificationId: string;
  channel: "email" | "push";
  attempts: number;
  userId: string;
  workspaceId: string;
  category: string;
  title: string;
  body: string;
  actionUrl: string | null;
};

export async function claimNotificationDelivery(
  pool: Pool,
  workerId: string,
): Promise<ClaimedNotificationDelivery | null> {
  return withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `update "notification_deliveries"
       set "status" = 'queued', "locked_at" = null, "locked_by" = null, "updated_at" = now()
       where "status" = 'processing' and "locked_at" < now() - interval '5 minutes'
         and "attempts" < 8`,
    );
    const selected = await client.query<{ id: string }>(
      `select "id"
       from "notification_deliveries"
       where "status" = 'queued' and "run_after" <= now()
         and "channel" in ('email','push')
       order by "run_after","created_at","id"
       for update skip locked
       limit 1`,
    );
    const id = selected.rows[0]?.id;
    if (!id) return null;
    const result = await client.query<any>(
      `update "notification_deliveries" d
       set "status" = 'processing', "attempts" = "attempts" + 1,
           "locked_at" = now(), "locked_by" = $2, "updated_at" = now()
       from "notifications" n
       where d."id" = $1 and n."id" = d."notification_id"
       returning d."id", d."notification_id", d."channel"::text as "channel",
                 d."attempts", n."user_id", n."workspace_id", n."category",
                 n."title", n."body", n."action_url"`,
      [id, workerId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          notificationId: row.notification_id,
          channel: row.channel,
          attempts: row.attempts,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          category: row.category,
          title: row.title,
          body: row.body,
          actionUrl: row.action_url,
        }
      : null;
  });
}

export async function completeNotificationDelivery(
  pool: Pool,
  deliveryId: string,
  status: "delivered" | "suppressed",
  error?: string,
): Promise<void> {
  await pool.query(
    `update "notification_deliveries"
     set "status" = $2::notification_delivery_status,
         "delivered_at" = case when $2 = 'delivered' then now() else null end,
         "last_error" = $3,
         "locked_at" = null, "locked_by" = null, "updated_at" = now()
     where "id" = $1`,
    [deliveryId, status, error ?? null],
  );
}

export async function failNotificationDelivery(
  pool: Pool,
  delivery: ClaimedNotificationDelivery,
  error: Error,
): Promise<void> {
  if (delivery.attempts < 8) {
    const seconds = Math.min(3600, 15 * 2 ** Math.min(delivery.attempts, 7));
    await pool.query(
      `update "notification_deliveries"
       set "status" = 'queued',
           "run_after" = now() + make_interval(secs => $2),
           "last_error" = left($3,1000),
           "locked_at" = null, "locked_by" = null, "updated_at" = now()
       where "id" = $1`,
      [delivery.id, seconds, error.message],
    );
    return;
  }
  await pool.query(
    `update "notification_deliveries"
     set "status" = 'failed', "last_error" = left($2,1000),
         "locked_at" = null, "locked_by" = null, "updated_at" = now()
     where "id" = $1`,
    [delivery.id, error.message],
  );
}
