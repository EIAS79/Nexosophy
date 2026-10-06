import type { AuthVerifier } from "@nexosophy/auth";
import type { FastifyInstance } from "fastify";

import {
  type DatabasePool,
  denyWorkspaceAuth,
} from "./workspace-route-common.js";
import { registerWorkspaceCoreRoutes } from "./workspace-routes-core.js";
import { registerWorkspaceMemberRoutes } from "./workspace-routes-members.js";
import { registerWorkspaceSharingRoutes } from "./workspace-routes-sharing.js";

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.addHook("onResponse", async (request, reply) => {
    if (
      request.url.startsWith("/v1/workspaces") ||
      request.url.startsWith("/v1/workspace-invitations") ||
      request.url.startsWith("/v1/ownership-transfers") ||
      request.url.startsWith("/v1/share/")
    ) {
      request.log.info(
        {
          route: request.routeOptions.url,
          statusCode: reply.statusCode,
          responseTimeMs: reply.elapsedTime,
          dbPoolTotal: pool.totalCount,
          dbPoolIdle: pool.idleCount,
          dbPoolWaiting: pool.waitingCount,
        },
        "Workspace request completed",
      );
    }
  });

  await registerWorkspaceCoreRoutes(app, pool, verifier);
  await registerWorkspaceMemberRoutes(app, pool, verifier);
  await registerWorkspaceSharingRoutes(app, pool, verifier);
}
