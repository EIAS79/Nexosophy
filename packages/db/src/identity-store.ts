import type { Pool, PoolClient } from "pg";

export type IdentitySnapshotInput = {
  provider: string;
  providerUserId: string;
  primaryEmail?: string | null;
  displayName?: string | null;
  avatarAssetId?: string | null;
  disabled?: boolean;
};

export type IdentityProvisionResult = {
  internalUserId: string;
  externalIdentityId: string;
  created: boolean;
};

export type InternalIdentityRecord = {
  internalUserId: string;
  externalIdentityId: string;
  provider: string;
  providerUserId: string;
  accountStatus:
    | "pending_onboarding"
    | "active"
    | "suspended"
    | "deletion_requested"
    | "deletion_pending"
    | "deleted";
  identityDisabledAt: Date | null;
};

export type MeAccountRecord = {
  id: string;
  status: InternalIdentityRecord["accountStatus"];
  version: number;
  profile: {
    handle: string | null;
    displayName: string;
    preferredName: string | null;
    legalName: string | null;
    pronouns: string | null;
    avatarAssetId: string | null;
    institutionAffiliation: string | null;
    locale: string;
    timezone: string;
    fieldVisibility: Record<string, "public" | "workspace" | "private">;
    version: number;
  };
  preferences: {
    locale: string;
    timezone: string;
    theme: string;
    density: string;
    notificationSettings: Record<string, unknown>;
    version: number;
  };
  onboarding: {
    status: "not_started" | "in_progress" | "completed" | "skipped";
    currentStep: string | null;
    personas: string[];
    interests: string[];
    completedAt: Date | null;
  };
};

async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function provisionIdentity(
  pool: Pool,
  input: IdentitySnapshotInput,
): Promise<IdentityProvisionResult> {
  return withTransaction(pool, async (client) => {
    const lockKey = `${input.provider}:${input.providerUserId}`;
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [lockKey]);

    const existing = await client.query<{
      id: string;
      user_id: string;
    }>(
      `select "id", "user_id"
       from "user_identities"
       where "provider" = $1 and "provider_user_id" = $2
       for update`,
      [input.provider, input.providerUserId],
    );

    if (existing.rowCount && existing.rows[0]) {
      const identity = existing.rows[0];

      await client.query(
        `update "user_identities"
         set "primary_email_snapshot" = $1,
             "last_synced_at" = now(),
             "disabled_at" = case when $2 then coalesce("disabled_at", now()) else null end,
             "updated_at" = now()
         where "id" = $3`,
        [input.primaryEmail ?? null, input.disabled ?? false, identity.id],
      );

      if (input.displayName !== undefined || input.avatarAssetId !== undefined) {
        await client.query(
          `update "user_profiles"
           set "display_name" = coalesce($1, "display_name"),
               "avatar_asset_id" = case when $2::boolean then $3 else "avatar_asset_id" end,
               "updated_at" = now(),
               "version" = "version" + 1
           where "user_id" = $4`,
          [
            input.displayName ?? null,
            input.avatarAssetId !== undefined,
            input.avatarAssetId ?? null,
            identity.user_id,
          ],
        );
      }

      return {
        internalUserId: identity.user_id,
        externalIdentityId: identity.id,
        created: false,
      };
    }

    const createdUser = await client.query<{ id: string }>(
      `insert into "users" ("status")
       values ('pending_onboarding')
       returning "id"`,
    );
    const userId = createdUser.rows[0]?.id;
    if (!userId) throw new Error("Failed to create internal user");

    const createdIdentity = await client.query<{ id: string }>(
      `insert into "user_identities"
         ("user_id", "provider", "provider_user_id", "primary_email_snapshot", "last_synced_at", "disabled_at")
       values ($1, $2, $3, $4, now(), case when $5 then now() else null end)
       returning "id"`,
      [
        userId,
        input.provider,
        input.providerUserId,
        input.primaryEmail ?? null,
        input.disabled ?? false,
      ],
    );
    const identityId = createdIdentity.rows[0]?.id;
    if (!identityId) throw new Error("Failed to create external identity mapping");

    await Promise.all([
      client.query(
        `insert into "user_profiles"
           ("user_id", "display_name", "avatar_asset_id")
         values ($1, $2, $3)
         on conflict ("user_id") do nothing`,
        [userId, input.displayName ?? "", input.avatarAssetId ?? null],
      ),
      client.query(
        `insert into "user_preferences" ("user_id")
         values ($1)
         on conflict ("user_id") do nothing`,
        [userId],
      ),
      client.query(
        `insert into "onboarding_states" ("user_id")
         values ($1)
         on conflict ("user_id") do nothing`,
        [userId],
      ),
    ]);

    return {
      internalUserId: userId,
      externalIdentityId: identityId,
      created: true,
    };
  });
}

export async function getInternalIdentityByProviderUserId(
  pool: Pool,
  provider: string,
  providerUserId: string,
): Promise<InternalIdentityRecord | null> {
  const result = await pool.query<{
    internal_user_id: string;
    external_identity_id: string;
    provider: string;
    provider_user_id: string;
    account_status: InternalIdentityRecord["accountStatus"];
    identity_disabled_at: Date | null;
  }>(
    `select
       u."id" as "internal_user_id",
       i."id" as "external_identity_id",
       i."provider",
       i."provider_user_id",
       u."status" as "account_status",
       i."disabled_at" as "identity_disabled_at"
     from "user_identities" i
     join "users" u on u."id" = i."user_id"
     where i."provider" = $1 and i."provider_user_id" = $2
     limit 1`,
    [provider, providerUserId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    internalUserId: row.internal_user_id,
    externalIdentityId: row.external_identity_id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    accountStatus: row.account_status,
    identityDisabledAt: row.identity_disabled_at,
  };
}

export async function recordAuthWebhookReceipt(
  pool: Pool,
  input: {
    provider: string;
    providerEventId: string;
    eventType: string;
    payloadHash: string;
  },
): Promise<{ eventId: string; accepted: boolean }> {
  const inserted = await pool.query<{ id: string }>(
    `insert into "auth_webhook_events"
       ("provider", "provider_event_id", "event_type", "payload_hash")
     values ($1, $2, $3, $4)
     on conflict ("provider", "provider_event_id") do nothing
     returning "id"`,
    [input.provider, input.providerEventId, input.eventType, input.payloadHash],
  );

  if (inserted.rows[0]) {
    return { eventId: inserted.rows[0].id, accepted: true };
  }

  const existing = await pool.query<{ id: string }>(
    `select "id"
     from "auth_webhook_events"
     where "provider" = $1 and "provider_event_id" = $2
     limit 1`,
    [input.provider, input.providerEventId],
  );

  const eventId = existing.rows[0]?.id;
  if (!eventId) throw new Error("Webhook deduplication invariant violated");

  return { eventId, accepted: false };
}

export async function markAuthWebhookEvent(
  pool: Pool,
  eventId: string,
  status: "processed" | "ignored" | "failed",
  errorCode?: string,
): Promise<void> {
  await pool.query(
    `update "auth_webhook_events"
     set "status" = $1,
         "error_code" = $2,
         "processed_at" = now()
     where "id" = $3`,
    [status, errorCode ?? null, eventId],
  );
}

export async function getMeAccount(pool: Pool, userId: string): Promise<MeAccountRecord | null> {
  const result = await pool.query<{
    id: string;
    status: MeAccountRecord["status"];
    user_version: number;
    handle: string | null;
    display_name: string;
    preferred_name: string | null;
    legal_name: string | null;
    pronouns: string | null;
    avatar_asset_id: string | null;
    institution_affiliation: string | null;
    profile_locale: string;
    profile_timezone: string;
    field_visibility: Record<string, "public" | "workspace" | "private">;
    profile_version: number;
    preference_locale: string;
    preference_timezone: string;
    theme: string;
    density: string;
    notification_settings: Record<string, unknown>;
    preference_version: number;
    onboarding_status: MeAccountRecord["onboarding"]["status"];
    current_step: string | null;
    personas: string[];
    interests: string[];
    completed_at: Date | null;
  }>(
    `select
       u."id",
       u."status",
       u."version" as "user_version",
       p."handle",
       p."display_name",
       p."preferred_name",
       p."legal_name",
       p."pronouns",
       p."avatar_asset_id",
       p."institution_affiliation",
       p."locale" as "profile_locale",
       p."timezone" as "profile_timezone",
       p."field_visibility",
       p."version" as "profile_version",
       pref."locale" as "preference_locale",
       pref."timezone" as "preference_timezone",
       pref."theme",
       pref."density",
       pref."notification_settings",
       pref."version" as "preference_version",
       o."status" as "onboarding_status",
       o."current_step",
       o."personas",
       o."interests",
       o."completed_at"
     from "users" u
     join "user_profiles" p on p."user_id" = u."id"
     join "user_preferences" pref on pref."user_id" = u."id"
     join "onboarding_states" o on o."user_id" = u."id"
     where u."id" = $1
     limit 1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    version: row.user_version,
    profile: {
      handle: row.handle,
      displayName: row.display_name,
      preferredName: row.preferred_name,
      legalName: row.legal_name,
      pronouns: row.pronouns,
      avatarAssetId: row.avatar_asset_id,
      institutionAffiliation: row.institution_affiliation,
      locale: row.profile_locale,
      timezone: row.profile_timezone,
      fieldVisibility: row.field_visibility,
      version: row.profile_version,
    },
    preferences: {
      locale: row.preference_locale,
      timezone: row.preference_timezone,
      theme: row.theme,
      density: row.density,
      notificationSettings: row.notification_settings,
      version: row.preference_version,
    },
    onboarding: {
      status: row.onboarding_status,
      currentStep: row.current_step,
      personas: row.personas,
      interests: row.interests,
      completedAt: row.completed_at,
    },
  };
}

export async function patchUserProfile(
  pool: Pool,
  userId: string,
  expectedVersion: number,
  patch: {
    displayName?: string;
    preferredName?: string | null;
    legalName?: string | null;
    pronouns?: string | null;
    institutionAffiliation?: string | null;
    locale?: string;
    timezone?: string;
  },
): Promise<boolean> {
  const result = await pool.query(
    `update "user_profiles"
     set
       "display_name" = case when $3 then $4 else "display_name" end,
       "preferred_name" = case when $5 then $6 else "preferred_name" end,
       "legal_name" = case when $7 then $8 else "legal_name" end,
       "pronouns" = case when $9 then $10 else "pronouns" end,
       "institution_affiliation" = case when $11 then $12 else "institution_affiliation" end,
       "locale" = case when $13 then $14 else "locale" end,
       "timezone" = case when $15 then $16 else "timezone" end,
       "version" = "version" + 1,
       "updated_at" = now()
     where "user_id" = $1 and "version" = $2`,
    [
      userId,
      expectedVersion,
      Object.hasOwn(patch, "displayName"),
      patch.displayName ?? null,
      Object.hasOwn(patch, "preferredName"),
      patch.preferredName ?? null,
      Object.hasOwn(patch, "legalName"),
      patch.legalName ?? null,
      Object.hasOwn(patch, "pronouns"),
      patch.pronouns ?? null,
      Object.hasOwn(patch, "institutionAffiliation"),
      patch.institutionAffiliation ?? null,
      Object.hasOwn(patch, "locale"),
      patch.locale ?? null,
      Object.hasOwn(patch, "timezone"),
      patch.timezone ?? null,
    ],
  );

  return result.rowCount === 1;
}

export async function patchUserPreferences(
  pool: Pool,
  userId: string,
  expectedVersion: number,
  patch: {
    locale?: string;
    timezone?: string;
    theme?: string;
    density?: string;
    notificationSettings?: Record<string, unknown>;
  },
): Promise<boolean> {
  const result = await pool.query(
    `update "user_preferences"
     set
       "locale" = case when $3 then $4 else "locale" end,
       "timezone" = case when $5 then $6 else "timezone" end,
       "theme" = case when $7 then $8 else "theme" end,
       "density" = case when $9 then $10 else "density" end,
       "notification_settings" = case when $11 then $12::jsonb else "notification_settings" end,
       "version" = "version" + 1,
       "updated_at" = now()
     where "user_id" = $1 and "version" = $2`,
    [
      userId,
      expectedVersion,
      Object.hasOwn(patch, "locale"),
      patch.locale ?? null,
      Object.hasOwn(patch, "timezone"),
      patch.timezone ?? null,
      Object.hasOwn(patch, "theme"),
      patch.theme ?? null,
      Object.hasOwn(patch, "density"),
      patch.density ?? null,
      Object.hasOwn(patch, "notificationSettings"),
      JSON.stringify(patch.notificationSettings ?? {}),
    ],
  );

  return result.rowCount === 1;
}

export async function finishOnboarding(
  pool: Pool,
  userId: string,
  input: {
    skipped: boolean;
    personas: readonly string[];
    interests: readonly string[];
  },
): Promise<void> {
  await withTransaction(pool, async (client) => {
    await client.query(
      `update "onboarding_states"
       set "status" = $1,
           "current_step" = null,
           "personas" = $2::jsonb,
           "interests" = $3::jsonb,
           "completed_at" = now(),
           "updated_at" = now()
       where "user_id" = $4`,
      [
        input.skipped ? "skipped" : "completed",
        JSON.stringify(input.personas),
        JSON.stringify(input.interests),
        userId,
      ],
    );

    await client.query(
      `update "users"
       set "status" = case when "status" = 'pending_onboarding' then 'active' else "status" end,
           "version" = "version" + 1,
           "updated_at" = now()
       where "id" = $1`,
      [userId],
    );
  });
}

export async function appendSecurityEvent(
  pool: Pool,
  input: {
    userId?: string;
    eventType: string;
    outcome: "success" | "denied" | "failed" | "informational";
    requestId?: string;
    providerSessionId?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await pool.query(
    `insert into "security_events"
       ("user_id", "event_type", "outcome", "request_id", "provider_session_id", "metadata")
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.userId ?? null,
      input.eventType,
      input.outcome,
      input.requestId ?? null,
      input.providerSessionId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}


export async function requestAccountDeletion(
  pool: Pool,
  userId: string,
  reasonCategory?: string,
): Promise<{ requestId: string; created: boolean }> {
  return withTransaction(pool, async (client) => {
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`account-deletion:${userId}`],
    );

    const existing = await client.query<{ id: string }>(
      `select "id"
       from "account_deletion_requests"
       where "user_id" = $1
         and "status" in ('requested', 'scheduled', 'processing')
       order by "requested_at" desc
       limit 1
       for update`,
      [userId],
    );

    if (existing.rows[0]) {
      return { requestId: existing.rows[0].id, created: false };
    }

    const inserted = await client.query<{ id: string }>(
      `insert into "account_deletion_requests"
         ("user_id", "status", "reason_category")
       values ($1, 'requested', $2)
       returning "id"`,
      [userId, reasonCategory ?? null],
    );

    const requestId = inserted.rows[0]?.id;
    if (!requestId) throw new Error("Failed to create account deletion request");

    await client.query(
      `update "users"
       set "status" = case
             when "status" in ('active', 'pending_onboarding') then 'deletion_requested'
             else "status"
           end,
           "deletion_requested_at" = coalesce("deletion_requested_at", now()),
           "version" = "version" + 1,
           "updated_at" = now()
       where "id" = $1`,
      [userId],
    );

    return { requestId, created: true };
  });
}

export async function listSecurityEvents(
  pool: Pool,
  userId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    eventType: string;
    outcome: "success" | "denied" | "failed" | "informational";
    requestId: string | null;
    providerSessionId: string | null;
    metadata: Record<string, string | number | boolean | null>;
    createdAt: Date;
  }>
> {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const result = await pool.query<{
    id: string;
    event_type: string;
    outcome: "success" | "denied" | "failed" | "informational";
    request_id: string | null;
    provider_session_id: string | null;
    metadata: Record<string, string | number | boolean | null>;
    created_at: Date;
  }>(
    `select
       "id",
       "event_type",
       "outcome",
       "request_id",
       "provider_session_id",
       "metadata",
       "created_at"
     from "security_events"
     where "user_id" = $1
     order by "created_at" desc, "id" desc
     limit $2`,
    [userId, boundedLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    outcome: row.outcome,
    requestId: row.request_id,
    providerSessionId: row.provider_session_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}
