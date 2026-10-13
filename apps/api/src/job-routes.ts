import type { AuthVerifier } from "@nexosophy/auth";
import { jobParamsSchema, listJobsQuerySchema } from "@nexosophy/contracts";
import {
  getDurableJob,
  listWorkspaceDeadLetters,
  listWorkspaceJobs,
  replayDeadLetter,
} from "@nexosophy/db";
import type { FastifyInstance } from "fastify";

import {
  authorizeWorkspace,
  type DatabasePool,
  denyWorkspaceAuth,
  requireWorkspacePrincipal,
  sendWorkspaceError,
} from "./workspace-route-common.js";

export async function registerJobRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyWorkspaceAuth,
): Promise<void> {
  app.get("/v1/jobs/:jobId", async (request, reply) => {
    const { jobId } = jobParamsSchema.parse(request.params);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    const job = await getDurableJob(pool, jobId);
    if (!job || !job.workspaceId) {
      return sendWorkspaceError(
        reply,
        request.id,
        404,
        "JOB_NOT_FOUND",
        "Job not found.",
      );
    }
    if (
      !(await authorizeWorkspace(
        pool,
        principal,
        job.workspaceId,
        "content.read",
        request,
        reply,
      ))
    ) {
      return;
    }
    return job;
  });

  app.get("/v1/workspaces/:workspaceId/jobs", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const query = listJobsQuerySchema.parse(request.query);
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(
        pool,
        principal,
        workspaceId,
        "content.read",
        request,
        reply,
      ))
    ) {
      return;
    }
    return listWorkspaceJobs(pool, workspaceId, {
      limit: query.limit,
      cursor: query.cursor,
    });
  });

  app.get("/v1/workspaces/:workspaceId/dead-letters", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const principal = await requireWorkspacePrincipal(request, reply, verifier);
    if (!principal) return;
    if (
      !(await authorizeWorkspace(
        pool,
        principal,
        workspaceId,
        "workspace.update",
        request,
        reply,
      ))
    ) {
      return;
    }
    return { items: await listWorkspaceDeadLetters(pool, workspaceId, 50) };
  });

  app.post(
    "/v1/workspaces/:workspaceId/dead-letters/:deadLetterId/replay",
    async (request, reply) => {
      const { workspaceId, deadLetterId } = request.params as {
        workspaceId: string;
        deadLetterId: string;
      };
      const principal = await requireWorkspacePrincipal(request, reply, verifier);
      if (!principal) return;
      if (
        !(await authorizeWorkspace(
          pool,
          principal,
          workspaceId,
          "workspace.update",
          request,
          reply,
        ))
      ) {
        return;
      }
      const allowed = (await listWorkspaceDeadLetters(pool, workspaceId, 100)).some(
        (item) => item.id === deadLetterId,
      );
      if (!allowed || !(await replayDeadLetter(pool, deadLetterId))) {
        return sendWorkspaceError(
          reply,
          request.id,
          404,
          "DEAD_LETTER_NOT_FOUND",
          "Dead letter is unavailable for replay.",
        );
      }
      reply.code(202);
      return { status: "queued" };
    },
  );
}
