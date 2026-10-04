CREATE TABLE IF NOT EXISTS "system_metadata" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "system_metadata" ("key", "value")
VALUES ('schema_baseline', '{"phase":"00","status":"initialized"}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
