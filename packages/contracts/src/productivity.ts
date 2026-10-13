import { z } from "zod";

const uuidSchema = z.string().uuid();

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().min(1).max(120).refine(validTimeZone, {
  message: "Invalid IANA time zone.",
});

export const recurrenceRuleSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/i.test(value),
    { message: "Unsupported RRULE syntax." },
  );

export const taskStatusSchema = z.enum(["todo", "in_progress", "waiting", "done", "cancelled"]);
export const taskPrioritySchema = z.enum(["none", "low", "medium", "high", "urgent"]);

export const taskProjectSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string(),
  description: z.string(),
  color: z.string().nullable(),
  version: z.number().int().positive(),
  archivedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TaskProject = z.infer<typeof taskProjectSchema>;

export const createTaskProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(20_000).default(""),
  color: z.string().trim().max(64).optional(),
});

export const taskSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  projectId: uuidSchema.nullable(),
  parentTaskId: uuidSchema.nullable(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  startAt: z.coerce.date().nullable(),
  dueAt: z.coerce.date().nullable(),
  timezone: timeZoneSchema,
  recurrenceRule: z.string().nullable(),
  assignedUserId: uuidSchema.nullable(),
  linkedNodeId: uuidSchema.nullable(),
  version: z.number().int().positive(),
  completedAt: z.coerce.date().nullable(),
  tags: z.array(z.object({ id: uuidSchema, name: z.string(), color: z.string().nullable() })),
  dependencyIds: z.array(uuidSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TaskRecord = z.infer<typeof taskSchema>;

export const createTaskRequestSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(100_000).default(""),
  projectId: uuidSchema.optional(),
  parentTaskId: uuidSchema.optional(),
  priority: taskPrioritySchema.default("none"),
  startAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  timezone: timeZoneSchema.default("UTC"),
  recurrenceRule: recurrenceRuleSchema.optional(),
  assignedUserId: uuidSchema.optional(),
  linkedNodeId: uuidSchema.optional(),
  tagIds: z.array(uuidSchema).max(50).default([]),
  dependencyIds: z.array(uuidSchema).max(100).default([]),
});

export const updateTaskRequestSchema = createTaskRequestSchema.partial().extend({
  status: taskStatusSchema.optional(),
  expectedVersion: z.number().int().positive(),
});

export const taskListQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  projectId: uuidSchema.optional(),
  dueBefore: z.string().datetime().optional(),
  assignedUserId: uuidSchema.optional(),
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const reminderSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  userId: uuidSchema,
  taskId: uuidSchema.nullable(),
  eventId: uuidSchema.nullable(),
  linkedNodeId: uuidSchema.nullable(),
  title: z.string(),
  message: z.string(),
  nextOccurrenceAt: z.coerce.date(),
  timezone: timeZoneSchema,
  recurrenceRule: z.string().nullable(),
  status: z.enum(["active", "completed", "cancelled"]),
  snoozedUntil: z.coerce.date().nullable(),
  lastFiredAt: z.coerce.date().nullable(),
});
export type ReminderRecord = z.infer<typeof reminderSchema>;

export const createReminderRequestSchema = z.object({
  title: z.string().trim().min(1).max(500),
  message: z.string().max(20_000).default(""),
  at: z.string().datetime(),
  timezone: timeZoneSchema.default("UTC"),
  recurrenceRule: recurrenceRuleSchema.optional(),
  taskId: uuidSchema.optional(),
  eventId: uuidSchema.optional(),
  linkedNodeId: uuidSchema.optional(),
});

export const snoozeReminderRequestSchema = z.object({
  until: z.string().datetime(),
});

export const calendarEventSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  title: z.string(),
  description: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean(),
  timezone: timeZoneSchema,
  recurrenceRule: z.string().nullable(),
  linkedNodeId: uuidSchema.nullable(),
  version: z.number().int().positive(),
  occurrenceStartAt: z.coerce.date().optional(),
  recurring: z.boolean().default(false),
});
export type CalendarEventRecord = z.infer<typeof calendarEventSchema>;

const calendarEventInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(100_000).default(""),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  timezone: timeZoneSchema.default("UTC"),
  recurrenceRule: recurrenceRuleSchema.optional(),
  linkedNodeId: uuidSchema.optional(),
});

export const createCalendarEventRequestSchema = calendarEventInputSchema.refine(
  (value) => new Date(value.endsAt) > new Date(value.startsAt),
  { message: "Event end must be after start." },
);

export const updateCalendarEventRequestSchema = calendarEventInputSchema
  .partial()
  .extend({
    expectedVersion: z.number().int().positive().optional(),
    scope: z.enum(["occurrence", "future", "series"]).default("series"),
    occurrenceStartAt: z.string().datetime().optional(),
    cancelled: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.startsAt &&
      value.endsAt &&
      new Date(value.endsAt) <= new Date(value.startsAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Event end must be after start.",
      });
    }
    if (
      (value.scope === "occurrence" || value.scope === "future") &&
      !value.occurrenceStartAt
    ) {
      context.addIssue({
        code: "custom",
        message: "occurrenceStartAt is required for occurrence/future scope.",
      });
    }
  });

export const calendarRangeQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  limit: z.coerce.number().int().min(1).max(5000).default(2000),
});

export const notificationSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  userId: uuidSchema,
  category: z.string(),
  title: z.string(),
  body: z.string(),
  actionUrl: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type NotificationRecord = z.infer<typeof notificationSchema>;

export const notificationPreferencesSchema = z.object({
  webEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  digestMode: z.enum(["immediate", "hourly", "daily"]),
  quietStart: z.string().nullable(),
  quietEnd: z.string().nullable(),
  timezone: timeZoneSchema,
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferencesRequestSchema = z.object({
  webEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(false),
  digestMode: z.enum(["immediate", "hourly", "daily"]).default("immediate"),
  quietStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  quietEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  timezone: timeZoneSchema.default("UTC"),
});

export const focusSessionSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  userId: uuidSchema,
  taskId: uuidSchema.nullable(),
  status: z.enum(["running", "paused", "completed", "cancelled"]),
  startedAt: z.coerce.date(),
  pausedAt: z.coerce.date().nullable(),
  endedAt: z.coerce.date().nullable(),
  accumulatedSeconds: z.number().int().nonnegative(),
  notes: z.string(),
});
export type FocusSession = z.infer<typeof focusSessionSchema>;
