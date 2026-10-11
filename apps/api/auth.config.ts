import { Pool } from "pg";
import { createNexosophyAuth } from "./src/owned-auth.js";

// Used by the pinned schema generator. No connections or credentials are
// stored in this file; required values are passed as process environment.
export const auth = createNexosophyAuth(new Pool({ connectionString: process.env.DATABASE_URL }));
