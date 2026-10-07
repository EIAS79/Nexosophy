import assert from "node:assert/strict";

import {
  bulkContentNodes,
  claimNextContentOperation,
  copyContentSubtree,
  createContentNode,
  createDatabasePool,
  createWorkspace,
  ensurePersonalWorkspace,
  getContentBreadcrumbs,
  getContentNode,
  listContentFavorites,
  listContentNodes,
  listContentRecent,
  markContentRecent,
  moveContentNode,
  processContentOperationBatch,
  provisionIdentity,
  resolveContentPath,
  restoreContentSubtree,
  setContentFavorite,
  trashContentSubtree,
  updateContentNode,
} from "./index.js";
import { ContentStoreError } from "./content-types.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for content integration tests.");
}

const pool = createDatabasePool(connectionString, { max: 12 });

async function makeUser(label: string, email: string) {
  const provisioned = await provisionIdentity(pool, {
    provider: "clerk",
    providerUserId: `content-${label}-${Date.now()}-${Math.random()}`,
    primaryEmail: email,
    displayName: label,
    disabled: false,
    providerUpdatedAt: new Date(),
  });
  await ensurePersonalWorkspace(pool, provisioned.internalUserId, label);
  return provisioned.internalUserId;
}

async function expectContentError(
  promise: Promise<unknown>,
  code: ContentStoreError["code"],
): Promise<void> {
  try {
    await promise;
    assert.fail(`Expected ContentStoreError ${code}`);
  } catch (error) {
    assert(error instanceof ContentStoreError);
    assert.equal(error.code, code);
  }
}

try {
  const owner = await makeUser("Content Owner", "content-owner@example.test");
  const workspace = await createWorkspace(pool, {
    userId: owner,
    name: "Content Integration",
    type: "research",
    requestId: "content-test-create",
  });
  const otherWorkspace = await createWorkspace(pool, {
    userId: owner,
    name: "Other Content Workspace",
    type: "team",
  });

  const rootFolder = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "folder",
    name: "Research",
  });
  const note = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: rootFolder.id,
    kind: "note",
    name: "Hypothesis",
    metadata: { color: "violet" },
  });
  const shortcut = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: rootFolder.id,
    kind: "shortcut",
    name: "Hypothesis shortcut",
    targetNodeId: note.id,
  });
  assert.equal(shortcut.targetNodeId, note.id);

  await expectContentError(
    createContentNode(pool, {
      workspaceId: workspace.id,
      actorUserId: owner,
      parentId: rootFolder.id,
      kind: "note",
      name: "hypothesis",
    }),
    "NAME_CONFLICT",
  );

  const deepFolders = [rootFolder];
  for (let depth = 1; depth <= 64; depth += 1) {
    deepFolders.push(
      await createContentNode(pool, {
        workspaceId: workspace.id,
        actorUserId: owner,
        parentId: deepFolders.at(-1)?.id ?? null,
        kind: "folder",
        name: `Depth ${String(depth).padStart(2, "0")}`,
      }),
    );
  }
  const deepest = deepFolders.at(-1);
  assert(deepest);
  await expectContentError(
    moveContentNode(pool, {
      workspaceId: workspace.id,
      actorUserId: owner,
      nodeId: rootFolder.id,
      parentId: deepest.id,
      expectedVersion: rootFolder.version,
    }),
    "CYCLE",
  );

  const otherFolder = await createContentNode(pool, {
    workspaceId: otherWorkspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "folder",
    name: "Foreign",
  });
  await expectContentError(
    moveContentNode(pool, {
      workspaceId: workspace.id,
      actorUserId: owner,
      nodeId: note.id,
      parentId: otherFolder.id,
      expectedVersion: note.version,
    }),
    "PARENT_NOT_FOUND",
  );

  const raceNode = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "document",
    name: "Race",
  });
  const raceTarget = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "folder",
    name: "Race target",
  });
  const race = await Promise.allSettled([
    updateContentNode(pool, {
      workspaceId: workspace.id,
      nodeId: raceNode.id,
      actorUserId: owner,
      expectedVersion: raceNode.version,
      name: "Race renamed",
    }),
    moveContentNode(pool, {
      workspaceId: workspace.id,
      nodeId: raceNode.id,
      actorUserId: owner,
      parentId: raceTarget.id,
      expectedVersion: raceNode.version,
    }),
  ]);
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(race.filter((result) => result.status === "rejected").length, 1);

  const breadcrumbs = await getContentBreadcrumbs(pool, workspace.id, deepest.id);
  assert.equal(breadcrumbs[0]?.id, rootFolder.id);
  assert.equal(breadcrumbs.at(-1)?.id, deepest.id);

  const resolved = await resolveContentPath(
    pool,
    workspace.id,
    breadcrumbs.map((item) => item.name).join("/"),
  );
  assert.equal(resolved?.id, deepest.id);

  await setContentFavorite(pool, {
    workspaceId: workspace.id,
    userId: owner,
    nodeId: note.id,
    favorite: true,
    pinned: true,
  });
  assert.equal((await listContentFavorites(pool, workspace.id, owner))[0]?.id, note.id);
  await markContentRecent(pool, workspace.id, owner, note.id);
  await markContentRecent(pool, workspace.id, owner, note.id);
  assert.equal((await listContentRecent(pool, workspace.id, owner))[0]?.id, note.id);

  const smallCopy = await copyContentSubtree(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    nodeId: note.id,
    parentId: null,
    name: "Hypothesis copy",
  });
  assert.equal(smallCopy.status, "completed");
  if (smallCopy.status === "completed") {
    assert.equal(smallCopy.node?.name, "Hypothesis copy");
  }

  const copiedTree = await copyContentSubtree(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    nodeId: rootFolder.id,
    parentId: null,
    name: "Research copy",
  });
  assert.equal(copiedTree.status, "completed");
  assert(copiedTree.status === "completed");
  assert(copiedTree.node);
  const copiedChildren = await listContentNodes(pool, {
    workspaceId: workspace.id,
    parentId: copiedTree.node.id,
    limit: 100,
  });
  const copiedShortcut = copiedChildren.items.find((item) => item.name === "Hypothesis shortcut");
  assert(copiedShortcut);
  assert.equal(copiedShortcut.targetNodeId, note.id);

  const trash = await trashContentSubtree(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    nodeId: shortcut.id,
  });
  assert.equal(trash.status, "completed");
  assert.equal(await getContentNode(pool, workspace.id, shortcut.id), null);
  const restored = await restoreContentSubtree(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    nodeId: shortcut.id,
  });
  assert.equal(restored.status, "completed");
  assert(await getContentNode(pool, workspace.id, shortcut.id));

  const syntheticWorkspace = await createWorkspace(pool, {
    userId: owner,
    name: "Synthetic 100k",
    type: "research",
  });
  await pool.query(
    `insert into "content_nodes"
       ("workspace_id", "parent_id", "kind", "name", "created_by_user_id", "updated_by_user_id")
     select $1, null, 'note'::content_node_kind,
            'Synthetic ' || lpad(gs::text, 6, '0'), $2, $2
     from generate_series(1, 100000) as gs`,
    [syntheticWorkspace.id, owner],
  );

  const firstPage = await listContentNodes(pool, {
    workspaceId: syntheticWorkspace.id,
    parentId: null,
    limit: 50,
  });
  assert.equal(firstPage.items.length, 50);
  assert(firstPage.nextCursor);

  await createContentNode(pool, {
    workspaceId: syntheticWorkspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "note",
    name: "Synthetic 000025a",
  });

  const secondPage = await listContentNodes(pool, {
    workspaceId: syntheticWorkspace.id,
    parentId: null,
    cursor: firstPage.nextCursor ?? undefined,
    limit: 50,
  });
  assert.equal(secondPage.items.length, 50);
  const firstIds = new Set(firstPage.items.map((item) => item.id));
  assert(secondPage.items.every((item) => !firstIds.has(item.id)));

  const plan = await pool.query<{ plan: unknown }>(
    `explain (format json)
     select "id", "name"
     from "content_nodes"
     where "workspace_id" = $1 and "parent_id" is null and "trashed_at" is null
     order by lower(trim("name")), "id"
     limit 50`,
    [syntheticWorkspace.id],
  );
  assert(plan.rows[0]?.plan);

  const largeRoot = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "folder",
    name: "Large subtree",
  });
  await pool.query(
    `insert into "content_nodes"
       ("workspace_id", "parent_id", "kind", "name", "created_by_user_id", "updated_by_user_id")
     select $1, $2, 'note'::content_node_kind,
            'Large child ' || lpad(gs::text, 4, '0'), $3, $3
     from generate_series(1, 501) as gs`,
    [workspace.id, largeRoot.id, owner],
  );

  const queuedTrash = await trashContentSubtree(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    nodeId: largeRoot.id,
    idempotencyKey: "large-trash",
  });
  assert.equal(queuedTrash.status, "queued");
  assert(queuedTrash.status === "queued");

  let claimed = await claimNextContentOperation(pool, "content-integration-worker");
  assert(claimed);
  assert.equal(claimed.id, queuedTrash.operation.id);
  while (claimed.status !== "succeeded") {
    claimed = await processContentOperationBatch(pool, claimed.id, 100);
  }
  assert.equal(claimed.processedNodes, 502);

  const queuedRestore = await restoreContentSubtree(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    nodeId: largeRoot.id,
    idempotencyKey: "large-restore",
  });
  assert.equal(queuedRestore.status, "queued");
  assert(queuedRestore.status === "queued");

  claimed = await claimNextContentOperation(pool, "content-integration-worker");
  assert(claimed);
  assert.equal(claimed.id, queuedRestore.operation.id);
  while (claimed.status !== "succeeded") {
    claimed = await processContentOperationBatch(pool, claimed.id, 125);
  }
  assert(await getContentNode(pool, workspace.id, largeRoot.id));

  const queuedCopy = await copyContentSubtree(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    nodeId: largeRoot.id,
    parentId: null,
    name: "Large subtree copy",
    idempotencyKey: "large-copy",
  });
  assert.equal(queuedCopy.status, "queued");
  assert(queuedCopy.status === "queued");

  claimed = await claimNextContentOperation(pool, "content-integration-worker");
  assert(claimed);
  assert.equal(claimed.id, queuedCopy.operation.id);
  while (claimed.status !== "succeeded") {
    claimed = await processContentOperationBatch(pool, claimed.id, 125);
  }
  const copiedRoot = await resolveContentPath(pool, workspace.id, "Large subtree copy");
  assert(copiedRoot);

  const bulkFolder = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "folder",
    name: "Bulk target",
  });
  const bulkA = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "note",
    name: "Bulk A",
  });
  const bulkB = await createContentNode(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    parentId: null,
    kind: "note",
    name: "Bulk B",
  });
  const bulk = await bulkContentNodes(pool, {
    workspaceId: workspace.id,
    actorUserId: owner,
    operation: "move",
    nodeIds: [bulkA.id, bulkB.id],
    parentId: bulkFolder.id,
  });
  assert.deepEqual(new Set(bulk.completed), new Set([bulkA.id, bulkB.id]));

  process.stdout.write("Content integration checks passed.\n");
} finally {
  await pool.end();
}