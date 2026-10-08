import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

export * from "./schema/system.js";
export * from "./schema/identity.js";
export * from "./identity-store.js";
export * from "./workspace-store.js";
export * from "./content-types.js";
export * from "./content-store-core.js";
export * from "./content-store-operations.js";
export * from "./asset-store.js";

export type DatabasePoolOptions = Pick<
  PoolConfig,
  "max" | "idleTimeoutMillis" | "connectionTimeoutMillis"
>;

export function createDatabasePool(
  connectionString: string,
  options: DatabasePoolOptions = {},
): Pool {
  return new Pool({
    connectionString,
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
  });
}

export function createDatabase(pool: Pool) {
  return drizzle({ client: pool });
}

export type NexosophyDatabase = ReturnType<typeof createDatabase>;
export * from "./document-store.js";
export * from "./job-store.js";

export * from "./history-store.js";
