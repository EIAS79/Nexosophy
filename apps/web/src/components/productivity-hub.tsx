"use client";

import type {
  CalendarEventRecord,
  FocusSession,
  NotificationPreferences,
  NotificationRecord,
  ReminderRecord,
  TaskProject,
  TaskRecord,
} from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { queueTaskMutation, readOfflineRecord, saveOfflineRecord, syncOfflineWorkspace } from "../lib/offline-client";
import styles from "./productivity-hub.module.css";

type Tab = "tasks" | "calendar" | "reminders" | "inbox" | "focus";
type CalendarView = "day" | "week" | "month" | "agenda";

type Analytics = {
  completedTasks30d: number;
  openTasks: number;
  focusMinutes30d: number;
};

type NotificationPayload = {
  items: NotificationRecord[];
  unread: number;
};

const DEFAULT_PREFS: NotificationPreferences = {
  webEnabled: true,
  emailEnabled: false,
  pushEnabled: false,
  digestMode: "immediate",
  quietStart: null,
  quietEnd: null,
  timezone: "UTC",
};

async function apiGet<T>(
  workspaceId: string,
  view: string,
  query?: URLSearchParams,
): Promise<T> {
  const params = query ?? new URLSearchParams();
  params.set("view", view);
  const response = await fetch(
    `/api/productivity/${workspaceId}?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Unable to load " + view + ".");
  return (await response.json()) as T;
}

async function apiPost<T>(
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/productivity/${workspaceId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (body.action === "createTask" || body.action === "updateTask" || body.action === "completeTask") {
      await queueTaskMutation(workspaceId, body);
      return { offlineQueued: true } as T;
    }
    throw error;
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Productivity request failed.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function localInputToIso(value: FormDataEntryValue | null): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function commaIds(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function calendarRange(anchor: Date, view: CalendarView) {
  const start = new Date(anchor);
  const end = new Date(anchor);
  if (view === "day") {
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 1);
  } else if (view === "week") {
    start.setHours(0, 0, 0, 0);
    const weekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - weekday);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (view === "month") {
    start.setHours(0, 0, 0, 0);
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else {
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 30);
  }
  return { start, end };
}

function TaskComposer({
  workspaceId,
  projects,
  onCreated,
}: {
  workspaceId: string;
  projects: TaskProject[];
  onCreated: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const dueAt = localInputToIso(data.get("dueAt"));
    const startAt = localInputToIso(data.get("startAt"));
    const timezone =
      String(data.get("timezone") ?? "").trim() ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";
    setStatus("Creating task…");
    try {
      const result = await apiPost<{ offlineQueued?: boolean }>(workspaceId, {
        action: "createTask",
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        projectId: String(data.get("projectId") ?? "") || undefined,
        parentTaskId: String(data.get("parentTaskId") ?? "") || undefined,
        priority: String(data.get("priority") ?? "none"),
        startAt,
        dueAt,
        timezone,
        recurrenceRule: String(data.get("recurrenceRule") ?? "").trim() || undefined,
        assignedUserId: String(data.get("assignedUserId") ?? "").trim() || undefined,
        linkedNodeId: String(data.get("linkedNodeId") ?? "").trim() || undefined,
        tagIds: commaIds(data.get("tagIds")),
        dependencyIds: commaIds(data.get("dependencyIds")),
      });
      form.reset();
      if (result?.offlineQueued) {
        setStatus("Task creation queued offline.");
      } else {
        setStatus("Task created.");
        onCreated();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Task creation failed.");
    }
  }

  return (
    <form className={styles.composer} onSubmit={(event) => void submit(event)}>
      <label className={styles.grow}>
        Task
        <input name="title" required maxLength={500} placeholder="What needs to happen?" />
      </label>
      <label>
        Project
        <select name="projectId">
          <option value="">Inbox</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select name="priority" defaultValue="none">
          {["none", "low", "medium", "high", "urgent"].map((priority) => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>
      </label>
      <label>
        Due
        <input name="dueAt" type="datetime-local" />
      </label>
      <Button type="submit">Add task</Button>
      <button
        className={styles.textButton}
        type="button"
        onClick={() => setAdvanced((value) => !value)}
      >
        {advanced ? "Hide details" : "More details"}
      </button>
      {advanced ? (
        <div className={styles.advanced}>
          <label>
            Description
            <textarea name="description" rows={3} maxLength={100000} />
          </label>
          <label>
            Start
            <input name="startAt" type="datetime-local" />
          </label>
          <label>
            Time zone
            <input
              name="timezone"
              defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
            />
          </label>
          <label>
            RRULE
            <input name="recurrenceRule" placeholder="FREQ=WEEKLY;BYDAY=MO,WE" />
          </label>
          <label>
            Assignee user ID
            <input name="assignedUserId" placeholder="Optional UUID" />
          </label>
          <label>
            Parent task ID
            <input name="parentTaskId" placeholder="For a subtask" />
          </label>
          <label>
            Dependency IDs
            <input name="dependencyIds" placeholder="uuid, uuid" />
          </label>
          <label>
            Tag IDs
            <input name="tagIds" placeholder="uuid, uuid" />
          </label>
          <label>
            Linked content node
            <input name="linkedNodeId" placeholder="Optional node UUID" />
          </label>
        </div>
      ) : null}
      <p className={styles.live} aria-live="polite">{status}</p>
    </form>
  );
}

export function ProductivityHub({
  workspaceId,
  initialTab = "tasks",
}: {
  workspaceId: string;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationPayload>({
    items: [],
    unread: 0,
  });
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFS);
  const [focus, setFocus] = useState<FocusSession[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    completedTasks30d: 0,
    openTasks: 0,
    focusMinutes30d: 0,
  });
  const [calendarView, setCalendarView] = useState<CalendarView>("agenda");
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [taskView, setTaskView] = useState<"list" | "board">("list");
  const [status, setStatus] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [focusSnapshotAt, setFocusSnapshotAt] = useState(Date.now());

  const loadTasks = useCallback(async () => {
    try {
      const payload = await apiGet<{ items: TaskRecord[] }>(workspaceId, "tasks");
      setTasks(payload.items);
      await saveOfflineRecord(workspaceId, "tasks", "list", payload);
    } catch (error) {
      const cached = await readOfflineRecord<{ items: TaskRecord[] }>(workspaceId, "tasks", "list");
      if (!cached) throw error;
      setTasks(cached.items);
    }
  }, [workspaceId]);

  const loadProjects = useCallback(async () => {
    try {
      const payload = await apiGet<{ items: TaskProject[] }>(workspaceId, "projects");
      setProjects(payload.items);
      await saveOfflineRecord(workspaceId, "task-projects", "list", payload);
    } catch (error) {
      const cached = await readOfflineRecord<{ items: TaskProject[] }>(workspaceId, "task-projects", "list");
      if (!cached) throw error;
      setProjects(cached.items);
    }
  }, [workspaceId]);

  const loadReminders = useCallback(async () => {
    const payload = await apiGet<{ items: ReminderRecord[] }>(workspaceId, "reminders");
    setReminders(payload.items);
  }, [workspaceId]);

  const loadInbox = useCallback(async () => {
    const [inbox, prefs] = await Promise.all([
      apiGet<NotificationPayload>(workspaceId, "notifications"),
      apiGet<NotificationPreferences>(workspaceId, "preferences"),
    ]);
    setNotifications(inbox);
    setPreferences(prefs);
  }, [workspaceId]);

  const loadFocus = useCallback(async () => {
    const [sessions, stats] = await Promise.all([
      apiGet<{ items: FocusSession[] }>(workspaceId, "focus"),
      apiGet<Analytics>(workspaceId, "analytics"),
    ]);
    setFocus(sessions.items);
    setFocusSnapshotAt(Date.now());
    setAnalytics(stats);
  }, [workspaceId]);

  const loadCalendar = useCallback(async () => {
    const range = calendarRange(anchor, calendarView);
    const query = new URLSearchParams({
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      limit: "2000",
    });
    const payload = await apiGet<{ items: CalendarEventRecord[] }>(
      workspaceId,
      "calendar",
      query,
    );
    setEvents(payload.items);
  }, [anchor, calendarView, workspaceId]);

  const refreshAll = useCallback(async () => {
    setStatus("Refreshing…");
    try {
      if (!navigator.onLine) {
        await Promise.all([loadTasks(), loadProjects()]);
        setStatus("Offline · showing encrypted cached tasks and projects.");
        return;
      }
      await Promise.all([
        loadTasks(),
        loadProjects(),
        loadReminders(),
        loadInbox(),
        loadFocus(),
      ]);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to refresh productivity data.");
    }
  }, [loadFocus, loadInbox, loadProjects, loadReminders, loadTasks]);

  useEffect(() => {
    void refreshAll();
    const online = () => { void syncOfflineWorkspace(workspaceId).then(() => refreshAll()).catch(() => undefined); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [refreshAll, workspaceId]);

  useEffect(() => {
    if (tab === "calendar") void loadCalendar();
  }, [loadCalendar, tab]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.pushState({}, "", url);
  }

  async function createProject() {
    const name = window.prompt("Project name")?.trim();
    if (!name) return;
    try {
      await apiPost(workspaceId, {
        action: "createProject",
        name,
        description: "",
      });
      await loadProjects();
      setStatus("Project created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Project creation failed.");
    }
  }

  async function complete(task: TaskRecord) {
    try {
      const result = await apiPost<{ offlineQueued?: boolean }>(workspaceId, {
        action: "completeTask",
        taskId: task.id,
        expectedVersion: task.version,
      });
      if (result?.offlineQueued) {
        setTasks((current) => {
          const next = current.map((item) =>
            item.id === task.id ? { ...item, status: "done" as const } : item,
          );
          void saveOfflineRecord(workspaceId, "tasks", "list", { items: next });
          return next;
        });
        setStatus("Task completion queued offline.");
        return;
      }
      await Promise.all([loadTasks(), loadFocus()]);
      setStatus(task.recurrenceRule ? "Occurrence completed; next occurrence generated." : "Task completed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Task completion failed.");
    }
  }

  async function updateTaskState(
    task: TaskRecord,
    patch: Record<string, unknown>,
  ) {
    try {
      const result = await apiPost<{ offlineQueued?: boolean }>(workspaceId, {
        action: "updateTask",
        taskId: task.id,
        expectedVersion: task.version,
        ...patch,
      });
      if (result?.offlineQueued) {
        setTasks((current) => {
          const next = current.map((item) =>
            item.id === task.id ? ({ ...item, ...patch } as TaskRecord) : item,
          );
          void saveOfflineRecord(workspaceId, "tasks", "list", { items: next });
          return next;
        });
        setStatus("Task update queued offline.");
        return;
      }
      await loadTasks();
      setStatus("Task updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Task update failed.");
    }
  }

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const at = localInputToIso(data.get("at"));
    if (!at) return;
    try {
      await apiPost(workspaceId, {
        action: "createReminder",
        title: String(data.get("title") ?? ""),
        message: String(data.get("message") ?? ""),
        at,
        timezone:
          String(data.get("timezone") ?? "") ||
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        recurrenceRule: String(data.get("recurrenceRule") ?? "").trim() || undefined,
        taskId: String(data.get("taskId") ?? "").trim() || undefined,
        eventId: String(data.get("eventId") ?? "").trim() || undefined,
        linkedNodeId: String(data.get("linkedNodeId") ?? "").trim() || undefined,
      });
      form.reset();
      await loadReminders();
      setStatus("Reminder scheduled.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reminder creation failed.");
    }
  }

  async function snooze(reminder: ReminderRecord) {
    const minutes = Number(window.prompt("Snooze for how many minutes?", "10") ?? "0");
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    await apiPost(workspaceId, {
      action: "snoozeReminder",
      reminderId: reminder.id,
      until: new Date(Date.now() + minutes * 60_000).toISOString(),
    });
    await loadReminders();
    setStatus("Reminder snoozed.");
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const startsAt = localInputToIso(data.get("startsAt"));
    const endsAt = localInputToIso(data.get("endsAt"));
    if (!startsAt || !endsAt) return;
    try {
      await apiPost(workspaceId, {
        action: "createEvent",
        title: String(data.get("title") ?? ""),
        description: String(data.get("description") ?? ""),
        startsAt,
        endsAt,
        allDay: data.get("allDay") === "on",
        timezone:
          String(data.get("timezone") ?? "") ||
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        recurrenceRule: String(data.get("recurrenceRule") ?? "").trim() || undefined,
        linkedNodeId: String(data.get("linkedNodeId") ?? "").trim() || undefined,
      });
      form.reset();
      await loadCalendar();
      setStatus("Calendar event created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Calendar event creation failed.");
    }
  }

  async function deleteOccurrence(item: CalendarEventRecord) {
    const scope = item.recurring
      ? window.prompt("Delete scope: occurrence, future, or series", "occurrence")
      : "series";
    if (!scope || !["occurrence", "future", "series"].includes(scope)) return;
    await apiPost(workspaceId, {
      action: "deleteEvent",
      eventId: item.id,
      scope,
      occurrenceStartAt: item.occurrenceStartAt
        ? new Date(item.occurrenceStartAt).toISOString()
        : undefined,
    });
    await loadCalendar();
    setStatus("Calendar change saved.");
  }

  async function focusAction(
    action: "start" | "pause" | "resume" | "complete" | "cancel",
    session?: FocusSession,
  ) {
    const notes =
      action === "complete"
        ? window.prompt("Session notes", session?.notes ?? "") ?? undefined
        : undefined;
    const taskId =
      action === "start"
        ? window.prompt("Optional task ID to focus on")?.trim() || undefined
        : undefined;
    try {
      await apiPost(workspaceId, {
        action: "focus",
        focusAction: action,
        sessionId: session?.id,
        taskId,
        notes,
      });
      await loadFocus();
      setStatus("Focus session updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Focus action failed.");
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = {
      webEnabled: data.get("webEnabled") === "on",
      emailEnabled: data.get("emailEnabled") === "on",
      pushEnabled: data.get("pushEnabled") === "on",
      digestMode: String(data.get("digestMode") ?? "immediate"),
      quietStart: String(data.get("quietStart") ?? "") || null,
      quietEnd: String(data.get("quietEnd") ?? "") || null,
      timezone:
        String(data.get("timezone") ?? "") ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    try {
      const updated = await apiPost<NotificationPreferences>(workspaceId, {
        action: "preferences",
        ...next,
      });
      setPreferences(updated);
      setStatus("Notification preferences saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preferences update failed.");
    }
  }

  const activeFocus = focus.find((session) =>
    session.status === "running" || session.status === "paused",
  );

  const focusSeconds = activeFocus
    ? activeFocus.accumulatedSeconds +
      (activeFocus.status === "running"
        ? Math.max(0, Math.floor((clock - focusSnapshotAt) / 1000))
        : 0)
    : 0;

  const calendarGroups = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>();
    for (const item of events) {
      const key = new Date(item.startsAt).toLocaleDateString();
      const group = map.get(key) ?? [];
      group.push(item);
      map.set(key, group);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <section className={styles.hub}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Productivity system</p>
          <h1>Tasks, time, reminders & activity</h1>
          <p>One durable scheduler and notification pipeline across workspace work.</p>
        </div>
        <div className={styles.analytics}>
          <span><strong>{analytics.openTasks}</strong> open tasks</span>
          <span><strong>{analytics.completedTasks30d}</strong> completed / 30d</span>
          <span><strong>{analytics.focusMinutes30d}</strong> focus min / 30d</span>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Productivity views">
        {([
          ["tasks", "Tasks"],
          ["calendar", "Calendar"],
          ["reminders", "Reminders"],
          ["inbox", `Inbox${notifications.unread ? " (" + notifications.unread + ")" : ""}`],
          ["focus", "Focus"],
        ] as const).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "tasks" ? (
        <div className={styles.stack}>
          <TaskComposer workspaceId={workspaceId} projects={projects} onCreated={() => void loadTasks()} />
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <h2>Tasks</h2>
                <p>Inbox, projects, subtasks, dependencies and recurring work.</p>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => void createProject()}>New project</Button>
                <button type="button" onClick={() => setTaskView((value) => value === "list" ? "board" : "list")}>
                  {taskView === "list" ? "Board view" : "List view"}
                </button>
              </div>
            </header>

            {taskView === "list" ? (
              <div className={styles.taskList}>
                {tasks.map((task) => (
                  <article key={task.id} className={styles.task}>
                    <button
                      className={styles.check}
                      type="button"
                      disabled={task.status === "done" || task.status === "cancelled"}
                      onClick={() => void complete(task)}
                      aria-label={`Complete ${task.title}`}
                    >
                      {task.status === "done" ? "✓" : "○"}
                    </button>
                    <div className={styles.taskBody}>
                      <strong>{task.title}</strong>
                      <span>
                        {task.priority} · {task.projectId ? "project" : "inbox"} · due {formatDate(task.dueAt)}
                        {task.recurrenceRule ? " · recurring" : ""}
                      </span>
                      {task.tags.length ? <small>Tags: {task.tags.map((tag) => tag.name).join(", ")}</small> : null}
                      {task.dependencyIds.length ? <small>Depends on {task.dependencyIds.length} task(s)</small> : null}
                      {task.linkedNodeId ? (
                        <a href={`/app/workspaces/${workspaceId}/node/${task.linkedNodeId}`}>Linked content</a>
                      ) : null}
                    </div>
                    <div className={styles.taskControls}>
                      <select
                        aria-label={`Status for ${task.title}`}
                        value={task.status}
                        onChange={(event) =>
                          void updateTaskState(task, { status: event.currentTarget.value })
                        }
                      >
                        {["todo","in_progress","waiting","done","cancelled"].map((value) => (
                          <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                        ))}
                      </select>
                      <select
                        aria-label={`Priority for ${task.title}`}
                        value={task.priority}
                        onChange={(event) =>
                          void updateTaskState(task, { priority: event.currentTarget.value })
                        }
                      >
                        {["none","low","medium","high","urgent"].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
                {tasks.length === 0 ? <div className={styles.empty}>No tasks yet.</div> : null}
              </div>
            ) : (
              <div className={styles.board}>
                {(["todo","in_progress","waiting","done"] as const).map((state) => (
                  <section key={state}>
                    <h3>{state.replaceAll("_", " ")}</h3>
                    {tasks.filter((task) => task.status === state).map((task) => (
                      <article key={task.id}>
                        <strong>{task.title}</strong>
                        <small>{task.priority} · {formatDate(task.dueAt)}</small>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <h2>Projects</h2>
            </header>
            <div className={styles.chips}>
              {projects.map((project) => (
                <span key={project.id}>{project.name}</span>
              ))}
              {projects.length === 0 ? <span>No projects yet.</span> : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "calendar" ? (
        <section className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2>Calendar</h2>
              <p>Timezone-aware recurring events with occurrence/future/series semantics.</p>
            </div>
            <div className={styles.actions}>
              {(["day","week","month","agenda"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={calendarView === view}
                  onClick={() => setCalendarView(view)}
                >
                  {view}
                </button>
              ))}
              <button type="button" onClick={() => setAnchor(new Date())}>Today</button>
            </div>
          </header>

          <form className={styles.composer} onSubmit={(event) => void createEvent(event)}>
            <label className={styles.grow}>Title<input name="title" required /></label>
            <label>Start<input name="startsAt" type="datetime-local" required /></label>
            <label>End<input name="endsAt" type="datetime-local" required /></label>
            <label>Timezone<input name="timezone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} /></label>
            <label>RRULE<input name="recurrenceRule" placeholder="FREQ=WEEKLY;BYDAY=MO" /></label>
            <label>Linked node<input name="linkedNodeId" placeholder="Optional UUID" /></label>
            <label className={styles.checkbox}><input name="allDay" type="checkbox" /> All day</label>
            <Button type="submit">Add event</Button>
            <label className={styles.wide}>Description<textarea name="description" rows={2} /></label>
          </form>

          <div className={styles.calendarNav}>
            <button
              type="button"
              onClick={() => setAnchor((current) => {
                const next = new Date(current);
                next.setDate(next.getDate() - (calendarView === "month" ? 30 : calendarView === "week" ? 7 : 1));
                return next;
              })}
            >
              ← Previous
            </button>
            <strong>{calendarRange(anchor, calendarView).start.toLocaleDateString()} — {calendarRange(anchor, calendarView).end.toLocaleDateString()}</strong>
            <button
              type="button"
              onClick={() => setAnchor((current) => {
                const next = new Date(current);
                next.setDate(next.getDate() + (calendarView === "month" ? 30 : calendarView === "week" ? 7 : 1));
                return next;
              })}
            >
              Next →
            </button>
          </div>

          <div className={calendarView === "month" ? styles.month : styles.agenda}>
            {calendarGroups.map(([day, dayEvents]) => (
              <section key={day} className={styles.day}>
                <h3>{day}</h3>
                {dayEvents.map((item) => (
                  <article key={item.id + ":" + String(item.occurrenceStartAt ?? item.startsAt)}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.allDay ? "All day" : new Date(item.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {item.recurring ? " · recurring" : ""}
                      </span>
                    </div>
                    <button type="button" onClick={() => void deleteOccurrence(item)}>Delete</button>
                  </article>
                ))}
              </section>
            ))}
            {events.length === 0 ? <div className={styles.empty}>No events in this range.</div> : null}
          </div>
        </section>
      ) : null}

      {tab === "reminders" ? (
        <section className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2>Reminders</h2>
              <p>Durable, deduplicated occurrences with outage catch-up and snooze.</p>
            </div>
          </header>
          <form className={styles.composer} onSubmit={(event) => void createReminder(event)}>
            <label className={styles.grow}>Title<input name="title" required /></label>
            <label>When<input name="at" type="datetime-local" required /></label>
            <label>Timezone<input name="timezone" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} /></label>
            <label>RRULE<input name="recurrenceRule" placeholder="FREQ=DAILY" /></label>
            <label>Task ID<input name="taskId" /></label>
            <label>Event ID<input name="eventId" /></label>
            <label>Node ID<input name="linkedNodeId" /></label>
            <Button type="submit">Schedule</Button>
            <label className={styles.wide}>Message<textarea name="message" rows={2} /></label>
          </form>
          <div className={styles.taskList}>
            {reminders.map((reminder) => (
              <article className={styles.task} key={reminder.id}>
                <div className={styles.taskBody}>
                  <strong>{reminder.title}</strong>
                  <span>
                    Next {formatDate(reminder.snoozedUntil ?? reminder.nextOccurrenceAt)}
                    {reminder.recurrenceRule ? " · recurring" : ""}
                  </span>
                  <small>{reminder.message}</small>
                </div>
                <div className={styles.actions}>
                  <button type="button" onClick={() => void snooze(reminder)}>Snooze</button>
                  <button
                    type="button"
                    onClick={() =>
                      void apiPost(workspaceId, {
                        action: "cancelReminder",
                        reminderId: reminder.id,
                      }).then(loadReminders)
                    }
                  >
                    Cancel
                  </button>
                </div>
              </article>
            ))}
            {reminders.length === 0 ? <div className={styles.empty}>No reminders.</div> : null}
          </div>
        </section>
      ) : null}

      {tab === "inbox" ? (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <h2>Notification inbox</h2>
                <p>{notifications.unread} unread</p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  void apiPost(workspaceId, { action: "readAllNotifications" }).then(loadInbox)
                }
              >
                Mark all read
              </Button>
            </header>
            <div className={styles.inbox}>
              {notifications.items.map((item) => (
                <article key={item.id} data-read={item.readAt ? "true" : "false"}>
                  <div>
                    <span>{item.category}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <small>{formatDate(item.createdAt)}</small>
                  </div>
                  <div className={styles.actions}>
                    {item.actionUrl ? <a href={item.actionUrl}>Open</a> : null}
                    {!item.readAt ? (
                      <button
                        type="button"
                        onClick={() =>
                          void apiPost(workspaceId, {
                            action: "readNotification",
                            notificationId: item.id,
                          }).then(loadInbox)
                        }
                      >
                        Mark read
                      </button>
                    ) : null}
                    {item.sourceType && item.sourceId ? (
                      <button
                        type="button"
                        onClick={() =>
                          void apiPost(workspaceId, {
                            action: "subscription",
                            sourceType: item.sourceType,
                            sourceId: item.sourceId,
                            muted: true,
                          }).then(() => setStatus("Source muted."))
                        }
                      >
                        Mute source
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {notifications.items.length === 0 ? <div className={styles.empty}>Inbox is empty.</div> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHead}><h2>Delivery preferences</h2></header>
            <form className={styles.preferences} onSubmit={(event) => void savePreferences(event)}>
              <label className={styles.checkbox}>
                <input name="webEnabled" type="checkbox" defaultChecked={preferences.webEnabled} key={"web"+String(preferences.webEnabled)} />
                In-app
              </label>
              <label className={styles.checkbox}>
                <input name="emailEnabled" type="checkbox" defaultChecked={preferences.emailEnabled} key={"email"+String(preferences.emailEnabled)} />
                Email
              </label>
              <label className={styles.checkbox}>
                <input name="pushEnabled" type="checkbox" defaultChecked={preferences.pushEnabled} key={"push"+String(preferences.pushEnabled)} />
                Push
              </label>
              <label>Digest
                <select name="digestMode" defaultValue={preferences.digestMode} key={"digest"+preferences.digestMode}>
                  <option value="immediate">Immediate</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </label>
              <label>Quiet starts
                <input name="quietStart" type="time" defaultValue={preferences.quietStart ?? ""} />
              </label>
              <label>Quiet ends
                <input name="quietEnd" type="time" defaultValue={preferences.quietEnd ?? ""} />
              </label>
              <label>Timezone
                <input name="timezone" defaultValue={preferences.timezone} />
              </label>
              <Button type="submit">Save preferences</Button>
            </form>
          </section>
        </div>
      ) : null}

      {tab === "focus" ? (
        <section className={styles.focusPanel}>
          <div className={styles.timer}>
            <p className="eyebrow">Focus session</p>
            <strong>
              {Math.floor(focusSeconds / 3600).toString().padStart(2, "0")}:
              {Math.floor((focusSeconds % 3600) / 60).toString().padStart(2, "0")}:
              {(focusSeconds % 60).toString().padStart(2, "0")}
            </strong>
            <span>{activeFocus?.status ?? "idle"}</span>
          </div>
          <div className={styles.focusActions}>
            {!activeFocus ? <Button onClick={() => void focusAction("start")}>Start focus</Button> : null}
            {activeFocus?.status === "running" ? <Button variant="secondary" onClick={() => void focusAction("pause", activeFocus)}>Pause</Button> : null}
            {activeFocus?.status === "paused" ? <Button onClick={() => void focusAction("resume", activeFocus)}>Resume</Button> : null}
            {activeFocus ? (
              <>
                <Button variant="secondary" onClick={() => void focusAction("complete", activeFocus)}>Complete</Button>
                <button type="button" onClick={() => void focusAction("cancel", activeFocus)}>Cancel</button>
              </>
            ) : null}
          </div>
          <div className={styles.focusHistory}>
            <h2>Session history</h2>
            {focus.slice(0, 20).map((session) => (
              <article key={session.id}>
                <strong>{Math.round(session.accumulatedSeconds / 60)} min</strong>
                <span>{formatDate(session.startedAt)} · {session.status}</span>
                {session.notes ? <p>{session.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <p className={styles.live} aria-live="polite">{status}</p>
    </section>
  );
}