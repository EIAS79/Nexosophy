import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addCourseSection, addGradeItem } from "@nexosophy/db";

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
});
