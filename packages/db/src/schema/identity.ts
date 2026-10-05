import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", [
  "pending_onboarding",
  "active",
  "suspended",
  "deletion_requested",
  "deletion_pending",
  "deleted",
]);

export const onboardingStatus = pgEnum("onboarding_status", [
  "not_started",
  "in_progress",
  "completed",
  "skipped",
]);

export const deletionRequestStatus = pgEnum("account_deletion_request_status", [
  "requested",
  "scheduled",
  "cancelled",
  "processing",
  "completed",
  "failed",
]);

export const webhookEventStatus = pgEnum("auth_webhook_event_status", [
  "received",
  "processed",
  "ignored",
  "failed",
]);

export const securityEventOutcome = pgEnum("security_event_outcome", [
  "success",
  "denied",
  "failed",
  "informational",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: userStatus("status").notNull().default("pending_onboarding"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
});

export const userIdentities = pgTable(
  "user_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    primaryEmailSnapshot: text("primary_email_snapshot"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),
    lastProviderEventAt: timestamp("last_provider_event_at", { withTimezone: true }),
    providerDeletedAt: timestamp("provider_deleted_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_identities_provider_user_uidx").on(
      table.provider,
      table.providerUserId,
    ),
  ],
);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").unique(),
  displayName: text("display_name").notNull().default(""),
  preferredName: text("preferred_name"),
  legalName: text("legal_name"),
  pronouns: text("pronouns"),
  avatarAssetId: text("avatar_asset_id"),
  institutionAffiliation: text("institution_affiliation"),
  locale: text("locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  fieldVisibility: jsonb("field_visibility")
    .$type<Record<string, "public" | "workspace" | "private">>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("en"),
  timezone: text("timezone").notNull().default("UTC"),
  theme: text("theme").notNull().default("system"),
  density: text("density").notNull().default("comfortable"),
  notificationSettings: jsonb("notification_settings")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const onboardingStates = pgTable("onboarding_states", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: onboardingStatus("status").notNull().default("not_started"),
  currentStep: text("current_step"),
  personas: jsonb("personas").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  interests: jsonb("interests").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: deletionRequestStatus("status").notNull().default("requested"),
  reasonCategory: text("reason_category"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authWebhookEvents = pgTable(
  "auth_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: webhookEventStatus("status").notNull().default("received"),
    errorCode: text("error_code"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("auth_webhook_events_provider_event_uidx").on(
      table.provider,
      table.providerEventId,
    ),
  ],
);

export const securityEvents = pgTable("security_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  outcome: securityEventOutcome("outcome").notNull(),
  requestId: text("request_id"),
  providerSessionId: text("provider_session_id"),
  metadata: jsonb("metadata")
    .$type<Record<string, string | number | boolean | null>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
