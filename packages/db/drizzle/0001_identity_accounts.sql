DO $$ BEGIN
  CREATE TYPE "user_status" AS ENUM (
    'pending_onboarding',
    'active',
    'suspended',
    'deletion_requested',
    'deletion_pending',
    'deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "onboarding_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "account_deletion_request_status" AS ENUM (
    'requested',
    'scheduled',
    'cancelled',
    'processing',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "auth_webhook_event_status" AS ENUM (
    'received',
    'processed',
    'ignored',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "security_event_outcome" AS ENUM (
    'success',
    'denied',
    'failed',
    'informational'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" "user_status" DEFAULT 'pending_onboarding' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "suspended_at" timestamptz,
  "deletion_requested_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "user_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "provider_user_id" text NOT NULL,
  "primary_email_snapshot" text,
  "last_synced_at" timestamptz,
  "disabled_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_provider_user_uidx"
  ON "user_identities" ("provider", "provider_user_id");

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "handle" text UNIQUE,
  "display_name" text DEFAULT '' NOT NULL,
  "preferred_name" text,
  "legal_name" text,
  "pronouns" text,
  "avatar_asset_id" text,
  "institution_affiliation" text,
  "locale" text DEFAULT 'en' NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "field_visibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "locale" text DEFAULT 'en' NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "theme" text DEFAULT 'system' NOT NULL,
  "density" text DEFAULT 'comfortable' NOT NULL,
  "notification_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "onboarding_states" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "onboarding_status" DEFAULT 'not_started' NOT NULL,
  "current_step" text,
  "personas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "account_deletion_request_status" DEFAULT 'requested' NOT NULL,
  "reason_category" text,
  "requested_at" timestamptz DEFAULT now() NOT NULL,
  "scheduled_for" timestamptz,
  "cancelled_at" timestamptz,
  "processed_at" timestamptz,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_deletion_requests_user_idx"
  ON "account_deletion_requests" ("user_id", "requested_at" DESC);

CREATE TABLE IF NOT EXISTS "auth_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload_hash" text NOT NULL,
  "status" "auth_webhook_event_status" DEFAULT 'received' NOT NULL,
  "error_code" text,
  "received_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_webhook_events_provider_event_uidx"
  ON "auth_webhook_events" ("provider", "provider_event_id");

CREATE TABLE IF NOT EXISTS "security_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "outcome" "security_event_outcome" NOT NULL,
  "request_id" text,
  "provider_session_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "security_events_user_created_idx"
  ON "security_events" ("user_id", "created_at" DESC);
