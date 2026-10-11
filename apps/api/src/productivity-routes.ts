import type { AuthVerifier } from "@nexosophy/auth";
import {
  calendarRangeQuerySchema,
  createCalendarEventRequestSchema,
  createReminderRequestSchema,
  createTaskProjectRequestSchema,
  createTaskRequestSchema,
  snoozeReminderRequestSchema,
  taskListQuerySchema,
  updateCalendarEventRequestSchema,
  updateNotificationPreferencesRequestSchema,
  updateTaskRequestSchema,
} from "@nexosophy/contracts";
import {
  cancelReminder,
  completeTask,
  createCalendarEvent,
  createReminder,
  createTask,
  createTaskProject,
  getNotificationPreferences,
  listCalendarOccurrences,
  listFocusSessions,
  listNotifications,
  listReminders,
  listTaskProjects,
  listTasks,
  markNotificationRead,
  mutateFocusSession,
  productivityAnalytics,
  setNotificationPreferences,
  setNotificationSubscription,
  snoozeReminder,
  updateCalendarEvent,
  updateTask,
  deleteCalendarEvent,
} from "@nexosophy/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

function domainError(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): unknown {
  const code = error instanceof Error ? error.message : "PRODUCTIVITY_ERROR";
  const conflicts = new Set([
    "TASK_VERSION_CONFLICT",
    "EVENT_VERSION_CONFLICT",
    "TASK_DEPENDENCY_INCOMPLETE",
    "FOCUS_SESSION_ALREADY_ACTIVE",
  ]);
  const notFound = new Set([
    "TASK_NOT_FOUND",
    "REMINDER_NOT_FOUND",
    "EVENT_NOT_FOUND",
    "FOCUS_SESSION_NOT_FOUND",
  ]);
  return sendWorkspaceError(
    reply,
    request.id,
    conflicts.has(code) ? 409 : notFound.has(code) ? 404 : 400,
    code,
    code
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (value) => value.toUpperCase()) + ".",
  );
}

export async function registerProductivityRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.get("/v1/workspaces/:workspaceId/projects", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return { items: await listTaskProjects(pool, workspaceId) };
  });

  app.post("/v1/workspaces/:workspaceId/projects", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createTaskProjectRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))) return;
    const project = await createTaskProject(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      name: body.name,
      description: body.description,
      color: body.color,
      requestId: request.id,
    });
    reply.code(201);
    return project;
  });

  app.get("/v1/workspaces/:workspaceId/tasks", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = taskListQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return listTasks(pool, {
      workspaceId,
      status: query.status,
      projectId: query.projectId,
      dueBefore: query.dueBefore ? new Date(query.dueBefore) : undefined,
      assignedUserId: query.assignedUserId,
      cursor: query.cursor,
      limit: query.limit,
    });
  });

  app.post("/v1/workspaces/:workspaceId/tasks", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createTaskRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))) return;
    try {
      const task = await createTask(pool, {
        workspaceId,
        actorUserId: principal.internalUserId,
        title: body.title,
        description: body.description,
        projectId: body.projectId,
        parentTaskId: body.parentTaskId,
        priority: body.priority,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        timezone: body.timezone,
        recurrenceRule: body.recurrenceRule,
        assignedUserId: body.assignedUserId,
        linkedNodeId: body.linkedNodeId,
        tagIds: body.tagIds,
        dependencyIds: body.dependencyIds,
        requestId: request.id,
      });
      reply.code(201);
      return task;
    } catch (error) {
      return domainError(error, request, reply);
    }
  });

  app.patch("/v1/workspaces/:workspaceId/tasks/:taskId", async (request, reply) => {
    const { workspaceId, taskId } = request.params as { workspaceId: string; taskId: string };
    const body = updateTaskRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    try {
      return await updateTask(pool, {
        workspaceId,
        taskId,
        actorUserId: principal.internalUserId,
        expectedVersion: body.expectedVersion,
        title: body.title,
        description: body.description,
        projectId: body.projectId,
        parentTaskId: body.parentTaskId,
        status: body.status,
        priority: body.priority,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        timezone: body.timezone,
        recurrenceRule: body.recurrenceRule,
        assignedUserId: body.assignedUserId,
        linkedNodeId: body.linkedNodeId,
        tagIds: body.tagIds,
        dependencyIds: body.dependencyIds,
        requestId: request.id,
      });
    } catch (error) {
      return domainError(error, request, reply);
    }
  });

  app.post("/v1/workspaces/:workspaceId/tasks/:taskId/complete", async (request, reply) => {
    const { workspaceId, taskId } = request.params as { workspaceId: string; taskId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    try {
      return await completeTask(pool, {
        workspaceId,
        taskId,
        actorUserId: principal.internalUserId,
        requestId: request.id,
      });
    } catch (error) {
      return domainError(error, request, reply);
    }
  });

  app.get("/v1/workspaces/:workspaceId/productivity/analytics", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return productivityAnalytics(pool, workspaceId, principal.internalUserId);
  });

  app.get("/v1/workspaces/:workspaceId/reminders", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return { items: await listReminders(pool, workspaceId, principal.internalUserId) };
  });

  app.post("/v1/workspaces/:workspaceId/reminders", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createReminderRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))) return;
    const reminder = await createReminder(pool, {
      workspaceId,
      userId: principal.internalUserId,
      title: body.title,
      message: body.message,
      at: new Date(body.at),
      timezone: body.timezone,
      recurrenceRule: body.recurrenceRule,
      taskId: body.taskId,
      eventId: body.eventId,
      linkedNodeId: body.linkedNodeId,
    });
    reply.code(201);
    return reminder;
  });

  app.post("/v1/workspaces/:workspaceId/reminders/:reminderId/snooze", async (request, reply) => {
    const { workspaceId, reminderId } = request.params as { workspaceId: string; reminderId: string };
    const body = snoozeReminderRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    try {
      return await snoozeReminder(
        pool,
        workspaceId,
        principal.internalUserId,
        reminderId,
        new Date(body.until),
      );
    } catch (error) {
      return domainError(error, request, reply);
    }
  });

  app.delete("/v1/workspaces/:workspaceId/reminders/:reminderId", async (request, reply) => {
    const { workspaceId, reminderId } = request.params as { workspaceId: string; reminderId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    const removed = await cancelReminder(pool, workspaceId, principal.internalUserId, reminderId);
    reply.code(removed ? 204 : 404);
    return;
  });

  app.get("/v1/workspaces/:workspaceId/calendar", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = calendarRangeQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return {
      items: await listCalendarOccurrences(pool, {
        workspaceId,
        start: new Date(query.start),
        end: new Date(query.end),
        limit: query.limit,
      }),
    };
  });

  app.post("/v1/workspaces/:workspaceId/calendar", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = createCalendarEventRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.create", request, reply))) return;
    const event = await createCalendarEvent(pool, {
      workspaceId,
      actorUserId: principal.internalUserId,
      title: body.title,
      description: body.description,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      allDay: body.allDay,
      timezone: body.timezone,
      recurrenceRule: body.recurrenceRule,
      linkedNodeId: body.linkedNodeId,
      requestId: request.id,
    });
    reply.code(201);
    return event;
  });

  app.patch("/v1/workspaces/:workspaceId/calendar/:eventId", async (request, reply) => {
    const { workspaceId, eventId } = request.params as { workspaceId: string; eventId: string };
    const body = updateCalendarEventRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.update", request, reply))) return;
    try {
      await updateCalendarEvent(pool, {
        workspaceId,
        eventId,
        actorUserId: principal.internalUserId,
        scope: body.scope,
        occurrenceStartAt: body.occurrenceStartAt ? new Date(body.occurrenceStartAt) : undefined,
        cancelled: body.cancelled,
        expectedVersion: body.expectedVersion,
        patch: {
          title: body.title,
          description: body.description,
          startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
          endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
          allDay: body.allDay,
          timezone: body.timezone,
          recurrenceRule: body.recurrenceRule,
          linkedNodeId: body.linkedNodeId,
        },
      });
      reply.code(204);
      return;
    } catch (error) {
      return domainError(error, request, reply);
    }
  });

  app.delete("/v1/workspaces/:workspaceId/calendar/:eventId", async (request, reply) => {
    const { workspaceId, eventId } = request.params as { workspaceId: string; eventId: string };
    const query = request.query as { scope?: string; occurrenceStartAt?: string };
    const scope =
      query.scope === "occurrence" || query.scope === "future" ? query.scope : "series";
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.delete", request, reply))) return;
    try {
      await deleteCalendarEvent(pool, {
        workspaceId,
        eventId,
        actorUserId: principal.internalUserId,
        scope,
        occurrenceStartAt: query.occurrenceStartAt ? new Date(query.occurrenceStartAt) : undefined,
      });
      reply.code(204);
      return;
    } catch (error) {
      return domainError(error, request, reply);
    }
  });

  app.get("/v1/workspaces/:workspaceId/focus", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return { items: await listFocusSessions(pool, workspaceId, principal.internalUserId) };
  });

  app.post("/v1/workspaces/:workspaceId/focus", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = request.body as {
      action?: "start" | "pause" | "resume" | "complete" | "cancel";
      sessionId?: string;
      taskId?: string;
      notes?: string;
    };
    const action =
      body?.action === "pause" ||
      body?.action === "resume" ||
      body?.action === "complete" ||
      body?.action === "cancel"
        ? body.action
        : "start";
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    try {
      return await mutateFocusSession(pool, {
        workspaceId,
        userId: principal.internalUserId,
        action,
        sessionId: body?.sessionId,
        taskId: body?.taskId,
        notes: typeof body?.notes === "string" ? body.notes.slice(0, 100_000) : undefined,
      });
    } catch (error) {
      return domainError(error, request, reply);
    }
  });

  app.get("/v1/workspaces/:workspaceId/notifications", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return listNotifications(pool, workspaceId, principal.internalUserId);
  });

  app.post("/v1/workspaces/:workspaceId/notifications/read-all", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    await markNotificationRead(pool, workspaceId, principal.internalUserId);
    reply.code(204);
    return;
  });

  app.post("/v1/workspaces/:workspaceId/notifications/:notificationId/read", async (request, reply) => {
    const { workspaceId, notificationId } = request.params as {
      workspaceId: string;
      notificationId: string;
    };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    await markNotificationRead(pool, workspaceId, principal.internalUserId, notificationId);
    reply.code(204);
    return;
  });

  app.get("/v1/workspaces/:workspaceId/notification-preferences", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return getNotificationPreferences(pool, workspaceId, principal.internalUserId);
  });

  app.put("/v1/workspaces/:workspaceId/notification-preferences", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = updateNotificationPreferencesRequestSchema.parse(request.body);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    return setNotificationPreferences(pool, workspaceId, principal.internalUserId, body);
  });

  app.post("/v1/workspaces/:workspaceId/notification-subscriptions", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const body = request.body as { sourceType?: string; sourceId?: string; muted?: boolean };
    if (
      typeof body?.sourceType !== "string" ||
      typeof body?.sourceId !== "string" ||
      body.sourceType.length > 120 ||
      body.sourceId.length > 200
    ) {
      return sendWorkspaceError(reply, request.id, 400, "VALIDATION_ERROR", "Invalid notification subscription.");
    }
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (!(await authorizeWorkspace(pool, principal, workspaceId, "content.read", request, reply))) return;
    await setNotificationSubscription(pool, {
      workspaceId,
      userId: principal.internalUserId,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      muted: body.muted !== false,
    });
    reply.code(204);
    return;
  });
}
