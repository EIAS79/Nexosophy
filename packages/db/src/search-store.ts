import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

export type SearchTagRecord = {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SearchRelationRecord = {
  id: string;
  workspaceId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType:
    | "related"
    | "references"
    | "supports"
    | "depends_on"
    | "contradicts"
    | "duplicates"
    | "derived_from";
  label: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type SearchResultRecord = {
  nodeId: string;
  kind: string;
  title: string;
  path: string;
  snippet: string;
  ownerUserId: string;
  updatedAt: Date;
  rank: number;
  tags: SearchTagRecord[];
};

type SearchCursor = { rank: number; updatedAt: string; nodeId: string };

function encodeCursor(item: SearchResultRecord): string {
  return Buffer.from(
    JSON.stringify({
      rank: item.rank,
      updatedAt: item.updatedAt.toISOString(),
      nodeId: item.nodeId,
    }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor?: string): SearchCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as SearchCursor;
    if (
      typeof parsed.rank !== "number" ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.nodeId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function flattenSearchText(value: unknown, depth = 0): string {
  if (depth > 5 || value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.slice(0, 5000).map((item) => flattenSearchText(item, depth + 1)).join(" ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !new Set([
        "password",
        "token",
        "secret",
        "authorization",
        "cookie",
        "checksum_sha256",
        "object_key",
      ]).has(key.toLowerCase()))
      .slice(0, 5000)
      .map(([key, nested]) => key + " " + flattenSearchText(nested, depth + 1))
      .join(" ");
  }
  return "";
}

async function searchPath(
  db: Pool | PoolClient,
  workspaceId: string,
  nodeId: string,
): Promise<string> {
  const result = await db.query<{ path_text: string }>(
    `with recursive ancestors as (
       select n."id", n."parent_id", n."name", 0 as depth
       from "content_nodes" n
       where n."workspace_id" = $1 and n."id" = $2
       union all
       select p."id", p."parent_id", p."name", a.depth + 1
       from "content_nodes" p
       join ancestors a on a."parent_id" = p."id"
       where p."workspace_id" = $1
     )
     select coalesce(string_agg("name", ' / ' order by depth desc), '') as "path_text"
     from ancestors`,
    [workspaceId, nodeId],
  );
  return result.rows[0]?.path_text ?? "";
}

export async function indexSearchNode(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
): Promise<"indexed" | "removed"> {
  return withWorkspaceTransaction(pool, async (client) => {
    const node = await client.query<{
      id: string;
      kind: string;
      name: string;
      metadata: Record<string, unknown>;
      created_by_user_id: string;
      updated_at: Date;
      trashed_at: Date | null;
    }>(
      `select "id", "kind"::text as "kind", "name", "metadata",
              "created_by_user_id", "updated_at", "trashed_at"
       from "content_nodes"
       where "workspace_id" = $1 and "id" = $2
       limit 1`,
      [workspaceId, nodeId],
    );
    const n = node.rows[0];
    if (!n || n.trashed_at) {
      await client.query(
        `delete from "search_documents"
         where "workspace_id" = $1 and "node_id" = $2`,
        [workspaceId, nodeId],
      );
      return "removed";
    }

    const [document, spatial, assets, tags, relations] = await Promise.all([
      client.query<{ body: unknown; updated_at: Date }>(
        `select "body", "updated_at"
         from "documents"
         where "workspace_id" = $1 and "node_id" = $2
         limit 1`,
        [workspaceId, nodeId],
      ),
      client.query<{ payload: Record<string, unknown>; updated_at: Date }>(
        `select "payload", "updated_at"
         from "spatial_elements"
         where "workspace_id" = $1 and "node_id" = $2
         order by "z_rank", "id"
         limit 10000`,
        [workspaceId, nodeId],
      ),
      client.query<{
        original_filename: string;
        metadata: Record<string, unknown>;
        updated_at: Date;
        variant_metadata: Record<string, unknown> | null;
      }>(
        `select a."original_filename", a."metadata", a."updated_at",
                v."metadata" as "variant_metadata"
         from "assets" a
         left join "asset_variants" v
           on v."asset_id" = a."id" and v."kind" = 'pdf_text' and v."status" = 'ready'
         where a."workspace_id" = $1 and a."node_id" = $2
           and a."trust_state" = 'trusted'`,
        [workspaceId, nodeId],
      ),
      client.query<{ name: string }>(
        `select t."name"
         from "content_node_tags" nt
         join "workspace_tags" t on t."id" = nt."tag_id"
         where nt."workspace_id" = $1 and nt."node_id" = $2
         order by t."normalized_name"`,
        [workspaceId, nodeId],
      ),
      client.query<{ relation_type: string; label: string | null }>(
        `select "relation_type"::text as "relation_type", "label"
         from "content_relations"
         where "workspace_id" = $1
           and ("from_node_id" = $2 or "to_node_id" = $2)
         order by "updated_at" desc
         limit 500`,
        [workspaceId, nodeId],
      ),
    ]);

    const pathText = await searchPath(client, workspaceId, nodeId);
    const contentParts = [
      document.rows[0] ? flattenSearchText(document.rows[0].body) : "",
      ...spatial.rows.map((row) => flattenSearchText(row.payload)),
      ...assets.rows.map((row) =>
        [
          row.original_filename,
          flattenSearchText(row.metadata),
          flattenSearchText(row.variant_metadata),
        ].join(" "),
      ),
    ];
    const metadataText = [
      flattenSearchText(n.metadata),
      tags.rows.map((row) => row.name).join(" "),
      relations.rows
        .map((row) => [row.relation_type, row.label ?? ""].join(" "))
        .join(" "),
    ].join(" ");

    const sourceUpdatedAt = [
      n.updated_at,
      document.rows[0]?.updated_at,
      ...spatial.rows.map((row) => row.updated_at),
      ...assets.rows.map((row) => row.updated_at),
    ]
      .filter((value): value is Date => value instanceof Date)
      .reduce((latest, value) => (value > latest ? value : latest), n.updated_at);

    await client.query(
      `insert into "search_documents"
         ("workspace_id", "node_id", "kind", "title", "path_text", "content_text",
          "metadata_text", "owner_user_id", "source_updated_at", "indexed_at")
       values ($1, $2, $3::content_node_kind, $4, $5, $6, $7, $8, $9, now())
       on conflict ("workspace_id", "node_id")
       do update set "kind" = excluded."kind", "title" = excluded."title",
                     "path_text" = excluded."path_text",
                     "content_text" = excluded."content_text",
                     "metadata_text" = excluded."metadata_text",
                     "owner_user_id" = excluded."owner_user_id",
                     "source_updated_at" = excluded."source_updated_at",
                     "indexed_at" = now()`,
      [
        workspaceId,
        nodeId,
        n.kind,
        n.name,
        pathText,
        contentParts.join(" ").slice(0, 2_000_000),
        metadataText.slice(0, 500_000),
        n.created_by_user_id,
        sourceUpdatedAt,
      ],
    );
    return "indexed";
  });
}

export async function reconcileSearchIndexBatch(
  pool: Pool,
  limit = 100,
): Promise<{ indexed: number; workspaces: string[] }> {
  const stale = await pool.query<{ workspace_id: string; node_id: string }>(
    `select n."workspace_id", n."id" as "node_id"
     from "content_nodes" n
     left join "search_documents" s
       on s."workspace_id" = n."workspace_id" and s."node_id" = n."id"
     left join "documents" d
       on d."workspace_id" = n."workspace_id" and d."node_id" = n."id"
     left join "spatial_documents" sp
       on sp."workspace_id" = n."workspace_id" and sp."node_id" = n."id"
     left join lateral (
       select max(a."updated_at") as "asset_updated_at"
       from "assets" a
       where a."workspace_id" = n."workspace_id" and a."node_id" = n."id"
     ) asset on true
     where n."trashed_at" is null
       and (
         s."node_id" is null
         or greatest(
           n."updated_at",
           coalesce(d."updated_at", '-infinity'::timestamptz),
           coalesce(sp."updated_at", '-infinity'::timestamptz),
           coalesce(asset."asset_updated_at", '-infinity'::timestamptz)
         ) > s."source_updated_at"
       )
     order by greatest(
       n."updated_at",
       coalesce(d."updated_at", '-infinity'::timestamptz),
       coalesce(sp."updated_at", '-infinity'::timestamptz),
       coalesce(asset."asset_updated_at", '-infinity'::timestamptz)
     )
     limit $1`,
    [limit],
  );

  const workspaces = new Set<string>();
  for (const row of stale.rows) {
    await indexSearchNode(pool, row.workspace_id, row.node_id);
    workspaces.add(row.workspace_id);
  }

  for (const workspaceId of workspaces) {
    await refreshSearchIndexState(pool, workspaceId);
  }
  return { indexed: stale.rows.length, workspaces: [...workspaces] };
}

export async function reindexWorkspaceSearchBatch(
  pool: Pool,
  input: {
    workspaceId: string;
    afterNodeId?: string | undefined;
    limit?: number | undefined;
  },
): Promise<{ processed: number; nextCursor: string | null; done: boolean }> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const rows = await pool.query<{ id: string }>(
    `select "id"
     from "content_nodes"
     where "workspace_id" = $1 and "trashed_at" is null
       and ($2::uuid is null or "id" > $2::uuid)
     order by "id"
     limit $3`,
    [input.workspaceId, input.afterNodeId ?? null, limit + 1],
  );
  const selected = rows.rows.slice(0, limit);
  for (const row of selected) {
    await indexSearchNode(pool, input.workspaceId, row.id);
  }
  const hasMore = rows.rows.length > limit;
  const nextCursor = hasMore ? selected.at(-1)?.id ?? null : null;
  await refreshSearchIndexState(pool, input.workspaceId);
  return {
    processed: selected.length,
    nextCursor,
    done: !hasMore,
  };
}

export async function refreshSearchIndexState(
  pool: Pool,
  workspaceId: string,
): Promise<void> {
  const stats = await pool.query<{ indexed_nodes: string; lagging_nodes: string }>(
    `select
       count(s."node_id")::text as "indexed_nodes",
       count(*) filter (
         where s."node_id" is null or n."updated_at" > s."source_updated_at"
       )::text as "lagging_nodes"
     from "content_nodes" n
     left join "search_documents" s
       on s."workspace_id" = n."workspace_id" and s."node_id" = n."id"
     where n."workspace_id" = $1 and n."trashed_at" is null`,
    [workspaceId],
  );
  await pool.query(
    `insert into "search_index_state"
       ("workspace_id", "last_reconciled_at", "indexed_nodes", "lagging_nodes")
     values ($1, now(), $2, $3)
     on conflict ("workspace_id")
     do update set "last_reconciled_at" = now(),
                   "indexed_nodes" = excluded."indexed_nodes",
                   "lagging_nodes" = excluded."lagging_nodes",
                   "last_error" = null,
                   "updated_at" = now()`,
    [
      workspaceId,
      Number(stats.rows[0]?.indexed_nodes ?? 0),
      Number(stats.rows[0]?.lagging_nodes ?? 0),
    ],
  );
}

export async function searchWorkspace(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    q: string;
    cursor?: string | undefined;
    limit?: number | undefined;
    kinds?: string[] | undefined;
    tagIds?: string[] | undefined;
    ownerUserId?: string | undefined;
    from?: Date | undefined;
    to?: Date | undefined;
  },
): Promise<{ items: SearchResultRecord[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
  const cursor = decodeCursor(input.cursor);
  const q = input.q.trim();
  const result = await pool.query<{
    node_id: string;
    kind: string;
    title: string;
    path_text: string;
    snippet: string;
    owner_user_id: string;
    source_updated_at: Date;
    rank: number;
    tags: Array<{
      id: string;
      workspaceId: string;
      name: string;
      color: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(
    `with ranked as (
       select s."node_id", s."kind"::text as "kind", s."title", s."path_text",
              s."owner_user_id", s."source_updated_at",
              case
                when $2::text = '' then 0::real
                else greatest(
                  ts_rank_cd(s."search_vector", websearch_to_tsquery('simple', $2)),
                  case when lower(s."title") like '%' || lower($2) || '%' then 0.25 else 0 end
                )
              end as "rank",
              case
                when $2::text = '' then left(s."content_text", 320)
                else ts_headline(
                  'simple',
                  left(s."content_text", 20000),
                  websearch_to_tsquery('simple', $2),
                  'MaxWords=35,MinWords=12,ShortWord=2,StartSel=<mark>,StopSel=</mark>'
                )
              end as "snippet"
       from "search_documents" s
       join "content_nodes" n
         on n."workspace_id" = s."workspace_id" and n."id" = s."node_id"
       where s."workspace_id" = $1
         and n."trashed_at" is null
         and (
           $2::text = ''
           or s."search_vector" @@ websearch_to_tsquery('simple', $2)
           or lower(s."title") like '%' || lower($2) || '%'
           or lower(s."path_text") like '%' || lower($2) || '%'
         )
         and ($3::text[] is null or s."kind"::text = any($3::text[]))
         and ($4::uuid is null or s."owner_user_id" = $4)
         and ($5::timestamptz is null or s."source_updated_at" >= $5)
         and ($6::timestamptz is null or s."source_updated_at" <= $6)
         and (
           $7::uuid[] is null
           or not exists (
             select 1
             from unnest($7::uuid[]) requested("tag_id")
             where not exists (
               select 1 from "content_node_tags" nt
               where nt."workspace_id" = s."workspace_id"
                 and nt."node_id" = s."node_id"
                 and nt."tag_id" = requested."tag_id"
             )
           )
         )
     )
     select r.*,
       coalesce(
         (
           select jsonb_agg(
             jsonb_build_object(
               'id', t."id",
               'workspaceId', t."workspace_id",
               'name', t."name",
               'color', t."color",
               'createdAt', t."created_at",
               'updatedAt', t."updated_at"
             )
             order by t."normalized_name"
           )
           from "content_node_tags" nt
           join "workspace_tags" t on t."id" = nt."tag_id"
           where nt."workspace_id" = $1 and nt."node_id" = r."node_id"
         ),
         '[]'::jsonb
       ) as "tags"
     from ranked r
     where (
       $8::real is null
       or r."rank" < $8::real
       or (
         r."rank" = $8::real
         and (
           r."source_updated_at" < $9::timestamptz
           or (r."source_updated_at" = $9::timestamptz and r."node_id" > $10::uuid)
         )
       )
     )
     order by r."rank" desc, r."source_updated_at" desc, r."node_id"
     limit $11`,
    [
      input.workspaceId,
      q,
      input.kinds && input.kinds.length > 0 ? input.kinds : null,
      input.ownerUserId ?? null,
      input.from ?? null,
      input.to ?? null,
      input.tagIds && input.tagIds.length > 0 ? input.tagIds : null,
      cursor?.rank ?? null,
      cursor?.updatedAt ?? null,
      cursor?.nodeId ?? null,
      limit + 1,
    ],
  );

  const mapped: SearchResultRecord[] = result.rows.map((row) => ({
    nodeId: row.node_id,
    kind: row.kind,
    title: row.title,
    path: row.path_text,
    snippet: row.snippet ?? "",
    ownerUserId: row.owner_user_id,
    updatedAt: row.source_updated_at,
    rank: Number(row.rank),
    tags: (row.tags ?? []).map((tag) => ({
      id: tag.id,
      workspaceId: tag.workspaceId,
      name: tag.name,
      color: tag.color,
      createdAt: new Date(tag.createdAt),
      updatedAt: new Date(tag.updatedAt),
    })),
  }));

  const hasMore = mapped.length > limit;
  const items = hasMore ? mapped.slice(0, limit) : mapped;
  const last = items.at(-1);

  if (q) {
    const filters = {
      kinds: input.kinds ?? [],
      tagIds: input.tagIds ?? [],
      ownerUserId: input.ownerUserId ?? null,
      from: input.from?.toISOString() ?? null,
      to: input.to?.toISOString() ?? null,
    };
    const hash = createHash("sha256")
      .update(JSON.stringify({ q, filters }))
      .digest("hex");
    await pool.query(
      `insert into "search_query_history"
         ("workspace_id", "user_id", "query_hash", "query_text", "filters")
       values ($1, $2, $3, $4, $5::jsonb)
       on conflict ("workspace_id", "user_id", "query_hash")
       do update set "use_count" = "search_query_history"."use_count" + 1,
                     "last_used_at" = now()`,
      [input.workspaceId, input.userId, hash, q, JSON.stringify(filters)],
    );
  }

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

export async function listWorkspaceTags(
  pool: Pool,
  workspaceId: string,
): Promise<SearchTagRecord[]> {
  const result = await pool.query<{
    id: string;
    workspace_id: string;
    name: string;
    color: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `select "id", "workspace_id", "name", "color", "created_at", "updated_at"
     from "workspace_tags"
     where "workspace_id" = $1
     order by "normalized_name", "id"`,
    [workspaceId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createWorkspaceTag(
  pool: Pool,
  input: {
    workspaceId: string;
    name: string;
    color?: string | undefined;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<SearchTagRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query<{
      id: string;
      workspace_id: string;
      name: string;
      color: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `insert into "workspace_tags"
         ("workspace_id", "name", "color", "created_by_user_id")
       values ($1, $2, $3, $4)
       on conflict ("workspace_id", "normalized_name")
       do update set "color" = coalesce(excluded."color", "workspace_tags"."color"),
                     "updated_at" = now()
       returning "id", "workspace_id", "name", "color", "created_at", "updated_at"`,
      [input.workspaceId, input.name, input.color ?? null, input.actorUserId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("TAG_CREATE_FAILED");
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "search.tag_created",
      targetType: "tag",
      targetId: row.id,
      requestId: input.requestId,
      metadata: { name: input.name },
    });
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function assignTagToNode(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    tagId: string;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    const inserted = await client.query(
      `insert into "content_node_tags"
         ("workspace_id", "node_id", "tag_id", "assigned_by_user_id")
       select $1, $2, t."id", $4
       from "workspace_tags" t
       where t."workspace_id" = $1 and t."id" = $3
       on conflict do nothing`,
      [input.workspaceId, input.nodeId, input.tagId, input.actorUserId],
    );
    if ((inserted.rowCount ?? 0) === 0) {
      const existing = await client.query(
        `select 1 from "content_node_tags"
         where "workspace_id" = $1 and "node_id" = $2 and "tag_id" = $3`,
        [input.workspaceId, input.nodeId, input.tagId],
      );
      if ((existing.rowCount ?? 0) === 0) throw new Error("TAG_NOT_FOUND");
    }
    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'content', $2, 'search.tags_changed', $3::jsonb)`,
      [
        input.workspaceId,
        input.nodeId,
        JSON.stringify({ nodeId: input.nodeId, tagId: input.tagId }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "search.tag_assigned",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: { tagId: input.tagId },
    });
  });
}

export async function unassignTagFromNode(
  pool: Pool,
  input: {
    workspaceId: string;
    nodeId: string;
    tagId: string;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<void> {
  await withWorkspaceTransaction(pool, async (client) => {
    await client.query(
      `delete from "content_node_tags"
       where "workspace_id" = $1 and "node_id" = $2 and "tag_id" = $3`,
      [input.workspaceId, input.nodeId, input.tagId],
    );
    await client.query(
      `insert into "outbox_events"
         ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
       values ($1, 'content', $2, 'search.tags_changed', $3::jsonb)`,
      [
        input.workspaceId,
        input.nodeId,
        JSON.stringify({ nodeId: input.nodeId, tagId: input.tagId }),
      ],
    );
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "search.tag_unassigned",
      targetType: "node",
      targetId: input.nodeId,
      requestId: input.requestId,
      metadata: { tagId: input.tagId },
    });
  });
}

function toRelation(row: {
  id: string;
  workspace_id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: SearchRelationRecord["relationType"];
  label: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}): SearchRelationRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    relationType: row.relation_type,
    label: row.label,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listNodeRelations(
  pool: Pool,
  workspaceId: string,
  nodeId: string,
): Promise<{ outgoing: SearchRelationRecord[]; backlinks: SearchRelationRecord[] }> {
  const result = await pool.query<any>(
    `select "id", "workspace_id", "from_node_id", "to_node_id",
            "relation_type"::text as "relation_type", "label", "metadata",
            "created_at", "updated_at"
     from "content_relations"
     where "workspace_id" = $1
       and ("from_node_id" = $2 or "to_node_id" = $2)
     order by "updated_at" desc, "id" desc
     limit 1000`,
    [workspaceId, nodeId],
  );
  const all = result.rows.map(toRelation);
  return {
    outgoing: all.filter((item) => item.fromNodeId === nodeId),
    backlinks: all.filter((item) => item.toNodeId === nodeId),
  };
}

export async function createContentRelation(
  pool: Pool,
  input: {
    workspaceId: string;
    fromNodeId: string;
    toNodeId: string;
    relationType: SearchRelationRecord["relationType"];
    label?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<SearchRelationRecord> {
  return withWorkspaceTransaction(pool, async (client) => {
    const result = await client.query<any>(
      `insert into "content_relations"
         ("workspace_id", "from_node_id", "to_node_id", "relation_type",
          "label", "metadata", "created_by_user_id")
       values ($1, $2, $3, $4::content_relation_type, $5, $6::jsonb, $7)
       on conflict ("workspace_id", "from_node_id", "to_node_id", "relation_type")
       do update set "label" = excluded."label", "metadata" = excluded."metadata",
                     "updated_at" = now()
       returning "id", "workspace_id", "from_node_id", "to_node_id",
                 "relation_type"::text as "relation_type", "label", "metadata",
                 "created_at", "updated_at"`,
      [
        input.workspaceId,
        input.fromNodeId,
        input.toNodeId,
        input.relationType,
        input.label ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.actorUserId,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("RELATION_CREATE_FAILED");
    for (const nodeId of [input.fromNodeId, input.toNodeId]) {
      await client.query(
        `insert into "outbox_events"
           ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
         values ($1, 'content', $2, 'search.relations_changed', $3::jsonb)`,
        [
          input.workspaceId,
          nodeId,
          JSON.stringify({ nodeId, relationId: row.id }),
        ],
      );
    }
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "search.relation_created",
      targetType: "relation",
      targetId: row.id,
      requestId: input.requestId,
      metadata: {
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        relationType: input.relationType,
      },
    });
    return toRelation(row);
  });
}

export async function deleteContentRelation(
  pool: Pool,
  input: {
    workspaceId: string;
    relationId: string;
    actorUserId: string;
    requestId?: string | undefined;
  },
): Promise<boolean> {
  return withWorkspaceTransaction(pool, async (client) => {
    const removed = await client.query<{ from_node_id: string; to_node_id: string }>(
      `delete from "content_relations"
       where "workspace_id" = $1 and "id" = $2
       returning "from_node_id", "to_node_id"`,
      [input.workspaceId, input.relationId],
    );
    const row = removed.rows[0];
    if (!row) return false;
    for (const nodeId of [row.from_node_id, row.to_node_id]) {
      await client.query(
        `insert into "outbox_events"
           ("workspace_id", "aggregate_type", "aggregate_id", "event_type", "payload")
         values ($1, 'content', $2, 'search.relations_changed', $3::jsonb)`,
        [
          input.workspaceId,
          nodeId,
          JSON.stringify({ nodeId, relationId: input.relationId }),
        ],
      );
    }
    await appendWorkspaceAudit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "search.relation_deleted",
      targetType: "relation",
      targetId: input.relationId,
      requestId: input.requestId,
    });
    return true;
  });
}

export async function listSavedSearches(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<any[]> {
  const result = await pool.query(
    `select "id", "workspace_id", "owner_user_id", "name", "query", "shared",
            "version", "created_at", "updated_at"
     from "saved_searches"
     where "workspace_id" = $1 and ("owner_user_id" = $2 or "shared")
     order by "updated_at" desc, "id" desc
     limit 200`,
    [workspaceId, userId],
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    query: row.query ?? {},
    shared: row.shared,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createSavedSearch(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    name: string;
    query: Record<string, unknown>;
    shared: boolean;
  },
): Promise<any> {
  const result = await pool.query<any>(
    `insert into "saved_searches"
       ("workspace_id", "owner_user_id", "name", "query", "shared")
     values ($1, $2, $3, $4::jsonb, $5)
     returning *`,
    [input.workspaceId, input.userId, input.name, JSON.stringify(input.query), input.shared],
  );
  const row = result.rows[0];
  if (!row) throw new Error("SAVED_SEARCH_CREATE_FAILED");
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    query: row.query ?? {},
    shared: row.shared,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteSavedSearch(
  pool: Pool,
  workspaceId: string,
  userId: string,
  savedSearchId: string,
): Promise<boolean> {
  const result = await pool.query(
    `delete from "saved_searches"
     where "workspace_id" = $1 and "owner_user_id" = $2 and "id" = $3`,
    [workspaceId, userId, savedSearchId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listSearchHistory(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<Array<{
  queryText: string;
  filters: Record<string, unknown>;
  useCount: number;
  lastUsedAt: Date;
}>> {
  const result = await pool.query<{
    query_text: string;
    filters: Record<string, unknown>;
    use_count: number;
    last_used_at: Date;
  }>(
    `select "query_text", "filters", "use_count", "last_used_at"
     from "search_query_history"
     where "workspace_id" = $1 and "user_id" = $2
     order by "last_used_at" desc
     limit 30`,
    [workspaceId, userId],
  );
  return result.rows.map((row) => ({
    queryText: row.query_text,
    filters: row.filters ?? {},
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
  }));
}

export async function clearSearchHistory(
  pool: Pool,
  workspaceId: string,
  userId: string,
): Promise<void> {
  await pool.query(
    `delete from "search_query_history"
     where "workspace_id" = $1 and "user_id" = $2`,
    [workspaceId, userId],
  );
}

export async function getWorkspaceGraph(
  pool: Pool,
  workspaceId: string,
  nodeId?: string,
  limit = 200,
): Promise<{
  nodes: Array<{ id: string; name: string; kind: string }>;
  edges: SearchRelationRecord[];
}> {
  const relationResult = await pool.query<any>(
    `select r."id", r."workspace_id", r."from_node_id", r."to_node_id",
            r."relation_type"::text as "relation_type", r."label", r."metadata",
            r."created_at", r."updated_at"
     from "content_relations" r
     join "content_nodes" f
       on f."workspace_id" = r."workspace_id" and f."id" = r."from_node_id"
     join "content_nodes" t
       on t."workspace_id" = r."workspace_id" and t."id" = r."to_node_id"
     where r."workspace_id" = $1
       and f."trashed_at" is null and t."trashed_at" is null
       and ($2::uuid is null or r."from_node_id" = $2 or r."to_node_id" = $2)
     order by r."updated_at" desc, r."id" desc
     limit $3`,
    [workspaceId, nodeId ?? null, Math.min(Math.max(limit, 1), 500)],
  );
  const edges = relationResult.rows.map(toRelation);
  const ids = [...new Set(edges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]))];
  if (ids.length === 0) return { nodes: [], edges: [] };
  const nodes = await pool.query<{ id: string; name: string; kind: string }>(
    `select "id", "name", "kind"::text as "kind"
     from "content_nodes"
     where "workspace_id" = $1 and "id" = any($2::uuid[]) and "trashed_at" is null`,
    [workspaceId, ids],
  );
  return { nodes: nodes.rows, edges };
}

export async function getSearchIndexStatus(
  pool: Pool,
  workspaceId: string,
): Promise<{
  lastReconciledAt: Date | null;
  indexedNodes: number;
  laggingNodes: number;
  lastError: string | null;
}> {
  const result = await pool.query<{
    last_reconciled_at: Date | null;
    indexed_nodes: string;
    lagging_nodes: string;
    last_error: string | null;
  }>(
    `select "last_reconciled_at", "indexed_nodes", "lagging_nodes", "last_error"
     from "search_index_state"
     where "workspace_id" = $1
     limit 1`,
    [workspaceId],
  );
  const row = result.rows[0];
  return {
    lastReconciledAt: row?.last_reconciled_at ?? null,
    indexedNodes: Number(row?.indexed_nodes ?? 0),
    laggingNodes: Number(row?.lagging_nodes ?? 0),
    lastError: row?.last_error ?? null,
  };
}
