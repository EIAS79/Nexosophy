import { NextResponse, type NextRequest } from "next/server";

import { NexosophyApiError, nexosophyApi } from "../../../../lib/api-server";

function errorResponse(error: unknown) {
  if (error instanceof NexosophyApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  throw error;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const view = request.nextUrl.searchParams.get("view") ?? "tasks";
  const query = new URLSearchParams(request.nextUrl.searchParams);
  query.delete("view");
  try {
    const path =
      view === "projects"
        ? `/v1/workspaces/${workspaceId}/projects`
        : view === "reminders"
          ? `/v1/workspaces/${workspaceId}/reminders`
          : view === "calendar"
            ? `/v1/workspaces/${workspaceId}/calendar?${query.toString()}`
            : view === "focus"
              ? `/v1/workspaces/${workspaceId}/focus`
              : view === "notifications"
                ? `/v1/workspaces/${workspaceId}/notifications`
                : view === "preferences"
                  ? `/v1/workspaces/${workspaceId}/notification-preferences`
                  : view === "analytics"
                    ? `/v1/workspaces/${workspaceId}/productivity/analytics`
                    : `/v1/workspaces/${workspaceId}/tasks?${query.toString()}`;
    return NextResponse.json(await nexosophyApi(path));
  } catch (error) {
    return errorResponse(error);
  }
}

type ActionBody = {
  action?: string;
  [key: string]: unknown;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const body = (await request.json()) as ActionBody;
  try {
    if (body.action === "createProject") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/projects`, {
          method: "POST",
          body: JSON.stringify({
            name: body.name,
            description: body.description ?? "",
            color: body.color,
          }),
        }),
        { status: 201 },
      );
    }
    if (body.action === "createTask") {
      const { action: _action, ...payload } = body;
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/tasks`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
        { status: 201 },
      );
    }
    if (body.action === "updateTask") {
      const { action: _action, taskId, ...payload } = body;
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/tasks/${encodeURIComponent(String(taskId ?? ""))}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        ),
      );
    }
    if (body.action === "completeTask") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/tasks/${encodeURIComponent(
            String(body.taskId ?? ""),
          )}/complete`,
          { method: "POST" },
        ),
      );
    }
    if (body.action === "createReminder") {
      const { action: _action, ...payload } = body;
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/reminders`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
        { status: 201 },
      );
    }
    if (body.action === "snoozeReminder") {
      return NextResponse.json(
        await nexosophyApi(
          `/v1/workspaces/${workspaceId}/reminders/${encodeURIComponent(
            String(body.reminderId ?? ""),
          )}/snooze`,
          {
            method: "POST",
            body: JSON.stringify({ until: body.until }),
          },
        ),
      );
    }
    if (body.action === "cancelReminder") {
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/reminders/${encodeURIComponent(
          String(body.reminderId ?? ""),
        )}`,
        { method: "DELETE" },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "createEvent") {
      const { action: _action, ...payload } = body;
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/calendar`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
        { status: 201 },
      );
    }
    if (body.action === "updateEvent") {
      const { action: _action, eventId, ...payload } = body;
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/calendar/${encodeURIComponent(
          String(eventId ?? ""),
        )}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "deleteEvent") {
      const query = new URLSearchParams({
        scope: String(body.scope ?? "series"),
      });
      if (body.occurrenceStartAt) {
        query.set("occurrenceStartAt", String(body.occurrenceStartAt));
      }
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/calendar/${encodeURIComponent(
          String(body.eventId ?? ""),
        )}?${query.toString()}`,
        { method: "DELETE" },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "focus") {
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/focus`, {
          method: "POST",
          body: JSON.stringify({
            action: body.focusAction,
            sessionId: body.sessionId,
            taskId: body.taskId,
            notes: body.notes,
          }),
        }),
      );
    }
    if (body.action === "readNotification") {
      await nexosophyApi(
        `/v1/workspaces/${workspaceId}/notifications/${encodeURIComponent(
          String(body.notificationId ?? ""),
        )}/read`,
        { method: "POST" },
      );
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "readAllNotifications") {
      await nexosophyApi(`/v1/workspaces/${workspaceId}/notifications/read-all`, {
        method: "POST",
      });
      return new NextResponse(null, { status: 204 });
    }
    if (body.action === "preferences") {
      const { action: _action, ...payload } = body;
      return NextResponse.json(
        await nexosophyApi(`/v1/workspaces/${workspaceId}/notification-preferences`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
      );
    }
    if (body.action === "subscription") {
      await nexosophyApi(`/v1/workspaces/${workspaceId}/notification-subscriptions`, {
        method: "POST",
        body: JSON.stringify({
          sourceType: body.sourceType,
          sourceId: body.sourceId,
          muted: body.muted,
        }),
      });
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Unknown productivity action." } },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
