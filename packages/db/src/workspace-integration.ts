import assert from "node:assert/strict";

import {
  acceptOwnershipTransfer,
  acceptWorkspaceInvitation,
  archiveWorkspace,
  createResourceGrant,
  createShareLink,
  createWorkspace,
  createWorkspaceInvitation,
  ensurePersonalWorkspace,
  getWorkspaceAuthorization,
  listWorkspaceAuditEvents,
  listWorkspaceMembers,
  listUserWorkspaces,
  requestOwnershipTransfer,
  resolveShareLink,
  revokeShareLink,
  revokeWorkspaceInvitation,
  updateWorkspace,
  updateWorkspaceMember,
} from "./workspace-store.js";
import { createDatabasePool } from "./index.js";
import { provisionIdentity } from "./identity-store.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for workspace integration tests.");
}

const pool = createDatabasePool(connectionString, { max: 12 });

async function makeUser(label: string, email: string) {
  const provisioned = await provisionIdentity(pool, {
    provider: "clerk",
    providerUserId: `workspace-${label}-${Date.now()}-${Math.random()}`,
    primaryEmail: email,
    displayName: label,
    disabled: false,
    providerUpdatedAt: new Date(),
  });
  await ensurePersonalWorkspace(pool, provisioned.internalUserId, label);
  return provisioned.internalUserId;
}

try {
  const owner = await makeUser("Owner", "owner@example.test");
  const invited = await makeUser("Invited", "invited@example.test");
  const wrongRecipient = await makeUser("Wrong", "wrong@example.test");
  const outsider = await makeUser("Outsider", "outsider@example.test");

  const personal = (await listUserWorkspaces(pool, owner)).filter((w) => w.type === "personal");
  assert.equal(personal.length, 1);
  await Promise.all([
    ensurePersonalWorkspace(pool, owner, "Owner"),
    ensurePersonalWorkspace(pool, owner, "Owner"),
  ]);
  assert.equal(
    (await listUserWorkspaces(pool, owner)).filter((w) => w.type === "personal").length,
    1,
  );

  const team = await createWorkspace(pool, {
    userId: owner,
    name: "Workspace Integration",
    type: "team",
    requestId: "workspace-test-create",
  });
  assert.equal(team.role, "owner");

  const ownerAuth = await getWorkspaceAuthorization(pool, owner, team.id);
  assert(ownerAuth);
  assert.equal(ownerAuth.role, "owner");

  const outsiderAuth = await getWorkspaceAuthorization(pool, outsider, team.id);
  assert.equal(outsiderAuth, null);

  const invite = await createWorkspaceInvitation(pool, {
    workspaceId: team.id,
    actorUserId: owner,
    email: "invited@example.test",
    role: "member",
    expiresInHours: 24,
  });

  const wrong = await acceptWorkspaceInvitation(pool, {
    token: invite.token,
    userId: wrongRecipient,
  });
  assert.equal(wrong.accepted, false);
  assert.equal(wrong.reason, "wrong_recipient");

  const accepted = await acceptWorkspaceInvitation(pool, {
    token: invite.token,
    userId: invited,
  });
  assert.equal(accepted.accepted, true);

  const replay = await acceptWorkspaceInvitation(pool, {
    token: invite.token,
    userId: invited,
  });
  assert.equal(replay.accepted, false);

  const raceInvite = await createWorkspaceInvitation(pool, {
    workspaceId: team.id,
    actorUserId: owner,
    email: "outsider@example.test",
    role: "viewer",
    expiresInHours: 24,
  });
  const race = await Promise.all([
    acceptWorkspaceInvitation(pool, { token: raceInvite.token, userId: outsider }),
    acceptWorkspaceInvitation(pool, { token: raceInvite.token, userId: outsider }),
  ]);
  assert.equal(race.filter((r) => r.accepted).length, 1);

  const revoked = await createWorkspaceInvitation(pool, {
    workspaceId: team.id,
    actorUserId: owner,
    email: "never@example.test",
    role: "member",
    expiresInHours: 24,
  });
  assert.equal(await revokeWorkspaceInvitation(pool, team.id, revoked.id), true);
  const revokedAccept = await acceptWorkspaceInvitation(pool, {
    token: revoked.token,
    userId: invited,
  });
  assert.equal(revokedAccept.accepted, false);

  const members = await listWorkspaceMembers(pool, team.id);
  const invitedMember = members.find((member) => member.userId === invited);
  assert(invitedMember);
  const beforePermissionVersion = (await getWorkspaceAuthorization(pool, owner, team.id))
    ?.permissionVersion;
  assert(beforePermissionVersion);

  assert.equal(
    await updateWorkspaceMember(pool, {
      workspaceId: team.id,
      userId: invited,
      expectedVersion: invitedMember.version,
      role: "viewer",
    }),
    true,
  );
  const afterRoleChange = await getWorkspaceAuthorization(pool, owner, team.id);
  assert(afterRoleChange);
  assert(afterRoleChange.permissionVersion > beforePermissionVersion);

  const refreshed = (await listWorkspaceMembers(pool, team.id)).find(
    (member) => member.userId === invited,
  );
  assert(refreshed);
  assert.equal(
    await updateWorkspaceMember(pool, {
      workspaceId: team.id,
      userId: invited,
      expectedVersion: refreshed.version,
      status: "suspended",
    }),
    true,
  );
  const suspended = await getWorkspaceAuthorization(pool, invited, team.id);
  assert(suspended);
  assert.equal(suspended.status, "suspended");

  const suspendedMember = (await listWorkspaceMembers(pool, team.id)).find(
    (member) => member.userId === invited,
  );
  assert(suspendedMember);
  await updateWorkspaceMember(pool, {
    workspaceId: team.id,
    userId: invited,
    expectedVersion: suspendedMember.version,
    status: "active",
    role: "member",
  });

  const grant = await createResourceGrant(pool, {
    workspaceId: team.id,
    actorUserId: owner,
    principalUserId: invited,
    resourceType: "node",
    resourceId: "test-node",
    permission: "content.read",
  });
  assert(grant.id);

  const staleVersion = team.version;
  const updated = await updateWorkspace(pool, team.id, staleVersion, { name: "Renamed" });
  assert(updated);
  const conflict = await updateWorkspace(pool, team.id, staleVersion, { name: "Stale" });
  assert.equal(conflict, null);

  const share = await createShareLink(pool, {
    workspaceId: team.id,
    actorUserId: owner,
    resourceType: "node",
    resourceId: "test-node",
    password: "integration-secret",
    allowDownload: false,
    expiresAt: new Date(Date.now() + 60_000),
  });
  assert.equal(await resolveShareLink(pool, share.token, "wrong-password"), null);
  const resolved = await resolveShareLink(pool, share.token, "integration-secret");
  assert(resolved);
  assert.equal(resolved.allowDownload, false);
  assert.equal(await revokeShareLink(pool, team.id, share.id), true);
  assert.equal(await resolveShareLink(pool, share.token, "integration-secret"), null);

  const ownerTransfer = await requestOwnershipTransfer(pool, {
    workspaceId: team.id,
    fromUserId: owner,
    toUserId: invited,
    expiresInHours: 1,
  });
  assert(ownerTransfer);
  const transferRace = await Promise.all([
    acceptOwnershipTransfer(pool, { token: ownerTransfer.token, userId: invited }),
    acceptOwnershipTransfer(pool, { token: ownerTransfer.token, userId: invited }),
  ]);
  assert.equal(transferRace.filter(Boolean).length, 1);
  const ownerCount = await pool.query<{ count: string }>(
    `select count(*)::text as "count"
     from "workspace_members"
     where "workspace_id" = $1 and "role" = 'owner'`,
    [team.id],
  );
  assert.equal(ownerCount.rows[0]?.count, "1");

  const personalWorkspace = (await listUserWorkspaces(pool, owner)).find(
    (workspace) => workspace.type === "personal",
  );
  assert(personalWorkspace);
  await assert.rejects(
    archiveWorkspace(pool, personalWorkspace.id),
    /Personal workspaces cannot be archived/,
  );
  assert.equal(await archiveWorkspace(pool, team.id), true);

  const audit = await listWorkspaceAuditEvents(pool, team.id);
  assert(audit.length > 0);

  process.stdout.write("Workspace integration checks passed.\n");
} finally {
  await pool.end();
}
