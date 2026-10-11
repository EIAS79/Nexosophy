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

export * from "./collaboration-store.js";

export * from "./spatial-store.js";

export * from "./search-store.js";

export * from "./recurrence.js";

export * from "./productivity-store.js";

export * from "./notification-store.js";

export * from "./portable-archive-store.js";

export * from "./template-transfer-store.js";

export * from "./formula-engine.js";

export * from "./structured-code-store.js";

export * from "./flashcard-scheduler.js";

export * from "./academic-store.js";

export * from "./reference-format.js";

export * from "./research-reference-store.js";
export * from "./lab-core-store.js";
export * from "./lab-protocol-store.js";
export * from "./lab-inventory-store.js";
export * from "./lab-equipment-store.js";
export * from "./lab-compliance-store.js";
export * from "./lab-alert-store.js";
export * from "./teaching-store.js";
export * from "./reporting-store.js";
export * from "./analysis-store.js";
export * from "./integration-crypto.js";
export * from "./integration-provider.js";
export * from "./integration-store.js";
export * from "./integration-subscription-store.js";
export * from "./office-store.js";
export * from "./offline-store.js";
