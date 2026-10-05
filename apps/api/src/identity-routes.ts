import {
  hasRecentFactorVerification,
  type AuthPrincipal,
  type AuthVerifier,
} from "@nexosophy/auth";
import {
  accountDeletionRequestSchema,
  completeOnboardingRequestSchema,
  meResponseSchema,
  patchPreferencesRequestSchema,
  patchProfileRequestSchema,
} from "@nexosophy/contracts";
import {
  appendSecurityEvent,
  finishOnboarding,
  getMeAccount,
  listSecurityEvents,
  patchUserPreferences,
  patchUserProfile,
  requestAccountDeletion,
  type createDatabasePool,
} from "@nexosophy/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type DatabasePool = ReturnType<typeof createDatabasePool>;

const denyByDefault: AuthVerifier = {
  async verify() {
    return { authenticated: false, reason: "missing" };
  },
};

function toFetchRequest(request: FastifyRequest): Request {
  const protocol = request.protocol || "http";
  const host = request.headers.host ?? "localhost";
  const url = `${protocol}://${host}${request.raw.url ?? request.url}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }

  return new Request(url, {
    method: request.method,
    headers,
  });
}

function sendError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: string,
  message: string,
) {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      requestId,
    },
  });
}

async function requirePrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  verifier: AuthVerifier,
): Promise<AuthPrincipal | null> {
  const result = await verifier.verify(toFetchRequest(request));

  if (result.authenticated) return result.principal;

  const forbidden = new Set(["suspended", "deletion_pending", "deleted"]);
  const status = forbidden.has(result.reason) ? 403 : 401;

  sendError(
    reply,
    request.id,
    status,
    status === 403 ? "ACCOUNT_UNAVAILABLE" : "UNAUTHENTICATED",
    status === 403
      ? "This account cannot access Nexosophy."
      : "Authentication is required.",
  );

  return null;
}

async function loadMeOrFail(
  pool: DatabasePool,
  principal: AuthPrincipal,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const account = await getMeAccount(pool, principal.internalUserId);
  if (!account) {
    request.log.error(
      {
        internalUserId: principal.internalUserId,
        externalIdentityId: principal.externalIdentityId,
      },
      "Authenticated principal has no internal account",
    );
    sendError(
      reply,
      request.id,
      409,
      "IDENTITY_MAPPING_INCONSISTENT",
      "Your account mapping could not be resolved.",
    );
    return null;
  }

  return account;
}

export async function registerIdentityRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  verifier: AuthVerifier = denyByDefault,
): Promise<void> {
  app.get("/v1/me", async (request, reply) => {
    const principal = await requirePrincipal(request, reply, verifier);
    if (!principal) return;

    const account = await loadMeOrFail(pool, principal, request, reply);
    if (!account) return;

    return meResponseSchema.parse(account);
  });

  app.patch("/v1/me", async (request, reply) => {
    const principal = await requirePrincipal(request, reply, verifier);
    if (!principal) return;

    const parsed = patchProfileRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        request.id,
        400,
        "VALIDATION_ERROR",
        "The profile update is invalid.",
      );
    }

    const { expectedVersion, ...patch } = parsed.data;
    const updated = await patchUserProfile(
      pool,
      principal.internalUserId,
      expectedVersion,
      patch,
    );

    if (!updated) {
      return sendError(
        reply,
        request.id,
        409,
        "VERSION_CONFLICT",
        "The profile changed in another session. Reload and try again.",
      );
    }

    await appendSecurityEvent(pool, {
      userId: principal.internalUserId,
      eventType: "profile.updated",
      outcome: "success",
      requestId: request.id,
      providerSessionId: principal.sessionId,
    });

    const account = await loadMeOrFail(pool, principal, request, reply);
    return account ? meResponseSchema.parse(account) : undefined;
  });

  app.get("/v1/me/preferences", async (request, reply) => {
    const principal = await requirePrincipal(request, reply, verifier);
    if (!principal) return;

    const account = await loadMeOrFail(pool, principal, request, reply);
    if (!account) return;

    return account.preferences;
  });

  app.patch("/v1/me/preferences", async (request, reply) => {
    const principal = await requirePrincipal(request, reply, verifier);
    if (!principal) return;

    const parsed = patchPreferencesRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        request.id,
        400,
        "VALIDATION_ERROR",
        "The preference update is invalid.",
      );
    }

    const { expectedVersion, ...patch } = parsed.data;
    const updated = await patchUserPreferences(
      pool,
      principal.internalUserId,
      expectedVersion,
      patch,
    );

    if (!updated) {
      return sendError(
        reply,
        request.id,
        409,
        "VERSION_CONFLICT",
        "Preferences changed in another session. Reload and try again.",
      );
    }

    const account = await loadMeOrFail(pool, principal, request, reply);
    return account?.preferences;
  });

  app.post("/v1/onboarding/complete", async (request, reply) => {
    const principal = await requirePrincipal(request, reply, verifier);
    if (!principal) return;

    const parsed = completeOnboardingRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(
        reply,
        request.id,
        400,
        "VALIDATION_ERROR",
        "The onboarding update is invalid.",
      );
    }

    await finishOnboarding(pool, principal.internalUserId, parsed.data);
    await appendSecurityEvent(pool, {
      userId: principal.internalUserId,
      eventType: parsed.data.skipped ? "onboarding.skipped" : "onboarding.completed",
      outcome: "success",
      requestId: request.id,
      providerSessionId: principal.sessionId,
    });

    const account = await loadMeOrFail(pool, principal, request, reply);
    return account ? meResponseSchema.parse(account) : undefined;
  });

  app.post("/v1/me/deletion-request", async (request, reply) => {
    const principal = await requirePrincipal(request, reply, verifier);
    if (!principal) return;

    if (!hasRecentFactorVerification(principal)) {
      await appendSecurityEvent(pool, {
        userId: principal.internalUserId,
        eventType: "account.deletion_reverification_required",
        outcome: "denied",
        requestId: request.id,
        providerSessionId: principal.sessionId,
      });

      return sendError(
        reply,
        request.id,
        403,
        "RECENT_AUTH_REQUIRED",
        "Recent credential verification is required for account deletion.",
      );
    }

    const parsed = accountDeletionRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendError(
        reply,
        request.id,
        400,
        "VALIDATION_ERROR",
        "The deletion request is invalid.",
      );
    }

    const result = await requestAccountDeletion(
      pool,
      principal.internalUserId,
      parsed.data.reasonCategory,
    );

    await appendSecurityEvent(pool, {
      userId: principal.internalUserId,
      eventType: "account.deletion_requested",
      outcome: "success",
      requestId: request.id,
      providerSessionId: principal.sessionId,
      metadata: { created: result.created },
    });

    reply.code(202);
    return result;
  });

  app.get("/v1/me/security-events", async (request, reply) => {
    const principal = await requirePrincipal(request, reply, verifier);
    if (!principal) return;

    return {
      events: await listSecurityEvents(pool, principal.internalUserId, 50),
    };
  });
}
