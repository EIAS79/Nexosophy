import { parseMediaServicesEnv, parseOptionalStorageEnv, parseWorkerEnv } from "@nexosophy/config";
import {
  claimNextAssetJob,
  claimNextContentOperation,
  claimOutboxEvent,
  completeAssetCleanup,
  completeAssetScan,
  completeAssetVariant,
  ContentStoreError,
  createDatabasePool,
  failAssetJob,
  failContentOperation,
  failOutboxEvent,
  getAsset,
  getAssetStorageKeys,
  listExpiredMultipartUploads,
  markExpiredUpload,
  markOutboxPublished,
  processContentOperationBatch,
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
  max: Math.min(Math.max(env.WORKER_CONCURRENCY + 2, 4), 12),
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
    fidelityLabel: result.fidelityLabel,
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

const contentLoop = runContentOperationLoop();
const assetLoop = runAssetOperationLoop();
const outboxLoop = runOutboxPublisherLoop();
const health = Fastify({ loggerInstance: logger });

health.get("/health", async () => ({
  service: "worker",
  status: "ok",
  timestamp: new Date().toISOString(),
}));

health.get("/ready", async (_request, reply) => {
  try {
    await Promise.all([worker.waitUntilReady(), contentPool.query("select 1")]);
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
  await worker.close();
  await systemQueue.close();
  await Promise.all([contentLoop, assetLoop, outboxLoop]);
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
    storageConfigured: Boolean(storage),
  },
  "Worker started",
);