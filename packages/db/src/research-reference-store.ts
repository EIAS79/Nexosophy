import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { maybeCreateDocumentCheckpoint } from "./history-store.js";
import {
  formatReference,
  parseBibTeX,
  parseRIS,
  toBibTeX,
  toRIS,
  type ParsedReference,
} from "./reference-format.js";
import { appendWorkspaceAudit, withWorkspaceTransaction } from "./workspace-store-common.js";

async function outbox(
  db: PoolClient,
  workspaceId: string,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await db.query(
    `insert into "outbox_events"
       ("workspace_id","aggregate_type","aggregate_id","event_type","payload")
     values ($1,$2,$3,$4,$5::jsonb)`,
    [workspaceId, aggregateType, aggregateId, eventType, JSON.stringify(payload)],
  );
}

async function createNode(
  db: PoolClient,
  input: {
    workspaceId: string;
    userId: string;
    parentId: string | null;
    kind: string;
    name: string;
    metadata?: Record<string, unknown>;
    body?: unknown;
  },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into "content_nodes"
       ("workspace_id","parent_id","kind","name","metadata","created_by_user_id","updated_by_user_id")
     values ($1,$2,$3::content_node_kind,$4,$5::jsonb,$6,$6)
     returning "id"`,
    [
      input.workspaceId,
      input.parentId,
      input.kind,
      input.name.trim().slice(0, 255),
      JSON.stringify(input.metadata ?? {}),
      input.userId,
    ],
  );
  const id = r.rows[0]!.id;
  if (input.body) {
    await db.query(
      `insert into "documents"
         ("workspace_id","node_id","body","created_by_user_id","updated_by_user_id")
       values ($1,$2,$3::jsonb,$4,$4)`,
      [input.workspaceId, id, JSON.stringify(input.body), input.userId],
    );
  }
  return id;
}

async function createTask(
  db: PoolClient,
  input: {
    workspaceId: string;
    userId: string;
    title: string;
    description: string;
    dueAt?: Date;
    linkedNodeId?: string | null;
  },
) {
  const r = await db.query<{ id: string }>(
    `insert into "tasks"
       ("workspace_id","title","description","priority","due_at","timezone","linked_node_id",
        "created_by_user_id","updated_by_user_id")
     values ($1,$2,$3,'high',$4,'UTC',$5,$6,$6)
     returning "id"`,
    [
      input.workspaceId,
      input.title,
      input.description,
      input.dueAt ?? null,
      input.linkedNodeId ?? null,
      input.userId,
    ],
  );
  await outbox(db, input.workspaceId, "task", r.rows[0]!.id, "productivity.task_created", {
    taskId: r.rows[0]!.id,
    userId: input.userId,
    linkedNodeId: input.linkedNodeId ?? null,
  });
  return r.rows[0]!.id;
}

async function createCalendarEvent(
  db: PoolClient,
  input: {
    workspaceId: string;
    userId: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    linkedNodeId?: string | null;
  },
) {
  const r = await db.query<{ id: string }>(
    `insert into "calendar_events"
       ("workspace_id","title","starts_at","ends_at","timezone","linked_node_id",
        "created_by_user_id","updated_by_user_id")
     values ($1,$2,$3,$4,$5,$6,$7,$7)
     returning "id"`,
    [
      input.workspaceId,
      input.title,
      input.startsAt,
      input.endsAt,
      input.timezone,
      input.linkedNodeId ?? null,
      input.userId,
    ],
  );
  await outbox(
    db,
    input.workspaceId,
    "calendar_event",
    r.rows[0]!.id,
    "productivity.calendar_event_created",
    { eventId: r.rows[0]!.id, userId: input.userId },
  );
  return r.rows[0]!.id;
}

export async function createThesisProject(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    title: string;
    degree?: string;
    field?: string;
    proposal: string;
    supervisors: Array<{ name: string; email?: string; role: string }>;
    requestId?: string;
  },
) {
  return withWorkspaceTransaction(pool, async (db) => {
    const rootNodeId = await createNode(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      parentId: null,
      kind: "folder",
      name: input.title,
      metadata: { thesisWorkspace: true },
    });
    const proposalNodeId = await createNode(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      parentId: rootNodeId,
      kind: "document",
      name: "Research proposal",
      metadata: { thesisRole: "proposal" },
      body: {
        type: "doc",
        blocks: [
          { id: randomUUID(), type: "heading", text: input.title, level: 1 },
          { id: randomUUID(), type: "paragraph", text: input.proposal },
        ],
      },
    });
    await createNode(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      parentId: rootNodeId,
      kind: "folder",
      name: "Chapters",
      metadata: { thesisRole: "chapters" },
    });
    await createNode(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      parentId: rootNodeId,
      kind: "folder",
      name: "Literature",
      metadata: { thesisRole: "literature" },
    });
    const project = await db.query<any>(
      `insert into "thesis_projects"
         ("workspace_id","title","degree","field","proposal","root_node_id","proposal_node_id",
          "created_by_user_id","updated_by_user_id")
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       returning *`,
      [
        input.workspaceId,
        input.title,
        input.degree ?? null,
        input.field ?? null,
        input.proposal,
        rootNodeId,
        proposalNodeId,
        input.userId,
      ],
    );
    const projectId = project.rows[0]!.id;
    for (const supervisor of input.supervisors) {
      await db.query(
        `insert into "thesis_supervisors" ("project_id","name","email","role")
         values ($1,$2,$3,$4)`,
        [projectId, supervisor.name, supervisor.email ?? null, supervisor.role],
      );
    }
    for (const [position, label] of [
      "Final thesis title approved",
      "All chapters complete",
      "References checked",
      "Formatting checked",
      "Ethics/approval records complete",
      "Submission files exported",
      "Defense/viva preparation complete",
    ].entries()) {
      await db.query(
        `insert into "submission_checklist" ("project_id","label","position")
         values ($1,$2,$3)`,
        [projectId, label, position],
      );
    }
    await outbox(db, input.workspaceId, "thesis_project", projectId, "research.thesis_created", {
      projectId,
      userId: input.userId,
      nodeId: rootNodeId,
    });
    await appendWorkspaceAudit(db, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "research.thesis_created",
      targetType: "thesis_project",
      targetId: projectId,
      requestId: input.requestId,
      metadata: { rootNodeId, supervisorCount: input.supervisors.length },
    });
    return { ...project.rows[0], rootNodeId, proposalNodeId };
  });
}

export async function addResearchStatement(
  pool: Pool,
  input: { workspaceId: string; projectId: string; userId: string; type: string; text: string },
) {
  const r = await pool.query<any>(
    `insert into "research_statements" ("project_id","type","text","position")
     select $2,$3::research_statement_type,$4,
            coalesce((select max("position")+1 from "research_statements" where "project_id"=$2),0)
     from "thesis_projects" p
     where p."workspace_id"=$1 and p."id"=$2
     returning *`,
    [input.workspaceId, input.projectId, input.type, input.text],
  );
  if (!r.rows[0]) throw new Error("THESIS_NOT_FOUND");
  return r.rows[0];
}

export async function addThesisChapter(
  pool: Pool,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
  },
) {
  return withWorkspaceTransaction(pool, async (db) => {
    const project = await db.query<any>(
      `select "root_node_id"
       from "thesis_projects"
       where "workspace_id"=$1 and "id"=$2
       for update`,
      [input.workspaceId, input.projectId],
    );
    if (!project.rows[0]) throw new Error("THESIS_NOT_FOUND");
    const chaptersFolder = await db.query<{ id: string }>(
      `select "id"
       from "content_nodes"
       where "workspace_id"=$1 and "parent_id"=$2
         and "metadata"->>'thesisRole'='chapters' and "trashed_at" is null
       limit 1`,
      [input.workspaceId, project.rows[0].root_node_id],
    );
    const parentId = chaptersFolder.rows[0]?.id ?? project.rows[0].root_node_id;
    const nodeId = await createNode(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      parentId,
      kind: "document",
      name: input.title,
      metadata: { thesisRole: "chapter", thesisProjectId: input.projectId },
      body: {
        type: "doc",
        blocks: [{ id: randomUUID(), type: "heading", text: input.title, level: 1 }],
      },
    });
    const p = await db.query<{ position: number }>(
      `select coalesce(max("position")+1,0) as "position"
       from "thesis_chapters" where "project_id"=$1`,
      [input.projectId],
    );
    const r = await db.query<any>(
      `insert into "thesis_chapters"
         ("workspace_id","project_id","node_id","title","position")
       values ($1,$2,$3,$4,$5)
       returning *`,
      [input.workspaceId, input.projectId, nodeId, input.title, p.rows[0]?.position ?? 0],
    );
    return { ...r.rows[0], nodeId };
  });
}

export async function createThesisMilestone(
  pool: Pool,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
    description?: string;
    dueAt?: Date;
    kind?: string;
  },
) {
  return withWorkspaceTransaction(pool, async (db) => {
    const project = await db.query<any>(
      `select "root_node_id" from "thesis_projects" where "workspace_id"=$1 and "id"=$2`,
      [input.workspaceId, input.projectId],
    );
    if (!project.rows[0]) throw new Error("THESIS_NOT_FOUND");
    const taskId = await createTask(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      title: input.title,
      description: input.description ?? "",
      dueAt: input.dueAt,
      linkedNodeId: project.rows[0].root_node_id,
    });
    const r = await db.query<any>(
      `insert into "thesis_milestones" ("project_id","task_id","kind")
       values ($1,$2,$3)
       returning *`,
      [input.projectId, taskId, input.kind ?? "milestone"],
    );
    return { ...r.rows[0], taskId };
  });
}

export async function createSupervisionMeeting(
  pool: Pool,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    agenda?: string;
  },
) {
  return withWorkspaceTransaction(pool, async (db) => {
    const project = await db.query<any>(
      `select "root_node_id" from "thesis_projects" where "workspace_id"=$1 and "id"=$2`,
      [input.workspaceId, input.projectId],
    );
    if (!project.rows[0]) throw new Error("THESIS_NOT_FOUND");
    const notesNodeId = await createNode(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      parentId: project.rows[0].root_node_id,
      kind: "document",
      name: input.title + " notes",
      metadata: { thesisRole: "supervision-notes", thesisProjectId: input.projectId },
      body: {
        type: "doc",
        blocks: [
          { id: randomUUID(), type: "heading", text: input.title, level: 2 },
          { id: randomUUID(), type: "paragraph", text: input.agenda ?? "" },
        ],
      },
    });
    const eventId = await createCalendarEvent(db, {
      workspaceId: input.workspaceId,
      userId: input.userId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      linkedNodeId: notesNodeId,
    });
    const r = await db.query<any>(
      `insert into "supervision_meetings"
         ("workspace_id","project_id","calendar_event_id","notes_node_id","agenda")
       values ($1,$2,$3,$4,$5)
       returning *`,
      [input.workspaceId, input.projectId, eventId, notesNodeId, input.agenda ?? ""],
    );
    return { ...r.rows[0], calendarEventId: eventId, notesNodeId };
  });
}

export async function appendThesisDecision(
  pool: Pool,
  input: { workspaceId: string; projectId: string; userId: string; decision: string; rationale?: string },
) {
  const r = await pool.query<any>(
    `insert into "thesis_decisions" ("project_id","decision","rationale","actor_user_id")
     select p."id",$3,$4,$5
     from "thesis_projects" p where p."workspace_id"=$1 and p."id"=$2
     returning *`,
    [input.workspaceId, input.projectId, input.decision, input.rationale ?? "", input.userId],
  );
  if (!r.rows[0]) throw new Error("THESIS_NOT_FOUND");
  return r.rows[0];
}

export async function upsertEthicsRecord(
  pool: Pool,
  input: {
    workspaceId: string;
    projectId: string;
    status: string;
    authority?: string;
    referenceNumber?: string;
    submittedOn?: string;
    approvedOn?: string;
    expiresOn?: string;
    notes?: string;
  },
) {
  const existing = await pool.query<{ id: string }>(
    `select e."id"
     from "ethics_records" e join "thesis_projects" p on p."id"=e."project_id"
     where p."workspace_id"=$1 and p."id"=$2
     order by e."updated_at" desc limit 1`,
    [input.workspaceId, input.projectId],
  );
  if (existing.rows[0]) {
    const r = await pool.query<any>(
      `update "ethics_records"
       set "status"=$3::ethics_status,"authority"=$4,"reference_number"=$5,
           "submitted_on"=$6,"approved_on"=$7,"expires_on"=$8,"notes"=$9,"updated_at"=now()
       where "id"=$2
       returning *`,
      [
        input.workspaceId,
        existing.rows[0].id,
        input.status,
        input.authority ?? null,
        input.referenceNumber ?? null,
        input.submittedOn ?? null,
        input.approvedOn ?? null,
        input.expiresOn ?? null,
        input.notes ?? "",
      ],
    );
    return r.rows[0];
  }
  const r = await pool.query<any>(
    `insert into "ethics_records"
       ("project_id","status","authority","reference_number","submitted_on","approved_on","expires_on","notes")
     select p."id",$3::ethics_status,$4,$5,$6,$7,$8,$9
     from "thesis_projects" p where p."workspace_id"=$1 and p."id"=$2
     returning *`,
    [
      input.workspaceId,
      input.projectId,
      input.status,
      input.authority ?? null,
      input.referenceNumber ?? null,
      input.submittedOn ?? null,
      input.approvedOn ?? null,
      input.expiresOn ?? null,
      input.notes ?? "",
    ],
  );
  if (!r.rows[0]) throw new Error("THESIS_NOT_FOUND");
  return r.rows[0];
}

export async function updateSubmissionChecklist(
  pool: Pool,
  input: { workspaceId: string; projectId: string; itemId: string; done: boolean },
) {
  const r = await pool.query<any>(
    `update "submission_checklist" c
     set "done"=$4,"updated_at"=now()
     from "thesis_projects" p
     where c."project_id"=p."id" and p."workspace_id"=$1 and p."id"=$2 and c."id"=$3
     returning c.*`,
    [input.workspaceId, input.projectId, input.itemId, input.done],
  );
  if (!r.rows[0]) throw new Error("CHECKLIST_ITEM_NOT_FOUND");
  return r.rows[0];
}

function referencePublic(row: any, authors: any[], identifiers: any[]) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    year: row.year,
    containerTitle: row.container_title,
    volume: row.volume,
    issue: row.issue,
    pages: row.pages,
    publisher: row.publisher,
    url: row.url,
    abstract: row.abstract,
    metadata: row.metadata ?? {},
    version: row.version,
    authors,
    identifiers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getReference(pool: Pool, workspaceId: string, referenceId: string) {
  const r = await pool.query<any>(
    `select * from "references_library" where "workspace_id"=$1 and "id"=$2`,
    [workspaceId, referenceId],
  );
  if (!r.rows[0]) throw new Error("REFERENCE_NOT_FOUND");
  const [a, i, att, ann] = await Promise.all([
    pool.query<any>(
      `select "id","position","family","given","literal" from "reference_authors"
       where "reference_id"=$1 order by "position"`,
      [referenceId],
    ),
    pool.query<any>(
      `select "id","type"::text as "type","value" from "reference_identifiers"
       where "reference_id"=$1 order by "type","value"`,
      [referenceId],
    ),
    pool.query<any>(
      `select ra.*,a."original_filename",a."detected_mime",a."declared_mime"
       from "reference_attachments" ra join "assets" a on a."id"=ra."asset_id"
       where ra."reference_id"=$1`,
      [referenceId],
    ),
    pool.query<any>(
      `select * from "reference_annotations" where "reference_id"=$1 order by "created_at" desc`,
      [referenceId],
    ),
  ]);
  return {
    ...referencePublic(r.rows[0], a.rows, i.rows),
    attachments: att.rows,
    annotations: ann.rows,
  };
}

async function findDuplicateReference(
  db: Pool | PoolClient,
  workspaceId: string,
  input: ParsedReference | {
    title: string;
    year?: number;
    identifiers: Array<{ type: string; value: string }>;
  },
) {
  for (const identifier of input.identifiers) {
    const r = await db.query<{ reference_id: string }>(
      `select i."reference_id"
       from "reference_identifiers" i
       join "references_library" r on r."id"=i."reference_id"
       where r."workspace_id"=$1 and i."workspace_id"=$1
         and i."type"=$2::identifier_type
         and i."normalized_value"=lower(trim($3))
       limit 1`,
      [workspaceId, identifier.type, identifier.value],
    );
    if (r.rows[0]) return r.rows[0].reference_id;
  }
  const r = await db.query<{ id: string }>(
    `select "id" from "references_library"
     where "workspace_id"=$1 and lower(trim("title"))=lower(trim($2))
       and "year" is not distinct from $3::integer
     order by "updated_at" desc limit 1`,
    [workspaceId, input.title, input.year ?? null],
  );
  return r.rows[0]?.id ?? null;
}

export async function createReference(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    type: string;
    title: string;
    year?: number;
    containerTitle?: string;
    publisher?: string;
    url?: string;
    abstract?: string;
    authors: Array<{ family?: string; given?: string; literal?: string }>;
    identifiers: Array<{ type: string; value: string }>;
    metadata: Record<string, unknown>;
    deduplicate?: boolean;
  },
) {
  return withWorkspaceTransaction(pool, async (db) => {
    const duplicate = input.deduplicate === false ? null : await findDuplicateReference(db, input.workspaceId, input);
    if (duplicate) return { reference: await getReference(pool, input.workspaceId, duplicate), duplicateOf: duplicate };

    const r = await db.query<any>(
      `insert into "references_library"
         ("workspace_id","type","title","year","container_title","publisher","url","abstract",
          "metadata","created_by_user_id","updated_by_user_id")
       values ($1,$2::reference_type,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$10)
       returning *`,
      [
        input.workspaceId,
        input.type,
        input.title,
        input.year ?? null,
        input.containerTitle ?? null,
        input.publisher ?? null,
        input.url ?? null,
        input.abstract ?? null,
        JSON.stringify(input.metadata),
        input.userId,
      ],
    );
    const id = r.rows[0]!.id;
    for (const [position, author] of input.authors.entries()) {
      await db.query(
        `insert into "reference_authors"
           ("reference_id","position","family","given","literal")
         values ($1,$2,$3,$4,$5)`,
        [id, position, author.family ?? null, author.given ?? null, author.literal ?? null],
      );
    }
    for (const identifier of input.identifiers) {
      await db.query(
        `insert into "reference_identifiers" ("workspace_id","reference_id","type","value")
         values ($1,$2,$3::identifier_type,$4)`,
        [input.workspaceId, id, identifier.type, identifier.value],
      );
    }
    await outbox(db, input.workspaceId, "reference", id, "research.reference_created", {
      referenceId: id,
      userId: input.userId,
    });
    return { reference: referencePublic(r.rows[0], input.authors, input.identifiers), duplicateOf: null };
  });
}

export async function listReferences(
  pool: Pool,
  input: { workspaceId: string; q?: string; limit?: number },
) {
  const r = await pool.query<any>(
    `select r.*
     from "references_library" r
     where r."workspace_id"=$1
       and ($2='' or lower(r."title"||' '||coalesce(r."abstract",'')) like '%'||lower($2)||'%'
         or exists (
           select 1 from "reference_identifiers" i
           where i."reference_id"=r."id" and lower(i."value") like '%'||lower($2)||'%'
         ))
     order by r."year" desc nulls last,r."updated_at" desc,r."id"
     limit $3`,
    [input.workspaceId, input.q ?? "", Math.min(Math.max(input.limit ?? 100, 1), 500)],
  );
  const out = [];
  for (const row of r.rows) {
    const [a, i] = await Promise.all([
      pool.query<any>(
        `select "family","given","literal" from "reference_authors"
         where "reference_id"=$1 order by "position"`,
        [row.id],
      ),
      pool.query<any>(
        `select "type"::text as "type","value" from "reference_identifiers"
         where "reference_id"=$1 order by "type","value"`,
        [row.id],
      ),
    ]);
    out.push(referencePublic(row, a.rows, i.rows));
  }
  return out;
}

export async function mergeReferences(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    keepReferenceId: string;
    mergeReferenceId: string;
  },
) {
  if (input.keepReferenceId === input.mergeReferenceId) return;
  await withWorkspaceTransaction(pool, async (db) => {
    const refs = await db.query<any>(
      `select "id" from "references_library"
       where "workspace_id"=$1 and "id"=any($2::uuid[])
       for update`,
      [input.workspaceId, [input.keepReferenceId, input.mergeReferenceId]],
    );
    if (refs.rows.length !== 2) throw new Error("REFERENCE_NOT_FOUND");

    await db.query(
      `update "citation_instances" set "reference_id"=$2
       where "workspace_id"=$1 and "reference_id"=$3`,
      [input.workspaceId, input.keepReferenceId, input.mergeReferenceId],
    );
    await db.query(
      `update "reference_annotations" set "reference_id"=$2
       where "workspace_id"=$1 and "reference_id"=$3`,
      [input.workspaceId, input.keepReferenceId, input.mergeReferenceId],
    );

    await db.query(
      `insert into "reference_attachments" ("reference_id","asset_id","label")
       select $1,"asset_id","label" from "reference_attachments"
       where "reference_id"=$2
       on conflict ("reference_id","asset_id") do nothing`,
      [input.keepReferenceId, input.mergeReferenceId],
    );
    await db.query(
      `insert into "literature_collection_items" ("collection_id","reference_id")
       select "collection_id",$1 from "literature_collection_items"
       where "reference_id"=$2
       on conflict do nothing`,
      [input.keepReferenceId, input.mergeReferenceId],
    );

    const matrix = await db.query<any>(
      `select * from "literature_matrix_rows"
       where "workspace_id"=$1 and "reference_id"=$2`,
      [input.workspaceId, input.mergeReferenceId],
    );
    for (const row of matrix.rows) {
      if (row.project_id) {
        await db.query(
          `insert into "literature_matrix_rows"
             ("workspace_id","project_id","reference_id","question","method","sample",
              "findings","limitations","relevance","custom")
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
           on conflict ("project_id","reference_id")
           do update set
             "question"=coalesce("literature_matrix_rows"."question",excluded."question"),
             "method"=coalesce("literature_matrix_rows"."method",excluded."method"),
             "sample"=coalesce("literature_matrix_rows"."sample",excluded."sample"),
             "findings"=coalesce("literature_matrix_rows"."findings",excluded."findings"),
             "limitations"=coalesce("literature_matrix_rows"."limitations",excluded."limitations"),
             "relevance"=coalesce("literature_matrix_rows"."relevance",excluded."relevance"),
             "custom"="literature_matrix_rows"."custom" || excluded."custom",
             "updated_at"=now()`,
          [
            input.workspaceId,row.project_id,input.keepReferenceId,row.question,row.method,row.sample,
            row.findings,row.limitations,row.relevance,JSON.stringify(row.custom??{}),
          ],
        );
      }
    }

    const identifiers = await db.query<any>(
      `select "type"::text as "type","value"
       from "reference_identifiers" where "reference_id"=$1`,
      [input.mergeReferenceId],
    );
    for (const identifier of identifiers.rows) {
      await db.query(
        `insert into "reference_identifiers" ("workspace_id","reference_id","type","value")
         values ($1,$2,$3::identifier_type,$4)
         on conflict ("workspace_id","type","normalized_value") do nothing`,
        [input.workspaceId,input.keepReferenceId,identifier.type,identifier.value],
      );
    }

    await db.query(
      `delete from "references_library" where "workspace_id"=$1 and "id"=$2`,
      [input.workspaceId, input.mergeReferenceId],
    );
    await appendWorkspaceAudit(db, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "research.reference_merged",
      targetType: "reference",
      targetId: input.keepReferenceId,
      metadata: { mergedReferenceId: input.mergeReferenceId },
    });
  });
}

export async function attachReferenceAsset(
  pool: Pool,
  input: { workspaceId: string; referenceId: string; assetId: string; label?: string },
) {
  const r = await pool.query(
    `insert into "reference_attachments" ("reference_id","asset_id","label")
     select r."id",a."id",$4
     from "references_library" r
     join "assets" a on a."workspace_id"=r."workspace_id"
     where r."workspace_id"=$1 and r."id"=$2 and a."id"=$3
       and a."trust_state"<>'deleted'
     on conflict do nothing`,
    [input.workspaceId, input.referenceId, input.assetId, input.label ?? null],
  );
  if ((r.rowCount ?? 0) === 0) {
    const exists = await pool.query(
      `select 1 from "reference_attachments" where "reference_id"=$1 and "asset_id"=$2`,
      [input.referenceId, input.assetId],
    );
    if (!(exists.rowCount ?? 0)) throw new Error("REFERENCE_OR_ASSET_NOT_FOUND");
  }
}

export async function createLiteratureCollection(
  pool: Pool,
  input: { workspaceId: string; projectId?: string; name: string },
) {
  const r = await pool.query<any>(
    `insert into "literature_collections" ("workspace_id","project_id","name")
     values ($1,$2,$3) returning *`,
    [input.workspaceId, input.projectId ?? null, input.name],
  );
  return r.rows[0];
}

export async function addReferenceToCollection(
  pool: Pool,
  collectionId: string,
  referenceId: string,
) {
  await pool.query(
    `insert into "literature_collection_items" ("collection_id","reference_id")
     values ($1,$2) on conflict do nothing`,
    [collectionId, referenceId],
  );
}

export async function createReferenceAnnotation(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    referenceId: string;
    noteNodeId?: string;
    quote?: string;
    comment: string;
    pageLocator?: string;
  },
) {
  const r = await pool.query<any>(
    `insert into "reference_annotations"
       ("workspace_id","reference_id","note_node_id","quote","comment","page_locator","created_by_user_id")
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [
      input.workspaceId,
      input.referenceId,
      input.noteNodeId ?? null,
      input.quote ?? null,
      input.comment,
      input.pageLocator ?? null,
      input.userId,
    ],
  );
  return r.rows[0];
}

export async function upsertLiteratureMatrixRow(
  pool: Pool,
  input: {
    workspaceId: string;
    projectId?: string;
    referenceId: string;
    question?: string;
    method?: string;
    sample?: string;
    findings?: string;
    limitations?: string;
    relevance?: string;
    custom?: Record<string, unknown>;
  },
) {
  const r = await pool.query<any>(
    `insert into "literature_matrix_rows"
       ("workspace_id","project_id","reference_id","question","method","sample",
        "findings","limitations","relevance","custom")
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     on conflict ("project_id","reference_id")
     do update set "question"=excluded."question","method"=excluded."method",
                   "sample"=excluded."sample","findings"=excluded."findings",
                   "limitations"=excluded."limitations","relevance"=excluded."relevance",
                   "custom"=excluded."custom","updated_at"=now()
     returning *`,
    [
      input.workspaceId,
      input.projectId ?? null,
      input.referenceId,
      input.question ?? null,
      input.method ?? null,
      input.sample ?? null,
      input.findings ?? null,
      input.limitations ?? null,
      input.relevance ?? null,
      JSON.stringify(input.custom ?? {}),
    ],
  );
  return r.rows[0];
}

export async function insertCitation(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    documentNodeId: string;
    referenceId: string;
    styleId: string;
    locator?: string;
    requestId?: string;
  },
) {
  return withWorkspaceTransaction(pool, async (db) => {
    const [document, reference] = await Promise.all([
      db.query<any>(
        `select "schema_version","body","revision"
         from "documents"
         where "workspace_id"=$1 and "node_id"=$2
         for update`,
        [input.workspaceId, input.documentNodeId],
      ),
      db.query<any>(
        `select * from "references_library"
         where "workspace_id"=$1 and "id"=$2`,
        [input.workspaceId, input.referenceId],
      ),
    ]);
    if (!document.rows[0]) throw new Error("DOCUMENT_NOT_FOUND");
    if (!reference.rows[0]) throw new Error("REFERENCE_NOT_FOUND");

    const authors = await db.query<any>(
      `select "family","given","literal"
       from "reference_authors" where "reference_id"=$1 order by "position"`,
      [input.referenceId],
    );
    const key = "cite-" + randomUUID();
    const rendered = formatReference(
      { ...reference.rows[0], authors: authors.rows, containerTitle: reference.rows[0].container_title },
      input.styleId,
      1,
    );
    const instance = await db.query<{ id: string }>(
      `insert into "citation_instances"
         ("workspace_id","document_node_id","reference_id","style_id","locator",
          "citation_key","created_by_user_id")
       values ($1,$2,$3,$4,$5,$6,$7)
       returning "id"`,
      [
        input.workspaceId,
        input.documentNodeId,
        input.referenceId,
        input.styleId,
        input.locator ?? null,
        key,
        input.userId,
      ],
    );

    await maybeCreateDocumentCheckpoint(db, {
      workspaceId: input.workspaceId,
      nodeId: input.documentNodeId,
      sourceRevision: document.rows[0].revision,
      schemaVersion: document.rows[0].schema_version,
      body: document.rows[0].body,
      actorUserId: input.userId,
    });

    const body = document.rows[0].body ?? { type: "doc", blocks: [] };
    const blocks = Array.isArray(body.blocks) ? [...body.blocks] : [];
    blocks.push({
      id: randomUUID(),
      type: "paragraph",
      text: "[" + (input.locator ? input.locator + " · " : "") + rendered + "]",
      citation: {
        citationInstanceId: instance.rows[0]!.id,
        referenceId: input.referenceId,
        styleId: input.styleId,
        locator: input.locator ?? null,
        key,
      },
    });
    await db.query(
      `update "documents"
       set "body"=$3::jsonb,"revision"="revision"+1,"updated_by_user_id"=$4,"updated_at"=now()
       where "workspace_id"=$1 and "node_id"=$2`,
      [input.workspaceId, input.documentNodeId, JSON.stringify({ ...body, blocks }), input.userId],
    );
    await outbox(db, input.workspaceId, "document", input.documentNodeId, "document.saved", {
      nodeId: input.documentNodeId,
      actorUserId: input.userId,
    });
    await appendWorkspaceAudit(db, {
      workspaceId: input.workspaceId,
      actorUserId: input.userId,
      action: "research.citation_inserted",
      targetType: "node",
      targetId: input.documentNodeId,
      requestId: input.requestId,
      metadata: { referenceId: input.referenceId, citationInstanceId: instance.rows[0]!.id },
    });
    return { citationInstanceId: instance.rows[0]!.id, rendered };
  });
}

export async function generateBibliography(
  pool: Pool,
  input: {
    workspaceId: string;
    styleId: string;
    documentNodeId?: string;
  },
) {
  const ids = input.documentNodeId
    ? await pool.query<{ reference_id: string }>(
        `select distinct "reference_id"
         from "citation_instances"
         where "workspace_id"=$1 and "document_node_id"=$2
         order by "reference_id"`,
        [input.workspaceId, input.documentNodeId],
      )
    : await pool.query<{ reference_id: string }>(
        `select "id" as "reference_id" from "references_library"
         where "workspace_id"=$1 order by "year","title","id"`,
        [input.workspaceId],
      );
  const refs = [];
  for (const row of ids.rows) refs.push(await getReference(pool, input.workspaceId, row.reference_id));
  return refs.map((ref, index) => ({
    referenceId: ref.id,
    text: formatReference(ref, input.styleId, index + 1),
  }));
}

export async function importReferenceText(
  pool: Pool,
  input: {
    workspaceId: string;
    userId: string;
    format: "bibtex" | "ris";
    text: string;
  },
) {
  const parsed = input.format === "bibtex" ? parseBibTeX(input.text) : parseRIS(input.text);
  const results = [];
  for (const ref of parsed.slice(0, 5000)) {
    const mappedType = new Set([
      "article","book","chapter","conference","thesis","report","web","dataset","other",
    ]).has(ref.type) ? ref.type : "other";
    results.push(
      await createReference(pool, {
        workspaceId: input.workspaceId,
        userId: input.userId,
        type: mappedType,
        title: ref.title,
        year: ref.year,
        containerTitle: ref.containerTitle,
        publisher: ref.publisher,
        url: ref.url,
        authors: ref.authors,
        identifiers: ref.identifiers,
        metadata: ref.metadata,
      }),
    );
  }
  return { imported: results.length, items: results };
}

export async function exportReferenceText(
  pool: Pool,
  input: { workspaceId: string; format: "bibtex" | "ris" },
) {
  const refs = await listReferences(pool, { workspaceId: input.workspaceId, limit: 500 });
  return {
    filename: input.format === "bibtex" ? "references.bib" : "references.ris",
    mimeType: "text/plain; charset=utf-8",
    text: input.format === "bibtex" ? toBibTeX(refs) : toRIS(refs),
  };
}

export async function resolveIdentifierBoundary(
  pool: Pool,
  input: { workspaceId: string; type: "doi" | "isbn" | "pmid" | "arxiv" | "other"; value: string },
) {
  const normalized = input.value.trim().toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
  const local = await pool.query<{ reference_id: string }>(
    `select i."reference_id"
     from "reference_identifiers" i
     join "references_library" r on r."id"=i."reference_id"
     where r."workspace_id"=$1 and i."workspace_id"=$1
       and i."type"=$2::identifier_type
       and i."normalized_value"=$3
     limit 1`,
    [input.workspaceId, input.type, normalized],
  );
  return local.rows[0]
    ? { status: "local" as const, normalized, referenceId: local.rows[0].reference_id }
    : {
        status: "external-provider-required" as const,
        normalized,
        referenceId: null,
        providerContract: {
          input: { type: input.type, normalizedValue: normalized },
          output: "CreateReference-compatible metadata",
        },
      };
}

export async function updateThesisStatus(
  pool: Pool,
  input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    status: "proposal"|"research"|"writing"|"review"|"submitted"|"defended"|"archived";
  },
) {
  const r = await pool.query(
    `update "thesis_projects"
     set "status"=$4::thesis_status,"version"="version"+1,
         "updated_by_user_id"=$3,"updated_at"=now()
     where "workspace_id"=$1 and "id"=$2`,
    [input.workspaceId,input.projectId,input.userId,input.status],
  );
  if (!(r.rowCount??0)) throw new Error("THESIS_NOT_FOUND");
}

export async function linkThesisNode(
  pool: Pool,
  input: {
    workspaceId: string;
    projectId: string;
    nodeId: string;
    kind: string;
  },
) {
  const r = await pool.query(
    `insert into "thesis_links" ("workspace_id","project_id","node_id","kind")
     select $1,p."id",n."id",$4
     from "thesis_projects" p
     join "content_nodes" n on n."workspace_id"=p."workspace_id"
     where p."workspace_id"=$1 and p."id"=$2
       and n."id"=$3 and n."trashed_at" is null
     on conflict ("project_id","node_id","kind") do nothing`,
    [input.workspaceId,input.projectId,input.nodeId,input.kind.slice(0,120)],
  );
  if (!(r.rowCount??0)) {
    const existing = await pool.query(
      `select 1 from "thesis_links"
       where "workspace_id"=$1 and "project_id"=$2 and "node_id"=$3 and "kind"=$4`,
      [input.workspaceId,input.projectId,input.nodeId,input.kind.slice(0,120)],
    );
    if (!(existing.rowCount??0)) throw new Error("THESIS_OR_NODE_NOT_FOUND");
  }
}

export async function thesisDashboard(pool: Pool, workspaceId: string) {
  const [projects, references] = await Promise.all([
    pool.query<any>(
      `select p.*,
              (select count(*) from "thesis_chapters" c where c."project_id"=p."id")::int as "chapter_count",
              (select count(*) from "submission_checklist" s where s."project_id"=p."id" and s."done")::int as "checklist_done",
              (select count(*) from "submission_checklist" s where s."project_id"=p."id")::int as "checklist_total"
       from "thesis_projects" p
       where p."workspace_id"=$1
       order by p."updated_at" desc`,
      [workspaceId],
    ),
    pool.query<{ count: string }>(
      `select count(*)::text as "count" from "references_library" where "workspace_id"=$1`,
      [workspaceId],
    ),
  ]);
  return { projects: projects.rows, referenceCount: Number(references.rows[0]?.count ?? 0) };
}

export async function thesisDetail(pool: Pool, workspaceId: string, projectId: string) {
  const p = await pool.query<any>(
    `select * from "thesis_projects" where "workspace_id"=$1 and "id"=$2`,
    [workspaceId, projectId],
  );
  if (!p.rows[0]) throw new Error("THESIS_NOT_FOUND");
  const [supervisors, statements, chapters, milestones, meetings, decisions, ethics, checklist, matrix] =
    await Promise.all([
      pool.query<any>(`select * from "thesis_supervisors" where "project_id"=$1 order by "created_at"`, [projectId]),
      pool.query<any>(`select * from "research_statements" where "project_id"=$1 order by "position","id"`, [projectId]),
      pool.query<any>(`select * from "thesis_chapters" where "project_id"=$1 order by "position","id"`, [projectId]),
      pool.query<any>(
        `select m.*,t."title",t."due_at",t."status"::text as "task_status"
         from "thesis_milestones" m join "tasks" t on t."id"=m."task_id"
         where m."project_id"=$1 order by t."due_at" nulls last`,
        [projectId],
      ),
      pool.query<any>(
        `select m.*,e."title",e."starts_at",e."ends_at"
         from "supervision_meetings" m join "calendar_events" e on e."id"=m."calendar_event_id"
         where m."project_id"=$1 order by e."starts_at" desc`,
        [projectId],
      ),
      pool.query<any>(`select * from "thesis_decisions" where "project_id"=$1 order by "id" desc`, [projectId]),
      pool.query<any>(`select * from "ethics_records" where "project_id"=$1 order by "updated_at" desc`, [projectId]),
      pool.query<any>(`select * from "submission_checklist" where "project_id"=$1 order by "position","id"`, [projectId]),
      pool.query<any>(
        `select m.*,r."title",r."year"
         from "literature_matrix_rows" m join "references_library" r on r."id"=m."reference_id"
         where m."workspace_id"=$1 and m."project_id"=$2 order by r."year" desc nulls last,r."title"`,
        [workspaceId, projectId],
      ),
    ]);
  return {
    project: p.rows[0],
    supervisors: supervisors.rows,
    statements: statements.rows,
    chapters: chapters.rows,
    milestones: milestones.rows,
    meetings: meetings.rows,
    decisions: decisions.rows,
    ethics: ethics.rows,
    checklist: checklist.rows,
    literatureMatrix: matrix.rows,
  };
}
