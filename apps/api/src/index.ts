import { parseApiEnv } from "@nexosophy/config";

import { buildApp } from "./app.js";

const env = parseApiEnv();
const app = await buildApp(env);

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down API");
  await app.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({
    host: env.API_HOST,
    port: env.API_PORT,
  });
} catch (error) {
  app.log.fatal({ err: error }, "API failed to start");
  process.exit(1);
}
