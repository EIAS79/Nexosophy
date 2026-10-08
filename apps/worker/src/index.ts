import { parseMediaServicesEnv, parseOptionalStorageEnv, parseWorkerEnv } from "@nexosophy/config";
import {
  claimDeletionJob,
  claimNextDurableJob,
  claimNextAssetJob,
  claimNextContentOperation,
  claimOutboxEvent,
  completeAssetCleanup,
  completeAssetScan,
  completeAssetVariant,
  completeDeletionJob,
  completeDurableJob,
  ContentStoreError,
  createDatabasePool,
  enqueueDurableJob,
  failAssetJob,
  failContentOperation,
  failDeletionJob,
  failDurableJob,
  failOutboxEvent,
  getAsset,
  getAssetStorageKeys,
  indexSearchNode,
  enqueueExpiredTrash,
  listExpiredMultipartUploads,
  markExpiredUpload,
  markOutboxPublished,
  processContentOperationBatch,
  processDeletionBatch,
  reconcileSearchIndexBatch,
  reindexWorkspaceSearchBatch,
  updateDurableJobProgress,
} from "@nexosophy/db";
import { createLogger } from "@nexosophy/observability";
import { S3CompatibleStorageAdapter } from "@nexosophy/storage";
import { Queue, Worker } from "bullmq";
import Fastify from "fastify";

const env = parseWorkerEnv();
const logger = createLogger("nexosophy-worker", env.LOG_LEVEL);
const redisUrl = new URL(env.REDIS_URL);
const storageEnv = parseOptionalStorageEnv();
const mediaServices = parseMediaServicesEnv();
const storage = storageEnv
  ? new S3CompatibleStorageAdapter({
      endpoint: storageEnv.S3_ENDPOINT,
      region: storageEnv.S3_REGION,
      bucket: storageEnv.S3_BUCKET,
      accessKeyId: storageEnv.S3_ACCESS_KEY_ID,
      secretAccessKey: storageEnv.S3_SECRET_ACCESS_KEY,
      sessionToken: storageEnv.S3_SESSION_TOKEN,
    })
  : null;
const contentPool = createDatabasePool(env.DATABASE_URL, {
  max: Math.min(
    env.DB_POOL_MAX,
    Math.min(Math.max(env.WORKER_CONCURRENCY + 2, 4), 12),
  ),
});
const workerId = `${process.env.HOSTNAME ?? "worker"}:${process.pid}`;
let stopping = false;

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
  ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
};

const systemQueue = new Queue("nexosophy-system", { connection });

const worker = new Worker(
  "nexosophy-system",
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "Processing system job");
    const data = job.data as {
      outboxEventId?: string;
      workspaceId?: string | null;
      aggregateType?: string;
      aggregateId?: string;
      payload?: Record<string, unknown>;
    };
    if (data.workspaceId && data.outboxEventId) {
      const payloadNodeId =
        typeof data.payload?.nodeId === "string" ? data.payload.nodeId : null;
      const aggregateNodeId =
        new Set(["content", "document", "spatial_document"]).has(
          data.aggregateType ?? "",
        ) && typeof data.aggregateId === "string"
          ? data.aggregateId
          : null;
      const nodeId = payloadNodeId ?? aggregateNodeId;
      if (nodeId) {
        await enqueueDurableJob(contentPool, {
          workspaceId: data.workspaceId,
          queue: "search",
          jobType: "index_node",
          payload: { nodeId },
          dedupeKey: "search-outbox-" + data.outboxEventId,
          maxAttempts: 8,
        });
      }
    }
    return { ok: true };
  },
  {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
  },
);

worker.on("error", (error) => {
  logger.error({ err: error }, "Worker error");
});

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function permanentContentFailure(error: unknown): boolean {
  return (
    error instanceof ContentStoreError &&
    new Set([
      "NAME_CONFLICT",
      "NODE_NOT_FOUND",
      "PARENT_NOT_FOUND",
      "PARENT_NOT_FOLDER",
      "TARGET_NOT_FOUND",
      "CYCLE",
      "OPERATION_CANCELLED",
    ]).has(error.code)
  );
}

async function runContentOperationLoop(): Promise<void> {
  while (!stopping) {
    let operationId: string | null = null;
    try {
      const claimed = await claimNextContentOperation(contentPool, workerId);
      if (!claimed) {
        await delay(500);
        continue;
      }

      operationId = claimed.id;
      logger.info(
        {
          operationId: claimed.id,
          operation: claimed.operation,
          totalNodes: claimed.totalNodes,
          attempt: claimed.attempts,
        },
        "Processing content operation",
      );

      let current = claimed;
      while (!stopping && current.status === "running") {
        current = await processContentOperationBatch(contentPool, current.id);
      }

      if (current.status === "succeeded") {
        logger.info(
          {
            operationId: current.id,
            operation: current.operation,
            processedNodes: current.processedNodes,
          },
          "Content operation completed",
        );
      }
    } catch (error) {
      logger.error({ err: error, operationId }, "Content operation batch failed");
      if (operationId) {
        await failContentOperation(contentPool, operationId, {
          code: error instanceof ContentStoreError ? error.code : "CONTENT_OPERATION_FAILED",
          message: error instanceof Error ? error.message : "Unknown content operation failure.",
          retryable: !permanentContentFailure(error),
        });
      }
      await delay(250);
    }
  }
}


async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("Media service returned status " + response.status + ".");
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function processAssetJob(job: Awaited<ReturnType<typeof claimNextAssetJob>>): Promise<void> {
  if (!job) return;
  if (!storage) throw new Error("Object storage is not configured.");

  if (job.jobType === "cleanup") {
    const keys = await getAssetStorageKeys(contentPool, job.workspaceId, job.assetId);
    if (keys) {
      for (const key of [keys.source, ...keys.variants]) {
        await storage.deleteObject(key);
      }
    }
    await completeAssetCleanup(contentPool, job.id, job.workspaceId, job.assetId);
    return;
  }

  const asset = await getAsset(contentPool, job.workspaceId, job.assetId);
  if (!asset) throw new Error("Asset is unavailable for processing.");
  const source = await storage.createDownloadUrl({
    key: asset.objectKey,
    expiresInSeconds: 15 * 60,
  });

  if (job.jobType === "scan") {
    if (!mediaServices.MALWARE_SCANNER_URL) {
      throw new Error("Malware scanner service is not configured.");
    }
    const result = await postJson<{
      clean: boolean;
      detectedMime: string;
      scanner?: string;
      scannerVersion?: string;
      resultCode?: string;
      checksumSha256?: string;
      metadata?: Record<string, unknown>;
    }>(mediaServices.MALWARE_SCANNER_URL, {
      sourceUrl: source.url,
      filename: asset.originalFilename,
      declaredMime: asset.declaredMime,
      sizeBytes: asset.sizeBytes,
      checksumSha256: asset.checksumSha256,
    });
    if (!result.detectedMime) throw new Error("Scanner response omitted detected MIME type.");
    await completeAssetScan(contentPool, {
      jobId: job.id,
      workspaceId: job.workspaceId,
      assetId: job.assetId,
      clean: result.clean,
      detectedMime: result.detectedMime,
      scanner: result.scanner ?? "remote-policy",
      scannerVersion: result.scannerVersion,
      resultCode: result.resultCode,
      checksumSha256: result.checksumSha256,
      metadata: result.metadata,
    });
    return;
  }

  if (!mediaServices.MEDIA_PROCESSOR_URL) {
    throw new Error("Media processor service is not configured.");
  }

  const outputKey =
    "workspaces/" +
    job.workspaceId +
    "/assets/" +
    job.assetId +
    "/variants/" +
    job.jobType;
  const target = await storage.createUploadUrl({
    key: outputKey,
    contentType: "application/octet-stream",
    expiresInSeconds: 15 * 60,
  });
  const result = await postJson<{
    mimeType?: string | null;
    sizeBytes?: number | null;
    checksumSha256?: string | null;
    fidelityLabel?: string | null;
    metadata?: Record<string, unknown>;
  }>(mediaServices.MEDIA_PROCESSOR_URL, {
    jobType: job.jobType,
    source: {
      url: source.url,
      filename: asset.originalFilename,
      mimeType: asset.detectedMime ?? asset.declaredMime,
      sizeBytes: asset.sizeBytes,
    },
    target,
  });

  await completeAssetVariant(contentPool, {
    jobId: job.id,
    workspaceId: job.workspaceId,
    assetId: job.assetId,
    kind: job.jobType,
    objectKey: outputKey,
    mimeType: result.mimeType,
    sizeBytes: result.sizeBytes,
    checksumSha256: result.checksumSha256,
    fidelityLabel:
      result.fidelityLabel ??
      (job.jobType === "office_preview" ? "converted-preview" : null),
    metadata: result.metadata,
  });
}

let lastUploadCleanupAt = 0;

async function cleanupExpiredUploads(): Promise<void> {
  if (!storage || Date.now() - lastUploadCleanupAt < 60_000) return;
  lastUploadCleanupAt = Date.now();
  const expired = await listExpiredMultipartUploads(contentPool, 50);
  for (const upload of expired) {
    try {
      await storage.abortMultipartUpload({
        key: upload.objectKey,
        uploadId: upload.storageUploadId,
      });
    } catch (error) {
      logger.warn({ err: error, uploadSessionId: upload.sessionId }, "Multipart cleanup failed");
      continue;
    }
    await markExpiredUpload(contentPool, upload.workspaceId, upload.sessionId);
  }
}

async function runAssetOperationLoop(): Promise<void> {
  while (!stopping) {
    let jobId: string | null = null;
    try {
      await cleanupExpiredUploads();
      const job = await claimNextAssetJob(contentPool, workerId);
      if (!job) {
        await delay(500);
        continue;
      }
      jobId = job.id;
      logger.info(
        { assetJobId: job.id, assetId: job.assetId, jobType: job.jobType, attempt: job.attempts },
        "Processing asset job",
      );
      await processAssetJob(job);
      logger.info({ assetJobId: job.id, jobType: job.jobType }, "Asset job completed");
    } catch (error) {
      logger.error({ err: error, assetJobId: jobId }, "Asset job failed");
      if (jobId) {
        await failAssetJob(
          contentPool,
          jobId,
          error instanceof Error ? error : new Error("Unknown asset job failure."),
          true,
        );
      }
      await delay(500);
    }
  }
}


async function runOutboxPublisherLoop(): Promise<void> {
  while (!stopping) {
    try {
      const waiting = await systemQueue.getWaitingCount();
      if (waiting > 10_000) {
        logger.warn({ waiting }, "System queue backpressure active");
        await delay(1_000);
        continue;
      }

      const event = await claimOutboxEvent(contentPool, workerId);
      if (!event) {
        await delay(350);
        continue;
      }

      try {
        await systemQueue.add(
          event.eventType,
          {
            outboxEventId: event.id,
            workspaceId: event.workspaceId,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payload: event.payload,
          },
          {
            jobId: "outbox-" + event.id,
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: { age: 3600, count: 5000 },
            removeOnFail: { age: 7 * 24 * 3600, count: 10000 },
          },
        );
        await markOutboxPublished(contentPool, event.id);
      } catch (error) {
        await failOutboxEvent(
          contentPool,
          event,
          error instanceof Error ? error : new Error("Unknown outbox publication failure."),
        );
      }
    } catch (error) {
      logger.error({ err: error }, "Outbox publisher loop failed");
      await delay(750);
    }
  }
}


let lastRetentionSweepAt = 0;

async function runDeletionLoop(): Promise<void> {
  while (!stopping) {
    try {
      if (Date.now() - lastRetentionSweepAt > 60_000) {
        lastRetentionSweepAt = Date.now();
        const enqueued = await enqueueExpiredTrash(contentPool, 100);
        if (enqueued > 0) {
          logger.info({ enqueued }, "Retention sweeper queued expired trash");
        }
      }

      const job = await claimDeletionJob(contentPool, workerId);
      if (!job) {
        await delay(500);
        continue;
      }

      try {
        let status: "running" | "succeeded" = "running";
        while (!stopping && status === "running") {
          status = await processDeletionBatch(contentPool, job, 200);
        }
        if (status === "succeeded") {
          await completeDeletionJob(contentPool, job);
          logger.info(
            {
              deletionJobId: job.id,
              rootNodeId: job.rootNodeId,
              totalNodes: job.totalNodes,
            },
            "Permanent deletion completed",
          );
        }
      } catch (error) {
        await failDeletionJob(
          contentPool,
          job,
          error instanceof Error ? error : new Error("Unknown deletion failure."),
        );
        logger.error({ err: error, deletionJobId: job.id }, "Permanent deletion batch failed");
      }
    } catch (error) {
      logger.error({ err: error }, "Deletion/retention loop failed");
      await delay(750);
    }
  }
}


let lastSearchReconcileAt = 0;

async function runSearchLoop(): Promise<void> {
  while (!stopping) {
    try {
      if (Date.now() - lastSearchReconcileAt > 15_000) {
        lastSearchReconcileAt = Date.now();
        const reconciled = await reconcileSearchIndexBatch(contentPool, 100);
        if (reconciled.indexed > 0) {
          logger.info(
            { indexed: reconciled.indexed, workspaces: reconciled.workspaces.length },
            "Search reconciliation indexed stale nodes",
          );
        }
      }

      const job = await claimNextDurableJob(contentPool, "search", workerId);
      if (!job) {
        await delay(500);
        continue;
      }

      try {
        if (job.jobType === "index_node") {
          const nodeId = typeof job.payload.nodeId === "string" ? job.payload.nodeId : "";
          if (!job.workspaceId || !nodeId) throw new Error("Invalid index_node payload.");
          const outcome = await indexSearchNode(contentPool, job.workspaceId, nodeId);
          await completeDurableJob(contentPool, job.id, { outcome, nodeId });
          continue;
        }

        if (job.jobType === "reindex_workspace") {
          if (!job.workspaceId) throw new Error("Workspace is required for reindex.");
          await contentPool.query(
            `insert into "search_index_state"
               ("workspace_id", "last_backfill_started_at", "updated_at")
             values ($1, now(), now())
             on conflict ("workspace_id")
             do update set "last_backfill_started_at" = now(),
                           "last_error" = null, "updated_at" = now()`,
            [job.workspaceId],
          );
          let cursor: string | undefined;
          let processed = 0;
          while (!stopping) {
            const batch = await reindexWorkspaceSearchBatch(contentPool, {
              workspaceId: job.workspaceId,
              afterNodeId: cursor,
              limit: 100,
            });
            processed += batch.processed;
            await updateDurableJobProgress(contentPool, job.id, {
              processed,
              cursor: batch.nextCursor,
            });
            if (batch.done) break;
            cursor = batch.nextCursor ?? undefined;
            await delay(20);
          }
          await contentPool.query(
            `update "search_index_state"
             set "last_backfill_completed_at" = now(), "updated_at" = now()
             where "workspace_id" = $1`,
            [job.workspaceId],
          );
          await completeDurableJob(contentPool, job.id, { processed, completed: true });
          continue;
        }

        throw new Error("Unknown search job type: " + job.jobType);
      } catch (error) {
        await failDurableJob(contentPool, job.id, {
          code: "SEARCH_JOB_FAILED",
          message: error instanceof Error ? error.message : "Unknown search job failure.",
          retryable: true,
        });
        if (job.workspaceId) {
          await contentPool.query(
            `insert into "search_index_state" ("workspace_id", "last_error", "updated_at")
             values ($1, $2, now())
             on conflict ("workspace_id")
             do update set "last_error" = excluded."last_error", "updated_at" = now()`,
            [
              job.workspaceId,
              error instanceof Error ? error.message.slice(0, 1000) : "Unknown search failure.",
            ],
          );
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Search indexing loop failed");
      await delay(750);
    }
  }
}

const contentLoop = runContentOperationLoop();
const assetLoop = runAssetOperationLoop();
const outboxLoop = runOutboxPublisherLoop();
const deletionLoop = runDeletionLoop();
const searchLoop = runSearchLoop();
const health = Fastify({ loggerInstance: logger });

health.get("/health", async () => ({
  service: "worker",
  status: "ok",
  timestamp: new Date().toISOString(),
}));

health.get("/ready", async (_request, reply) => {
  try {
    await Promise.all([
      worker.waitUntilReady(),
      systemQueue.waitUntilReady(),
      contentPool.query("select 1"),
    ]);
    return {
      service: "worker",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn({ err: error }, "Worker readiness check failed");
    reply.code(503);
    return {
      service: "worker",
      status: "unavailable",
      timestamp: new Date().toISOString(),
    };
  }
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down worker");
  stopping = true;
  await health.close();
  await Promise.all([contentLoop, assetLoop, outboxLoop, deletionLoop, searchLoop]);
  await worker.close();
  await systemQueue.close();
  await contentPool.end();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await health.listen({
  host: env.WORKER_HEALTH_HOST,
  port: env.WORKER_HEALTH_PORT,
});

logger.info(
  {
    concurrency: env.WORKER_CONCURRENCY,
    contentBatchSize: 200,
    assetProcessing: true,
    outboxPublisher: true,
    retentionSweeper: true,
    permanentDeletion: true,
    searchIndexing: true,
    storageConfigured: Boolean(storage),
  },
  "Worker started",
);