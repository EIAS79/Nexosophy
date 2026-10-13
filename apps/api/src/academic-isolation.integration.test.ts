import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addCourseSection,
  addGradeItem,
  createAcademicCourse,
  createFlashcard,
  createFlashcardDeck,
  linkCourseNode,
  createStudyPlan,
  linkStudyFocusSession,
} from "@nexosophy/db";

const url = process.env.DATABASE_URL;
const integration =
  process.env.RUN_OWNED_AUTH_INTEGRATION === "1" && url ? describe : describe.skip;

integration("Academic workspace-reference isolation / real PostgreSQL", () => {
  const pool = new Pool({ connectionString: url, max: 3 });
  let ownWorkspace = "";
  let foreignWorkspace = "";
  let foreignCourse = "";

  beforeAll(async () => {
    const makeOwner = async (label: string) => {
      const user = await pool.query<{ id: string }>(
        `insert into "users" ("status") values ('active') returning "id"`,
      );
      const id = user.rows[0]!.id;
      const workspace = await pool.query<{ id: string }>(
        `insert into "workspaces" ("type","owner_user_id","name","slug")
         values ('team',$1,$2,$3) returning "id"`,
        [id, label, "tenant-" + randomUUID().replaceAll("-", "").slice(0, 22)],
      );
      return { userId: id, workspaceId: workspace.rows[0]!.id };
    };

    const own = await makeOwner("Own workspace");
    const foreign = await makeOwner("Foreign workspace");
    ownWorkspace = own.workspaceId;
    foreignWorkspace = foreign.workspaceId;

    const term = await pool.query<{ id: string }>(
      `insert into "academic_terms"
         ("workspace_id","name","starts_on","ends_on","created_by_user_id","updated_by_user_id")
         values ($1,'Foreign term','2026-01-01','2026-12-31',$2,$2) returning "id"`,
      [foreignWorkspace, foreign.userId],
    );
    const course = await pool.query<{ id: string }>(
      `insert into "academic_courses"
         ("workspace_id","term_id","name","description","created_by_user_id","updated_by_user_id")
         values ($1,$2,'Foreign biology course','',$3,$3) returning "id"`,
      [foreignWorkspace, term.rows[0]!.id, foreign.userId],
    );
    foreignCourse = course.rows[0]!.id;
  });
  afterAll(async () => pool.end());

  it("rejects cross-workspace grade insertion atomically", async () => {
    await expect(
      addGradeItem(pool, {
        workspaceId: ownWorkspace,
        courseId: foreignCourse,
        name: "Injected grade",
        score: 100,
      }),
    ).rejects.toThrow("COURSE_NOT_FOUND");

    const legitimate = await addGradeItem(pool, {
      workspaceId: foreignWorkspace,
      courseId: foreignCourse,
      name: "Legitimate grade",
      score: 95,
    });
    expect(legitimate.id).toBeDefined();
    const count = await pool.query<{ count: string }>(
      `select count(*) from "grade_items" where "course_id"=$1`,
      [foreignCourse],
    );
    expect(Number(count.rows[0]!.count)).toBe(1);
  });

  it("rejects cross-workspace course-section insertion atomically", async () => {
    await expect(
      addCourseSection(pool, ownWorkspace, foreignCourse, "lecture", "Injected section"),
    ).rejects.toThrow("COURSE_NOT_FOUND");

    const legitimate = await addCourseSection(
      pool,
      foreignWorkspace,
      foreignCourse,
      "lecture",
      "Legitimate lecture",
    );
    expect(legitimate.id).toBeDefined();
    const count = await pool.query<{ count: string }>(
      `select count(*) from "course_sections" where "course_id"=$1`,
      [foreignCourse],
    );
    expect(Number(count.rows[0]!.count)).toBe(1);
  });

  it("rejects foreign terms before creating course resource folders", async () => {
    const term = await pool.query<{ term_id: string }>(
      `select term_id from "academic_courses" where id=$1`,
      [foreignCourse],
    );
    const owner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [ownWorkspace],
    );
    await expect(
      createAcademicCourse(pool, {
        workspaceId: ownWorkspace,
        userId: owner.rows[0]!.owner_user_id,
        termId: term.rows[0]!.term_id,
        name: "Unauthorized cross-workspace course",
        description: "",
        instructor: {},
      }),
    ).rejects.toThrow("TERM_NOT_FOUND");
    const nodes = await pool.query<{ count: string }>(
      `select count(*)::text as count from "content_nodes"
       where workspace_id=$1 and name like 'Unauthorized cross-workspace course%'`,
      [ownWorkspace],
    );
    expect(Number(nodes.rows[0]!.count)).toBe(0);
  });

  it("rejects cross-tenant course links while preserving valid local links", async () => {
    const owner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [ownWorkspace],
    );
    const node = await pool.query<{ id: string }>(
      `insert into "content_nodes"
       ("workspace_id","kind","name","created_by_user_id","updated_by_user_id")
       values ($1,'document',$2,$3,$3) returning "id"`,
      [ownWorkspace, "Local link " + randomUUID(), owner.rows[0]!.owner_user_id],
    );
    await expect(
      linkCourseNode(pool, {
        workspaceId: ownWorkspace,
        courseId: foreignCourse,
        nodeId: node.rows[0]!.id,
        linkType: "resource",
        pinned: true,
      }),
    ).rejects.toThrow("COURSE_OR_NODE_NOT_FOUND");
    const term = await pool.query<{ id: string }>(
      `insert into "academic_terms"
       ("workspace_id","name","starts_on","ends_on","created_by_user_id","updated_by_user_id")
       values ($1,'Local term','2026-01-01','2026-12-31',$2,$2) returning "id"`,
      [ownWorkspace, owner.rows[0]!.owner_user_id],
    );
    const course = await pool.query<{ id: string }>(
      `insert into "academic_courses"
       ("workspace_id","term_id","name","created_by_user_id","updated_by_user_id")
       values ($1,$2,'Local course',$3,$3) returning "id"`,
      [ownWorkspace, term.rows[0]!.id, owner.rows[0]!.owner_user_id],
    );
    await linkCourseNode(pool, {
      workspaceId: ownWorkspace,
      courseId: course.rows[0]!.id,
      nodeId: node.rows[0]!.id,
      linkType: "resource",
      pinned: true,
    });
    const links = await pool.query<{ count: string }>(
      `select count(*)::text as count from "course_links"
       where workspace_id=$1 and course_id=$2`,
      [ownWorkspace, course.rows[0]!.id],
    );
    expect(Number(links.rows[0]!.count)).toBe(1);
  });

  it("rejects foreign course and parent deck references", async () => {
    const owner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [ownWorkspace],
    );
    const otherOwner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [foreignWorkspace],
    );
    const foreignDeck = await pool.query<{ id: string }>(
      `insert into "flashcard_decks" ("workspace_id","name","created_by_user_id")
       values ($1,$2,$3) returning "id"`,
      [foreignWorkspace, "Foreign deck " + randomUUID(), otherOwner.rows[0]!.owner_user_id],
    );
    await expect(
      createFlashcardDeck(pool, {
        workspaceId: ownWorkspace,
        userId: owner.rows[0]!.owner_user_id,
        courseId: foreignCourse,
        name: "Foreign course deck",
      }),
    ).rejects.toThrow("ACADEMIC_REFERENCE_NOT_FOUND");
    await expect(
      createFlashcardDeck(pool, {
        workspaceId: ownWorkspace,
        userId: owner.rows[0]!.owner_user_id,
        parentDeckId: foreignDeck.rows[0]!.id,
        name: "Foreign parent deck",
      }),
    ).rejects.toThrow("ACADEMIC_REFERENCE_NOT_FOUND");

    const localDeck = await createFlashcardDeck(pool, {
      workspaceId: ownWorkspace,
      userId: owner.rows[0]!.owner_user_id,
      name: "Legitimate deck " + randomUUID(),
    });
    expect(localDeck.id).toBeTruthy();
    await expect(
      createFlashcard(pool, {
        workspaceId: ownWorkspace,
        deckId: foreignDeck.rows[0]!.id,
        type: "basic",
        front: "Wrong tenant",
        back: "Denied",
        tags: [],
      }),
    ).rejects.toThrow("DECK_OR_REFERENCE_NOT_FOUND");
    const localCard = await createFlashcard(pool, {
      workspaceId: ownWorkspace,
      deckId: localDeck.id,
      type: "basic",
      front: "Local card",
      back: "Allowed",
      tags: [],
    });
    expect(localCard.id).toBeTruthy();
  });


  it("rejects study plans pointing to foreign courses or source documents", async () => {
    const localOwner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [ownWorkspace],
    );
    const foreignOwner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [foreignWorkspace],
    );
    const userId = localOwner.rows[0]!.owner_user_id;
    await expect(
      createStudyPlan(pool, {
        workspaceId: ownWorkspace,
        userId,
        courseId: foreignCourse,
        title: "Unauthorized course study plan",
        topics: [],
      }),
    ).rejects.toThrow("STUDY_REFERENCE_NOT_FOUND");

    const node = await pool.query<{ id: string }>(
      `insert into "content_nodes"
       ("workspace_id","kind","name","created_by_user_id","updated_by_user_id")
       values ($1,'document',$2,$3,$3) returning "id"`,
      [
        foreignWorkspace,
        "Foreign study topic " + randomUUID(),
        foreignOwner.rows[0]!.owner_user_id,
      ],
    );
    await expect(
      createStudyPlan(pool, {
        workspaceId: ownWorkspace,
        userId,
        title: "Unauthorized source study plan",
        topics: [{ title: "Foreign topic", linkedNodeId: node.rows[0]!.id }],
      }),
    ).rejects.toThrow("STUDY_REFERENCE_NOT_FOUND");

    const plan = await createStudyPlan(pool, {
      workspaceId: ownWorkspace,
      userId,
      title: "Local revision plan " + randomUUID(),
      topics: [{ title: "Local topic" }],
    });
    expect(plan.id).toBeTruthy();
  });

  it("rejects focus-session links involving resources in other workspaces", async () => {
    const localOwner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [ownWorkspace],
    );
    const foreignOwner = await pool.query<{ owner_user_id: string }>(
      `select owner_user_id from "workspaces" where id=$1`,
      [foreignWorkspace],
    );
    const createFocus = async (workspaceId: string, userId: string) => {
      const result = await pool.query<{ id: string }>(
        `insert into "focus_sessions" ("workspace_id","user_id")
         values ($1,$2) returning "id"`,
        [workspaceId, userId],
      );
      return result.rows[0]!.id;
    };
    const localFocus = await createFocus(ownWorkspace, localOwner.rows[0]!.owner_user_id);
    const foreignFocus = await createFocus(
      foreignWorkspace,
      foreignOwner.rows[0]!.owner_user_id,
    );
    await expect(
      linkStudyFocusSession(pool, {
        workspaceId: ownWorkspace,
        focusSessionId: foreignFocus,
      }),
    ).rejects.toThrow("STUDY_REFERENCE_NOT_FOUND");
    await expect(
      linkStudyFocusSession(pool, {
        workspaceId: ownWorkspace,
        focusSessionId: localFocus,
        courseId: foreignCourse,
      }),
    ).rejects.toThrow("STUDY_REFERENCE_NOT_FOUND");

    const foreignPlan = await createStudyPlan(pool, {
      workspaceId: foreignWorkspace,
      userId: foreignOwner.rows[0]!.owner_user_id,
      title: "Foreign revision plan",
      topics: [],
    });
    await expect(
      linkStudyFocusSession(pool, {
        workspaceId: ownWorkspace,
        focusSessionId: localFocus,
        planId: foreignPlan.id,
      }),
    ).rejects.toThrow("STUDY_REFERENCE_NOT_FOUND");
    await linkStudyFocusSession(pool, {
      workspaceId: ownWorkspace,
      focusSessionId: localFocus,
    });
    const linked = await pool.query<{ count: string }>(
      `select count(*)::text as count from "study_sessions"
       where "workspace_id"=$1 and "focus_session_id"=$2`,
      [ownWorkspace, localFocus],
    );
    expect(Number(linked.rows[0]!.count)).toBe(1);
  });

});
