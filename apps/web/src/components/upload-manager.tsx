"use client";

import { useMemo, useRef, useState } from "react";

import { Button } from "@nexosophy/ui";

import styles from "./upload-manager.module.css";

type UploadState = {
  id: string;
  file: File;
  uploadSessionId?: string;
  assetId?: string;
  status: "queued" | "uploading" | "scanning" | "complete" | "failed" | "cancelled";
  uploadedBytes: number;
  totalBytes: number;
  message?: string;
};

type InitiateResponse = {
  asset: { id: string };
  upload: {
    id: string;
    partSizeBytes: number;
    expectedParts: number;
  };
};

type SessionResponse = {
  session: {
    id: string;
    partSizeBytes: number;
    expectedParts: number;
    status: string;
  };
  parts: Array<{ partNumber: number; sizeBytes: number }>;
};

type SignedPart = {
  partNumber: number;
  url: string;
  headers?: Record<string, string>;
};

async function api<T>(
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/uploads/${workspaceId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Upload request failed.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function partChecksum(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function resumeKey(workspaceId: string, file: File): string {
  return [
    "nexosophy-upload",
    workspaceId,
    file.name,
    file.size,
    file.lastModified,
  ].join(":");
}

export function UploadManager({
  workspaceId,
  parentId = null,
}: {
  workspaceId: string;
  parentId?: string | null;
}) {
  const [items, setItems] = useState<UploadState[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const activeCount = useMemo(
    () => items.filter((item) => item.status === "uploading").length,
    [items],
  );

  function patch(id: string, update: Partial<UploadState>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  async function loadResume(file: File): Promise<SessionResponse | null> {
    const stored = localStorage.getItem(resumeKey(workspaceId, file));
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as { uploadSessionId?: string };
      if (!parsed.uploadSessionId) return null;
      const response = await fetch(
        `/api/uploads/${workspaceId}?uploadSessionId=${encodeURIComponent(
          parsed.uploadSessionId,
        )}`,
        { cache: "no-store" },
      );
      if (!response.ok) return null;
      return (await response.json()) as SessionResponse;
    } catch {
      return null;
    }
  }

  async function uploadFile(item: UploadState) {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    patch(item.id, { status: "uploading", message: "Preparing upload…" });

    try {
      const resumed = await loadResume(item.file);
      let sessionId: string;
      let assetId: string | undefined;
      let partSize: number;
      let expectedParts: number;
      let completedParts = new Set<number>();

      if (
        resumed &&
        ["initiated", "uploading"].includes(resumed.session.status)
      ) {
        sessionId = resumed.session.id;
        partSize = resumed.session.partSizeBytes;
        expectedParts = resumed.session.expectedParts;
        completedParts = new Set(resumed.parts.map((part) => part.partNumber));
        patch(item.id, {
          uploadSessionId: sessionId,
          uploadedBytes: resumed.parts.reduce(
            (sum, part) => sum + part.sizeBytes,
            0,
          ),
          message: "Resuming interrupted upload…",
        });
      } else {
        const initiated = await api<InitiateResponse>(workspaceId, {
          action: "initiate",
          filename: item.file.name,
          mimeType: item.file.type || "application/octet-stream",
          sizeBytes: item.file.size,
          parentId,
        });
        sessionId = initiated.upload.id;
        assetId = initiated.asset.id;
        partSize = initiated.upload.partSizeBytes;
        expectedParts = initiated.upload.expectedParts;
        localStorage.setItem(
          resumeKey(workspaceId, item.file),
          JSON.stringify({ uploadSessionId: sessionId, assetId }),
        );
        patch(item.id, {
          uploadSessionId: sessionId,
          assetId,
          message: "Uploading directly to private object storage…",
        });
      }

      let uploadedBytes = item.uploadedBytes;
      for (let partNumber = 1; partNumber <= expectedParts; partNumber += 1) {
        if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (completedParts.has(partNumber)) continue;

        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, item.file.size);
        const blob = item.file.slice(start, end);
        const checksum = await partChecksum(blob);

        const signed = await api<SignedPart>(workspaceId, {
          action: "signPart",
          uploadSessionId: sessionId,
          partNumber,
        });
        const uploadInit: RequestInit = {
          method: "PUT",
          body: blob,
          signal: controller.signal,
        };
        if (signed.headers) uploadInit.headers = signed.headers;
        const uploadResponse = await fetch(signed.url, uploadInit);
        if (!uploadResponse.ok) {
          throw new Error(
            `Storage rejected part ${partNumber} with status ${uploadResponse.status}.`,
          );
        }
        const etag = uploadResponse.headers.get("etag");
        if (!etag) throw new Error("Storage response did not include an ETag.");

        await api(workspaceId, {
          action: "recordPart",
          uploadSessionId: sessionId,
          partNumber,
          etag,
          sizeBytes: blob.size,
          checksumSha256: checksum,
        });
        uploadedBytes += blob.size;
        patch(item.id, {
          uploadedBytes,
          message: `Uploaded part ${partNumber} of ${expectedParts}`,
        });
      }

      await api(workspaceId, {
        action: "complete",
        uploadSessionId: sessionId,
      });
      localStorage.removeItem(resumeKey(workspaceId, item.file));
      patch(item.id, {
        status: "scanning",
        uploadedBytes: item.file.size,
        message: "Upload complete. Security scan and previews are processing.",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        patch(item.id, { status: "cancelled", message: "Upload cancelled." });
      } else {
        patch(item.id, {
          status: "failed",
          message: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    } finally {
      controllers.current.delete(item.id);
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).map<UploadState>((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "queued",
      uploadedBytes: 0,
      totalBytes: file.size,
    }));
    setItems((current) => [...next, ...current]);
    for (const item of next) void uploadFile(item);
  }

  async function cancel(item: UploadState) {
    controllers.current.get(item.id)?.abort();
    if (item.uploadSessionId) {
      try {
        await api(workspaceId, {
          action: "abort",
          uploadSessionId: item.uploadSessionId,
        });
      } catch {
        // Server cleanup lifecycle will reconcile abandoned multipart uploads.
      }
    }
    localStorage.removeItem(resumeKey(workspaceId, item.file));
    patch(item.id, { status: "cancelled", message: "Upload cancelled." });
  }

  function retry(item: UploadState) {
    patch(item.id, { status: "queued", message: "Retrying…" });
    void uploadFile({ ...item, status: "queued" });
  }

  return (
    <section className={styles.manager} aria-label="Upload files">
      <div className={styles.topline}>
        <div>
          <p className={styles.eyebrow}>Direct secure uploads</p>
          <h2>Upload files</h2>
          <p>
            Files go directly to private object storage. Nexosophy only handles
            metadata, signatures, validation and processing state.
          </p>
        </div>
        <label className={styles.pick}>
          <span>Choose files</span>
          <input
            type="file"
            multiple
            onChange={(event) => onFiles(event.currentTarget.files)}
          />
        </label>
      </div>

      {activeCount > 0 ? (
        <p className={styles.live} aria-live="polite">
          {activeCount} upload{activeCount === 1 ? "" : "s"} active
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className={styles.items}>
          {items.map((item) => {
            const progress =
              item.totalBytes > 0
                ? Math.round((item.uploadedBytes / item.totalBytes) * 100)
                : 0;
            return (
              <article key={item.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <div>
                    <strong>{item.file.name}</strong>
                    <span>
                      {(item.file.size / 1024 / 1024).toFixed(1)} MB · {item.status}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    {item.status === "uploading" ? (
                      <Button
                        variant="secondary"
                        onClick={() => void cancel(item)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    {item.status === "failed" ? (
                      <Button
                        variant="secondary"
                        onClick={() => retry(item)}
                      >
                        Retry
                      </Button>
                    ) : null}
                    {item.status === "scanning" ? (
                      <Button
                        variant="secondary"
                        onClick={() => location.reload()}
                      >
                        Refresh explorer
                      </Button>
                    ) : null}
                  </div>
                </div>
                <progress
                  max={100}
                  value={progress}
                  aria-label={`Upload progress for ${item.file.name}`}
                />
                <p aria-live="polite">{item.message ?? "Queued"}</p>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}