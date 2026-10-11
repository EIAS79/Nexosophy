import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Pool } from "pg";

const MIGRATION_LOCK_ID = 724_213;
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, "..", "drizzle");

export async function migrate(connectionString = process.env.DATABASE_URL): Promise<string[]> {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);

    await client.query(`
      create table if not exists "_nexosophy_migrations" (
        "name" text primary key,
        "applied_at" timestamp with time zone not null default now()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort((a, b) => a.localeCompare(b));

    for (const name of files) {
      const existing = await client.query<{ name: string }>(
        'select "name" from "_nexosophy_migrations" where "name" = $1',
        [name],
      );

      if (existing.rowCount && existing.rowCount > 0) {
        continue;
      }

      const sql = await readFile(join(migrationsDirectory, name), "utf8");

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query('insert into "_nexosophy_migrations" ("name") values ($1)', [name]);
        await client.query("commit");
        applied.push(name);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    return applied;
  } finally {
    try {
      await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const applied = await migrate();
  process.stdout.write(
    applied.length === 0
      ? "Database schema is already current.\n"
      : `Applied migrations: ${applied.join(", ")}\n`,
  );
}
