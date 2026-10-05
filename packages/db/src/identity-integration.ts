import assert from "node:assert/strict";

import { createDatabasePool } from "./index.js";
import {
  getInternalIdentityByProviderUserId,
  getMeAccount,
  handleProviderIdentityDeletion,
  provisionIdentity,
  recordAuthWebhookReceipt,
} from "./identity-store.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for the identity integration test.");
}

const pool = createDatabasePool(connectionString, { max: 8 });

try {
  const providerUserId = `identity-integration-${Date.now()}`;

  const [left, right] = await Promise.all([
    provisionIdentity(pool, {
      provider: "clerk",
      providerUserId,
      primaryEmail: "initial@example.test",
      displayName: "Initial Provider Name",
      disabled: false,
      providerUpdatedAt: new Date(),
    }),
    provisionIdentity(pool, {
      provider: "clerk",
      providerUserId,
      primaryEmail: "initial@example.test",
      displayName: "Initial Provider Name",
      disabled: false,
      providerUpdatedAt: new Date(),
    }),
  ]);

  assert.equal(left.internalUserId, right.internalUserId);
  assert.equal(left.externalIdentityId, right.externalIdentityId);
  assert.equal(Number(left.created) + Number(right.created), 1);

  await pool.query(
    `update "user_profiles"
     set "display_name" = 'User Chosen Nexosophy Name',
         "version" = "version" + 1
     where "user_id" = $1`,
    [left.internalUserId],
  );

  await provisionIdentity(pool, {
    provider: "clerk",
    providerUserId,
    primaryEmail: "changed@example.test",
    displayName: "Provider Name Must Not Overwrite",
    disabled: false,
    providerUpdatedAt: new Date(Date.now() + 1_000),
  });

  const account = await getMeAccount(pool, left.internalUserId);
  assert(account);
  assert.equal(account.profile.displayName, "User Chosen Nexosophy Name");

  const providerEventId = `svix-${providerUserId}`;
  const firstWebhook = await recordAuthWebhookReceipt(pool, {
    provider: "clerk",
    providerEventId,
    eventType: "user.updated",
    payloadHash: "abc123",
  });
  const duplicateWebhook = await recordAuthWebhookReceipt(pool, {
    provider: "clerk",
    providerEventId,
    eventType: "user.updated",
    payloadHash: "abc123",
  });

  assert.equal(firstWebhook.accepted, true);
  assert.equal(duplicateWebhook.accepted, false);
  assert.equal(firstWebhook.eventId, duplicateWebhook.eventId);

  await assert.rejects(
    recordAuthWebhookReceipt(pool, {
      provider: "clerk",
      providerEventId,
      eventType: "user.updated",
      payloadHash: "different-body",
    }),
    /different payload hash/,
  );

  await handleProviderIdentityDeletion(
    pool,
    "clerk",
    providerUserId,
    new Date(Date.now() + 2_000),
  );

  const identity = await getInternalIdentityByProviderUserId(
    pool,
    "clerk",
    providerUserId,
  );

  assert(identity);
  assert(identity.identityDisabledAt instanceof Date);
  assert.equal(identity.accountStatus, "deletion_pending");

  process.stdout.write("Identity integration checks passed.\n");
} finally {
  await pool.end();
}
