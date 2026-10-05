import { createHash } from "node:crypto";

import type { IdentityProvider, IdentityStorePort } from "@nexosophy/auth";
import {
  markAuthWebhookEvent,
  recordAuthWebhookReceipt,
  type createDatabasePool,
} from "@nexosophy/db";
import type { FastifyInstance, FastifyRequest } from "fastify";

type DatabasePool = ReturnType<typeof createDatabasePool>;

function requestHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, String(value));
    }
  }

  return headers;
}

function webhookRequest(request: FastifyRequest, rawBody: Buffer): Request {
  const protocol = request.protocol || "http";
  const host = request.headers.host ?? "localhost";
  const url = `${protocol}://${host}${request.raw.url ?? request.url}`;

  return new Request(url, {
    method: "POST",
    headers: requestHeaders(request),
    body: new Uint8Array(rawBody),
  });
}

export async function registerClerkWebhookRoute(
  app: FastifyInstance,
  pool: DatabasePool,
  provider: IdentityProvider,
  identityStore: IdentityStorePort,
): Promise<void> {
  await app.register(async (scope) => {
    scope.removeContentTypeParser("application/json");
    scope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer", bodyLimit: 1_048_576 },
      (_request, body, done) => done(null, body),
    );

    scope.post("/api/webhooks/clerk", async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) {
        reply.code(400);
        return {
          error: {
            code: "INVALID_WEBHOOK_BODY",
            message: "Webhook body must be raw JSON.",
            requestId: request.id,
          },
        };
      }

      const rawBody = request.body;
      const payloadHash = createHash("sha256").update(rawBody).digest("hex");

      let event;
      try {
        event = await provider.verifyWebhook(webhookRequest(request, rawBody));
      } catch (error) {
        request.log.warn({ err: error }, "Clerk webhook signature verification failed");
        reply.code(400);
        return {
          error: {
            code: "INVALID_WEBHOOK_SIGNATURE",
            message: "Webhook verification failed.",
            requestId: request.id,
          },
        };
      }

      const receipt = await recordAuthWebhookReceipt(pool, {
        provider: event.provider,
        providerEventId: event.eventId,
        eventType: event.eventType,
        payloadHash,
      });

      if (!receipt.accepted) {
        return {
          received: true,
          duplicate: true,
        };
      }

      try {
        if (!event.providerUserId) {
          await markAuthWebhookEvent(pool, receipt.eventId, "ignored");
          return {
            received: true,
            ignored: true,
          };
        }

        if (event.deleted) {
          await identityStore.handleProviderDeletion(
            event.provider,
            event.providerUserId,
            event.occurredAt,
          );
        } else if (
          event.eventType === "user.created" ||
          event.eventType === "user.updated"
        ) {
          const current = await provider.getUser(event.providerUserId);

          if (current) {
            await identityStore.sync(current, event.occurredAt);
          } else {
            await identityStore.handleProviderDeletion(
              event.provider,
              event.providerUserId,
              event.occurredAt,
            );
          }
        } else {
          await markAuthWebhookEvent(pool, receipt.eventId, "ignored");
          return {
            received: true,
            ignored: true,
          };
        }

        await markAuthWebhookEvent(pool, receipt.eventId, "processed");

        return {
          received: true,
          duplicate: false,
        };
      } catch (error) {
        await markAuthWebhookEvent(
          pool,
          receipt.eventId,
          "failed",
          "PROCESSING_FAILED",
        );
        throw error;
      }
    });
  });
}
