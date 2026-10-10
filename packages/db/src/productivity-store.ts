import type { Pool, PoolClient } from "pg";

import { nextOccurrenceAfter, occurrencesBetween } from "./recurrence.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export type TaskProjectRecord = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string | null;
  version: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskRecord = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "waiting" | "done" | "cancelled";
  priority: "none" | "low" | "medium" | "high" | "urgent";
  startAt: Date | null;
  dueAt: Date | null;
  timezone: string;
  recurrenceRule: string | null;
  assignedUserId: string | null;
  linkedNodeId: string | null;
  version: number;
  completedAt: Date | null;
  tags: Array<{ id: string; name: string; color: string | null }>;
  dependencyIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type ReminderRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  taskId: string | null;
  eventId: string | null;
  linkedNodeId: string | null;
  title: string;
  message: string;
  nextOccurrenceAt: Date;
  timezone: string;
  recurrenceRule: string | null;
  status: "active" | "completed" | "cancelled";
  snoozedUntil: Date | null;
  lastFiredAt: Date | null;
};

export type CalendarOccurrenceRecord = {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string;
  recurrenceRule: string | null;
  linkedNodeId: string | null;
  version: number;
  occurrenceStartAt?: Date;
  recurring: boolean;
};

type TaskRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: TaskRecord["status"];
  priority: TaskRecord["priority"];
  start_at: Date | null;
  due_at: Date | null;
  recurrence_anchor_at: Date | null;
  timezone: string;
  recurrence_rule: string | null;
  assigned_user_id: string | null;
  linked_node_id: string | null;
  version: number;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toProject(row: any): TaskProjectRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    color: row.color,
    version: row.version,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hydrateTask(
  db: Pool | PoolClient,
  row: TaskRow,
): Promise<TaskRecord> {
  const [tags, deps] = await Promise.all([
    db.query<{ id: string; name: string; color: string | null }>(
      `select t."id", t."name", t."color"
       from "task_tags" tt
       join "workspace_tags" t on t."id" = tt."tag_id"
       where tt."workspace_id" = $1 and tt."task_id" = $2
       order by t."normalized_name"`,
      [row.workspace_id, row.id],
    ),
    db.query<{ depends_on_task_id: string }>(
      `select "depends_on_task_id"
       from "task_dependencies"
       where "workspace_id" = $1 and "task_id" = $2
       order by "depends_on_task_id"`,
      [row.workspace_id, row.id],
    ),
  ]);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    parentTaskId: row.parent_task_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startAt: row.start_at,
    dueAt: row.due_at,
    timezone: row.timezone,
    recurrenceRule: row.recurrence_rule,
    assignedUserId: row.assigned_user_id,
    linkedNodeId: row.linked_node_id,
    version: row.version,
    completedAt: row.completed_at,
    tags: tags.rows,
    dependencyIds: deps.rows.map((item) => item.depends_on_task_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTaskProjects(
  pool: Pool,
  workspaceId: string,
): Promise<TaskProjectRecord[]> {
  const result = await pool.query(
    `select * from "task_projects"
     where "workspace_id" = $1 and "archived_at" is null
     order by lower("name"), "id"`,
    [workspaceId],
  );
  return result.rows.map(toProject);
}

export async function createTaskProject(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    name: string;
    description: string;
    color?: string | undefined;
    requestId?: string | undefined;
  },
): Promise<TaskProjectRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query(
      `insert into "task_projects"
         ("workspace_id", "name", "description", "color",
          "created_by_user_id", "updated_by_user_id")
       values ($1, $2, $3, $4, $5, $5)
       returning *`,
      [
        input.workspaceId,
        input.name,
        input.description,
        input.color ?? null,
        input.actorUserId,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("PROJECT_CREATE_FAILED");
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "productivity.project_created",
      targetType: "task_project",
      targetId: row.id,
      requestId: input.requestId,
      metadata: { name: input.name },
    });
    return toProject(row);
  });
}

type TaskCursor = { updatedAt: string; id: string };
function encodeTaskCursor(task: TaskRecord): string {
  return Buffer.from(
    JSON.stringify({ updatedAt: task.updatedAt.toISOString(), id: task.id }),
    "utf8",
  ).toString("base64url");
}
function decodeTaskCursor(cursor?: string): TaskCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as TaskCursor;
    return parsed.updatedAt && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

export async function listTasks(
  pool: Pool,
  input: {
    workspaceId: string;
    status?: TaskRecord["status"] | undefined;
    projectId?: string | undefined;
    dueBefore?: Date | undefined;
    assignedUserId?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
  },
): Promise<{ items: TaskRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const cursor = decodeTaskCursor(input.cursor);
  const result = await pool.query<TaskRow>(
    `select *
     from "tasks"
     where "workspace_id" = $1
       and ($2::task_status is null or "status" = $2::task_status)
       and ($3::uuid is null or "project_id" = $3)
       and ($4::timestamptz is null or "due_at" <= $4)
       and ($5::uuid is null or "assigned_user_id" = $5)
       and (
         $6::timestamptz is null
         or "updated_at" < $6
         or ("updated_at" = $6 and "id" < $7::uuid)
       )
     order by "updated_at" desc, "id" desc
     limit $8`,
    [
      input.workspaceId,
      input.status ?? null,
      input.projectId ?? null,
      input.dueBefore ?? null,
      input.assignedUserId ?? null,
      cursor?.updatedAt ?? null,
      cursor?.id ?? null,
      limit + 1,
    ],
  );
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const items: TaskRecord[] = [];
  for (const row of rows) items.push(await hydrateTask(pool, row));
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeTaskCursor(last) : null,
  };
}

async function replaceTaskLinks(
  client: PoolClient,
  input: {
    workspaceId: string;
    taskId: string;
    tagIds?: string[] | undefined;
    dependencyIds?: string[] | undefined;
  },
): Promise<void> {
  if (input.tagIds) {
    await client.query(
      `delete from "task_tags" where "workspace_id" = $1 and "task_id" = $2`,
      [input.workspaceId, input.taskId],
    );
    for (const tagId of [...new Set(input.tagIds)]) {
      await client.query(
        `insert into "task_tags" ("workspace_id", "task_id", "tag_id")
         select $1, $2, "id" from "workspace_tags"
         where "workspace_id" = $1 and "id" = $3
         on conflict do nothing`,
        [input.workspaceId, input.taskId, tagId],
      );
    }
  }
  if (input.dependencyIds) {
    await client.query(
      `delete from "task_dependencies"
       where "workspace_id" = $1 and "task_id" = $2`,
      [input.workspaceId, input.taskId],
    );
    for (const dependsOn of [...new Set(input.dependencyIds)]) {
      await client.query(
        `insert into "task_dependencies"
           ("workspace_id", "task_id", "depends_on_task_id")
         select $1, $2, "id" from "tasks"
         where "workspace_id" = $1 and "id" = $3 and "id" <> $2
         on conflict do nothing`,
        [input.workspaceId, input.taskId, dependsOn],
      );
    }
  }
}

export async function createTask(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    title: string;
    description: string;
    projectId?: string | undefined;
    parentTaskId?: string | undefined;
    priority: TaskRecord["priority"];
    startAt?: Date | undefined;
    dueAt?: Date | undefined;
    timezone: string;
    recurrenceRule?: string | undefined;
    assignedUserId?: string | undefined;
    linkedNodeId?: string | undefined;
    tagIds: string[];
    dependencyIds: string[];
    requestId?: string | undefined;
  },
): Promise<TaskRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query<TaskRow>(
      `insert into "tasks"
         ("workspace_id", "project_id", "parent_task_id", "title", "description",
          "priority", "start_at", "due_at", "recurrence_anchor_at", "timezone",
          "recurrence_rule", "assigned_user_id", "linked_node_id",
          "created_by_user_id", "updated_by_user_id")
       values ($1,$2,$3,$4,$5,$6::task_priority,$7,$8,$8,$9,$10,$11,$12,$13,$13)
       returning *`,
      [
        input.workspaceId,
        input.projectId ?? null,
        input.parentTaskId ?? null,
        input.title,
        input.description,
        input.priority,
        input.startAt ?? null,
        input.dueAt ?? null,
        input.timezone,
        input.recurrenceRule ?? null,
        input.assignedUserId ?? null,
        input.linkedNodeId ?? null,
        input.actorUserId,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("TASK_CREATE_FAILED");
    await replaceTaskLinks(client, {
      workspaceId: input.workspaceId,
      taskId: row.id,
      tagIds: input.tagIds,
      dependencyIds: input.dependencyIds,
    });
    await client.query(
      `insert into "outbox_events"
         ("workspace_id","aggregate_type","aggregate_id","event_type","payload")
       values ($1,'task',$2,'productivity.task_created',$3::jsonb)`,
      [
        input.workspaceId,
        row.id,
        JSON.stringify({
          taskId: row.id,
          userId: input.actorUserId,
          assignedUserId: input.assignedUserId ?? null,
          linkedNodeId: input.linkedNodeId ?? null,
        }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "productivity.task_created",
      targetType: "task",
      targetId: row.id,
      requestId: input.requestId,
      metadata: { projectId: input.projectId ?? null, recurring: Boolean(input.recurrenceRule) },
    });
    return hydrateTask(client, row);
  });
}

export async function updateTask(
  pool: Pool,
  input: {
    workspaceId: string;
    taskId: string;
    actorUserId: string;
    expectedVersion: number;
    title?: string | undefined;
    description?: string | undefined;
    projectId?: string | null | undefined;
    parentTaskId?: string | null | undefined;
    status?: TaskRecord["status"] | undefined;
    priority?: TaskRecord["priority"] | undefined;
    startAt?: Date | null | undefined;
    dueAt?: Date | null | undefined;
    timezone?: string | undefined;
    recurrenceRule?: string | null | undefined;
    assignedUserId?: string | null | undefined;
    linkedNodeId?: string | null | undefined;
    tagIds?: string[] | undefined;
    dependencyIds?: string[] | undefined;
    requestId?: string | undefined;
  },
): Promise<TaskRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query<TaskRow>(
      `update "tasks"
       set "title" = coalesce($4, "title"),
           "description" = coalesce($5, "description"),
           "project_id" = case when $6::boolean then $7::uuid else "project_id" end,
           "parent_task_id" = case when $8::boolean then $9::uuid else "parent_task_id" end,
           "status" = coalesce($10::task_status, "status"),
           "priority" = coalesce($11::task_priority, "priority"),
           "start_at" = case when $12::boolean then $13::timestamptz else "start_at" end,
           "due_at" = case when $14::boolean then $15::timestamptz else "due_at" end,
           "recurrence_anchor_at" = case
             when $14::boolean and $15::timestamptz is not null then $15::timestamptz
             else "recurrence_anchor_at"
           end,
           "timezone" = coalesce($16, "timezone"),
           "recurrence_rule" = case when $17::boolean then $18 else "recurrence_rule" end,
           "assigned_user_id" = case when $19::boolean then $20::uuid else "assigned_user_id" end,
           "linked_node_id" = case when $21::boolean then $22::uuid else "linked_node_id" end,
           "completed_at" = case
             when coalesce($10::task_status, "status") = 'done' then coalesce("completed_at", now())
             when $10::task_status is not null and $10::task_status <> 'done' then null
             else "completed_at"
           end,
           "updated_by_user_id" = $3,
           "updated_at" = now(),
           "version" = "version" + 1
       where "workspace_id" = $1 and "id" = $2 and "version" = $23
       returning *`,
      [
        input.workspaceId,
        input.taskId,
        input.actorUserId,
        input.title ?? null,
        input.description ?? null,
        input.projectId !== undefined,
        input.projectId ?? null,
        input.parentTaskId !== undefined,
        input.parentTaskId ?? null,
        input.status ?? null,
        input.priority ?? null,
        input.startAt !== undefined,
        input.startAt ?? null,
        input.dueAt !== undefined,
        input.dueAt ?? null,
        input.timezone ?? null,
        input.recurrenceRule !== undefined,
        input.recurrenceRule ?? null,
        input.assignedUserId !== undefined,
        input.assignedUserId ?? null,
        input.linkedNodeId !== undefined,
        input.linkedNodeId ?? null,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("TASK_VERSION_CONFLICT");
    await replaceTaskLinks(client, {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      tagIds: input.tagIds,
      dependencyIds: input.dependencyIds,
    });
    await client.query(
      `insert into "outbox_events"
         ("workspace_id","aggregate_type","aggregate_id","event_type","payload")
       values ($1,'task',$2,'productivity.task_updated',$3::jsonb)`,
      [
        input.workspaceId,
        input.taskId,
        JSON.stringify({ taskId: input.taskId, userId: input.actorUserId }),
      ],
    );
    return hydrateTask(client, row);
  });
}

export async function completeTask(
  pool: Pool,
  input: {
    workspaceId: string;
    taskId: string;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<TaskRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const current = await client.query<TaskRow>(
      `select * from "tasks"
       where "workspace_id" = $1 and "id" = $2
       for update`,
      [input.workspaceId, input.taskId],
    );
    const row = current.rows[0];
    if (!row) throw new Error("TASK_NOT_FOUND");

    const incompleteDependency = await client.query(
      `select 1
       from "task_dependencies" d
       join "tasks" dependency on dependency."id" = d."depends_on_task_id"
       where d."workspace_id" = $1 and d."task_id" = $2
         and dependency."status" <> 'done'
       limit 1`,
      [input.workspaceId, input.taskId],
    );
    if ((incompleteDependency.rowCount ?? 0) > 0) {
      throw new Error("TASK_DEPENDENCY_INCOMPLETE");
    }

    const occurrenceAt = row.due_at ?? new Date();
    await client.query(
      `insert into "task_occurrences"
         ("workspace_id","task_id","occurrence_at","completed_at","completed_by_user_id")
       values ($1,$2,$3,now(),$4)
       on conflict ("task_id","occurrence_at")
       do update set "completed_at" = coalesce("task_occurrences"."completed_at", now()),
                     "completed_by_user_id" = coalesce("task_occurrences"."completed_by_user_id", excluded."completed_by_user_id")`,
      [input.workspaceId, input.taskId, occurrenceAt, input.actorUserId],
    );

    const next =
      row.recurrence_rule && row.recurrence_anchor_at && row.due_at
        ? nextOccurrenceAfter(
            row.recurrence_anchor_at,
            row.due_at,
            row.timezone,
            row.recurrence_rule,
          )
        : null;

    const updated = await client.query<TaskRow>(
      `update "tasks"
       set "status" = $3::task_status,
           "due_at" = $4,
           "completed_at" = $5,
           "updated_by_user_id" = $6,
           "updated_at" = now(),
           "version" = "version" + 1
       where "workspace_id" = $1 and "id" = $2
       returning *`,
      [
        input.workspaceId,
        input.taskId,
        next ? "todo" : "done",
        next,
        next ? null : new Date(),
        input.actorUserId,
      ],
    );
    const nextRow = updated.rows[0];
    if (!nextRow) throw new Error("TASK_COMPLETE_FAILED");
    await client.query(
      `insert into "outbox_events"
         ("workspace_id","aggregate_type","aggregate_id","event_type","payload")
       values ($1,'task',$2,'productivity.task_completed',$3::jsonb)`,
      [
        input.workspaceId,
        input.taskId,
        JSON.stringify({
          taskId: input.taskId,
          userId: input.actorUserId,
          completedByUserId: input.actorUserId,
          nextOccurrenceAt: next?.toISOString() ?? null,
        }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "productivity.task_completed",
      targetType: "task",
      targetId: input.taskId,
      requestId: input.requestId,
      metadata: { recurring: Boolean(next), nextOccurrenceAt: next?.toISOString() ?? null },
    });
    return hydrateTask(client, nextRow);
  });
}

export async function productivityAnalytics(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<{
  completedTasks30d: number;
  openTasks: number;
  focusMinutes30d: number;
}> {
  const result = await pool.query<{
    completed_tasks: string;
    open_tasks: string;
    focus_seconds: string;
  }>(
    `select
       (select count(*)::text from "task_occurrences"
        where "workspace_id" = $1 and "completed_by_user_id" = $2
          and "completed_at" >= now() - interval '30 days') as "completed_tasks",
       (select count(*)::text from "tasks"
        where "workspace_id" = $1 and "status" not in ('done','cancelled')
          and ("assigned_user_id" is null or "assigned_user_id" = $2)) as "open_tasks",
       (select coalesce(sum("accumulated_seconds"),0)::text from "focus_sessions"
        where "workspace_id" = $1 and "user_id" = $2
          and "status" = 'completed' and "ended_at" >= now() - interval '30 days') as "focus_seconds"`,
    [workspaceId, userId],
  );
  return {
    completedTasks30d: Number(result.rows[0]?.completed_tasks ?? 0),
    openTasks: Number(result.rows[0]?.open_tasks ?? 0),
    focusMinutes30d: Math.round(Number(result.rows[0]?.focus_seconds ?? 0) / 60),
  };
}

function toReminder(row: any): ReminderRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    taskId: row.task_id,
    eventId: row.event_id,
    linkedNodeId: row.linked_node_id,
    title: row.title,
    message: row.message,
    nextOccurrenceAt: row.next_occurrence_at,
    timezone: row.timezone,
    recurrenceRule: row.recurrence_rule,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    lastFiredAt: row.last_fired_at,
  };
}

export async function listReminders(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<ReminderRecord[]> {
  const result = await pool.query(
    `select * from "reminders"
     where "workspace_id" = $1 and "user_id" = $2
       and "status" <> 'cancelled'
     order by coalesce("snoozed_until","next_occurrence_at"), "id"
     limit 500`,
    [workspaceId, userId],
  );
  return result.rows.map(toReminder);
}

export async function createReminder(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    title: string;
    message: string;
    at: Date;
    timezone: string;
    recurrenceRule?: string | undefined;
    taskId?: string | undefined;
    eventId?: string | undefined;
    linkedNodeId?: string | undefined;
  },
): Promise<ReminderRecord> {
  const result = await pool.query(
    `insert into "reminders"
       ("workspace_id","user_id","task_id","event_id","linked_node_id",
        "title","message","next_occurrence_at","recurrence_anchor_at",
        "timezone","recurrence_rule")
     values ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10)
     returning *`,
    [
      input.workspaceId,
      input.userId,
      input.taskId ?? null,
      input.eventId ?? null,
      input.linkedNodeId ?? null,
      input.title,
      input.message,
      input.at,
      input.timezone,
      input.recurrenceRule ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("REMINDER_CREATE_FAILED");
  return toReminder(row);
}

export async function snoozeReminder(
  pool: Pool,
  workspaceId: string,
  userId: string,
  reminderId: string,
  until: Date,
): Promise<ReminderRecord> {
  const result = await pool.query(
    `update "reminders"
     set "snoozed_until" = $4, "updated_at" = now()
     where "workspace_id" = $1 and "user_id" = $2 and "id" = $3
       and "status" = 'active'
     returning *`,
    [workspaceId, userId, reminderId, until],
  );
  const row = result.rows[0];
  if (!row) throw new Error("REMINDER_NOT_FOUND");
  return toReminder(row);
}

export async function cancelReminder(
  pool: Pool,
  workspaceId: string,
  userId: string,
  reminderId: string,
): Promise<boolean> {
  const result = await pool.query(
    `update "reminders"
     set "status" = 'cancelled', "updated_at" = now()
     where "workspace_id" = $1 and "user_id" = $2 and "id" = $3
       and "status" <> 'cancelled'`,
    [workspaceId, userId, reminderId],
  );
  return (result.rowCount ?? 0) > 0;
}

function toEvent(row: any): CalendarOccurrenceRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    timezone: row.timezone,
    recurrenceRule: row.recurrence_rule,
    linkedNodeId: row.linked_node_id,
    version: row.version,
    recurring: Boolean(row.recurrence_rule),
  };
}

export async function createCalendarEvent(
  pool: Pool,
  input: {
    workspaceId: string;
    actorUserId: string;
    title: string;
    description: string;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    timezone: string;
    recurrenceRule?: string | undefined;
    linkedNodeId?: string | undefined;
    requestId?: string | undefined;
  },
): Promise<CalendarOccurrenceRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query(
      `insert into "calendar_events"
         ("workspace_id","title","description","starts_at","ends_at","all_day",
          "timezone","recurrence_rule","linked_node_id","created_by_user_id","updated_by_user_id")
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       returning *`,
      [
        input.workspaceId,
        input.title,
        input.description,
        input.startsAt,
        input.endsAt,
        input.allDay,
        input.timezone,
        input.recurrenceRule ?? null,
        input.linkedNodeId ?? null,
        input.actorUserId,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("EVENT_CREATE_FAILED");
    await client.query(
      `insert into "outbox_events"
         ("workspace_id","aggregate_type","aggregate_id","event_type","payload")
       values ($1,'calendar_event',$2,'productivity.calendar_event_created',$3::jsonb)`,
      [
        input.workspaceId,
        row.id,
        JSON.stringify({ eventId: row.id, userId: input.actorUserId }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "productivity.calendar_event_created",
      targetType: "calendar_event",
      targetId: row.id,
      requestId: input.requestId,
      metadata: { recurring: Boolean(input.recurrenceRule), allDay: input.allDay },
    });
    return toEvent(row);
  });
}

export async function listCalendarOccurrences(
  pool: Pool,
  input: {
    workspaceId: string;
    start: Date;
    end: Date;
    limit?: number | undefined;
  },
): Promise<CalendarOccurrenceRecord[]> {
  const result = await pool.query(
    `select *
     from "calendar_events"
     where "workspace_id" = $1
       and (
         ("recurrence_rule" is null and "starts_at" < $3 and "ends_at" > $2)
         or "recurrence_rule" is not null
       )
     order by "starts_at", "id"
     limit 5000`,
    [input.workspaceId, input.start, input.end],
  );
  const exceptions = await pool.query<{
    series_id: string;
    original_start_at: Date;
    action: "cancelled" | "modified";
    overrides: Record<string, unknown>;
  }>(
    `select "series_id","original_start_at","action","overrides"
     from "calendar_event_exceptions"
     where "workspace_id" = $1
       and "original_start_at" >= $2 - interval '1 year'
       and "original_start_at" < $3 + interval '1 year'`,
    [input.workspaceId, input.start, input.end],
  );
  const exceptionMap = new Map(
    exceptions.rows.map((item) => [item.series_id + ":" + item.original_start_at.toISOString(), item]),
  );

  const output: CalendarOccurrenceRecord[] = [];
  for (const row of result.rows) {
    const base = toEvent(row);
    if (!row.recurrence_rule) {
      output.push(base);
      continue;
    }
    const duration = row.ends_at.getTime() - row.starts_at.getTime();
    const occurrences = occurrencesBetween(
      row.starts_at,
      input.start,
      input.end,
      row.timezone,
      row.recurrence_rule,
      input.limit ?? 2000,
    );
    for (const start of occurrences) {
      const exception = exceptionMap.get(row.id + ":" + start.toISOString());
      if (exception?.action === "cancelled") continue;
      const overrides = exception?.overrides ?? {};
      const startsAt =
        typeof overrides.startsAt === "string" ? new Date(overrides.startsAt) : start;
      const endsAt =
        typeof overrides.endsAt === "string"
          ? new Date(overrides.endsAt)
          : new Date(startsAt.getTime() + duration);
      output.push({
        ...base,
        title: typeof overrides.title === "string" ? overrides.title : base.title,
        description:
          typeof overrides.description === "string" ? overrides.description : base.description,
        startsAt,
        endsAt,
        occurrenceStartAt: start,
        recurring: true,
      });
      if (output.length >= (input.limit ?? 2000)) break;
    }
    if (output.length >= (input.limit ?? 2000)) break;
  }
  return output
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id))
    .slice(0, input.limit ?? 2000);
}

function truncateRuleBefore(rule: string, occurrence: Date): string {
  const until = new Date(occurrence.getTime() - 1000);
  const stamp =
    until.getUTCFullYear().toString().padStart(4, "0") +
    (until.getUTCMonth() + 1).toString().padStart(2, "0") +
    until.getUTCDate().toString().padStart(2, "0") +
    "T" +
    until.getUTCHours().toString().padStart(2, "0") +
    until.getUTCMinutes().toString().padStart(2, "0") +
    until.getUTCSeconds().toString().padStart(2, "0") +
    "Z";
  const withoutUntil = rule
    .split(";")
    .filter((part) => !part.toUpperCase().startsWith("UNTIL="))
    .join(";");
  return withoutUntil + ";UNTIL=" + stamp;
}

export async function updateCalendarEvent(
  pool: Pool,
  input: {
    workspaceId: string;
    eventId: string;
    actorUserId: string;
    scope: "occurrence" | "future" | "series";
    occurrenceStartAt?: Date | undefined;
    cancelled?: boolean | undefined;
    expectedVersion?: number | undefined;
    patch: {
      title?: string | undefined;
      description?: string | undefined;
      startsAt?: Date | undefined;
      endsAt?: Date | undefined;
      allDay?: boolean | undefined;
      timezone?: string | undefined;
      recurrenceRule?: string | null | undefined;
      linkedNodeId?: string | null | undefined;
    };
  },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const current = await client.query<any>(
      `select * from "calendar_events"
       where "workspace_id" = $1 and "id" = $2
       for update`,
      [input.workspaceId, input.eventId],
    );
    const row = current.rows[0];
    if (!row) throw new Error("EVENT_NOT_FOUND");

    if (input.scope === "occurrence") {
      if (!input.occurrenceStartAt || !row.recurrence_rule) {
        throw new Error("OCCURRENCE_SCOPE_REQUIRES_RECURRING_EVENT");
      }
      await client.query(
        `insert into "calendar_event_exceptions"
           ("workspace_id","series_id","original_start_at","action","overrides","created_by_user_id")
         values ($1,$2,$3,$4::calendar_exception_action,$5::jsonb,$6)
         on conflict ("series_id","original_start_at")
         do update set "action" = excluded."action", "overrides" = excluded."overrides",
                       "updated_at" = now()`,
        [
          input.workspaceId,
          input.eventId,
          input.occurrenceStartAt,
          input.cancelled ? "cancelled" : "modified",
          JSON.stringify({
            ...(input.patch.title !== undefined ? { title: input.patch.title } : {}),
            ...(input.patch.description !== undefined ? { description: input.patch.description } : {}),
            ...(input.patch.startsAt ? { startsAt: input.patch.startsAt.toISOString() } : {}),
            ...(input.patch.endsAt ? { endsAt: input.patch.endsAt.toISOString() } : {}),
          }),
          input.actorUserId,
        ],
      );
      return;
    }

    if (input.scope === "future") {
      if (!input.occurrenceStartAt || !row.recurrence_rule) {
        throw new Error("FUTURE_SCOPE_REQUIRES_RECURRING_EVENT");
      }
      const duration = row.ends_at.getTime() - row.starts_at.getTime();
      await client.query(
        `update "calendar_events"
         set "recurrence_rule" = $3, "updated_by_user_id" = $4,
             "updated_at" = now(), "version" = "version" + 1
         where "workspace_id" = $1 and "id" = $2`,
        [
          input.workspaceId,
          input.eventId,
          truncateRuleBefore(row.recurrence_rule, input.occurrenceStartAt),
          input.actorUserId,
        ],
      );
      const newStart = input.patch.startsAt ?? input.occurrenceStartAt;
      const newEnd = input.patch.endsAt ?? new Date(newStart.getTime() + duration);
      await client.query(
        `insert into "calendar_events"
           ("workspace_id","title","description","starts_at","ends_at","all_day",
            "timezone","recurrence_rule","linked_node_id","created_by_user_id","updated_by_user_id")
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
        [
          input.workspaceId,
          input.patch.title ?? row.title,
          input.patch.description ?? row.description,
          newStart,
          newEnd,
          input.patch.allDay ?? row.all_day,
          input.patch.timezone ?? row.timezone,
          input.patch.recurrenceRule === null
            ? null
            : input.patch.recurrenceRule ?? row.recurrence_rule,
          input.patch.linkedNodeId === null
            ? null
            : input.patch.linkedNodeId ?? row.linked_node_id,
          input.actorUserId,
        ],
      );
      return;
    }

    const result = await client.query(
      `update "calendar_events"
       set "title" = coalesce($4,"title"),
           "description" = coalesce($5,"description"),
           "starts_at" = coalesce($6,"starts_at"),
           "ends_at" = coalesce($7,"ends_at"),
           "all_day" = coalesce($8,"all_day"),
           "timezone" = coalesce($9,"timezone"),
           "recurrence_rule" = case when $10::boolean then $11 else "recurrence_rule" end,
           "linked_node_id" = case when $12::boolean then $13::uuid else "linked_node_id" end,
           "updated_by_user_id" = $3,
           "updated_at" = now(),
           "version" = "version" + 1
       where "workspace_id" = $1 and "id" = $2
         and ($14::integer is null or "version" = $14)
       returning "id"`,
      [
        input.workspaceId,
        input.eventId,
        input.actorUserId,
        input.patch.title ?? null,
        input.patch.description ?? null,
        input.patch.startsAt ?? null,
        input.patch.endsAt ?? null,
        input.patch.allDay ?? null,
        input.patch.timezone ?? null,
        input.patch.recurrenceRule !== undefined,
        input.patch.recurrenceRule ?? null,
        input.patch.linkedNodeId !== undefined,
        input.patch.linkedNodeId ?? null,
        input.expectedVersion ?? null,
      ],
    );
    if ((result.rowCount ?? 0) === 0) throw new Error("EVENT_VERSION_CONFLICT");
  });
}

export async function deleteCalendarEvent(
  pool: Pool,
  input: {
    workspaceId: string;
    eventId: string;
    actorUserId: string;
    scope: "occurrence" | "future" | "series";
    occurrenceStartAt?: Date | undefined;
  },
): Promise<void> {
  if (input.scope === "occurrence") {
    await updateCalendarEvent(pool, { ...input, cancelled: true, patch: {} });
    return;
  }
  if (input.scope === "future") {
    const occurrenceStartAt = input.occurrenceStartAt;
    if (!occurrenceStartAt) {
      throw new Error("FUTURE_SCOPE_REQUIRES_RECURRING_EVENT");
    }
    await withWorkspaceTransaction(pool, async (client) => {
      const current = await client.query<{ recurrence_rule: string | null }>(
        `select "recurrence_rule"
         from "calendar_events"
         where "workspace_id" = $1 and "id" = $2
         for update`,
        [input.workspaceId, input.eventId],
      );
      const rule = current.rows[0]?.recurrence_rule;
      if (!rule) throw new Error("FUTURE_SCOPE_REQUIRES_RECURRING_EVENT");
      await client.query(
        `update "calendar_events"
         set "recurrence_rule" = $3,
             "updated_by_user_id" = $4,
             "updated_at" = now(),
             "version" = "version" + 1
         where "workspace_id" = $1 and "id" = $2`,
        [
          input.workspaceId,
          input.eventId,
          truncateRuleBefore(rule, occurrenceStartAt),
          input.actorUserId,
        ],
      );
      await client.query(
        `delete from "calendar_event_exceptions"
         where "workspace_id" = $1 and "series_id" = $2
           and "original_start_at" >= $3`,
        [input.workspaceId, input.eventId, input.occurrenceStartAt],
      );
    });
    return;
  }
  await pool.query(
    `delete from "calendar_events"
     where "workspace_id" = $1 and "id" = $2`,
    [input.workspaceId, input.eventId],
  );
}

function focusElapsed(row: any, now = new Date()): number {
  const accumulated = Number(row.accumulated_seconds ?? 0);
  if (row.status !== "running") return accumulated;
  const anchor = row.paused_at ?? row.updated_at ?? row.started_at;
  return accumulated + Math.max(0, Math.floor((now.getTime() - new Date(anchor).getTime()) / 1000));
}

function toFocus(row: any) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    taskId: row.task_id,
    status: row.status,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    endedAt: row.ended_at,
    accumulatedSeconds: focusElapsed(row),
    notes: row.notes,
  };
}

export async function listFocusSessions(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<any[]> {
  const result = await pool.query(
    `select * from "focus_sessions"
     where "workspace_id" = $1 and "user_id" = $2
     order by "started_at" desc
     limit 100`,
    [workspaceId, userId],
  );
  return result.rows.map(toFocus);
}

export async function mutateFocusSession(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    action: "start" | "pause" | "resume" | "complete" | "cancel";
    sessionId?: string | undefined;
    taskId?: string | undefined;
    notes?: string | undefined;
  },
): Promise<any> {
  return withWorkspaceTransaction(pool, async (client) => {
    if (input.action === "start") {
      const existing = await client.query(
        `select 1 from "focus_sessions"
         where "workspace_id" = $1 and "user_id" = $2
           and "status" in ('running','paused')
         limit 1`,
        [input.workspaceId, input.userId],
      );
      if ((existing.rowCount ?? 0) > 0) throw new Error("FOCUS_SESSION_ALREADY_ACTIVE");
      const result = await client.query(
        `insert into "focus_sessions" ("workspace_id","user_id","task_id")
         values ($1,$2,$3)
         returning *`,
        [input.workspaceId, input.userId, input.taskId ?? null],
      );
      return toFocus(result.rows[0]);
    }

    const current = await client.query(
      `select * from "focus_sessions"
       where "workspace_id" = $1 and "user_id" = $2 and "id" = $3
       for update`,
      [input.workspaceId, input.userId, input.sessionId],
    );
    const row = current.rows[0];
    if (!row) throw new Error("FOCUS_SESSION_NOT_FOUND");
    const now = new Date();
    let accumulated = Number(row.accumulated_seconds ?? 0);
    if (row.status === "running") {
      accumulated = focusElapsed(row, now);
    }
    const nextStatus =
      input.action === "pause"
        ? "paused"
        : input.action === "resume"
          ? "running"
          : input.action === "complete"
            ? "completed"
            : "cancelled";
    const result = await client.query(
      `update "focus_sessions"
       set "status" = $4::focus_session_status,
           "accumulated_seconds" = $5,
           "paused_at" = case when $4 = 'paused' then now() else null end,
           "ended_at" = case when $4 in ('completed','cancelled') then now() else null end,
           "notes" = coalesce($6,"notes"),
           "updated_at" = now()
       where "workspace_id" = $1 and "user_id" = $2 and "id" = $3
       returning *`,
      [
        input.workspaceId,
        input.userId,
        input.sessionId,
        nextStatus,
        accumulated,
        input.notes ?? null,
      ],
    );
    return toFocus(result.rows[0]);
  });
}
