"use client";

import type { Asset, AssetVariant } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cacheAttachmentOffline, openOfflineAttachment, removeOfflineAttachment } from "../lib/offline-client";
import { OfficeEditorLauncher } from "./office-editor-launcher";
import styles from "./asset-viewer.module.css";

type AssetPayload = {
  asset: Asset;
  variants: AssetVariant[];
};

async function messageFor(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

async function action<T>(
  workspaceId: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/uploads/${workspaceId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await messageFor(response));
  return (await response.json()) as T;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function AssetViewer({
  workspaceId,
  assetId,
}: {
  workspaceId: string;
  assetId: string;
}) {
  const [payload, setPayload] = useState<AssetPayload | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading attachment…");
  const [busy, setBusy] = useState(false);
  const [offlinePinned, setOfflinePinned] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/uploads/${workspaceId}?assetId=${encodeURIComponent(assetId)}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(await messageFor(response));
    const next = (await response.json()) as AssetPayload;
    setPayload(next);
    setStatus("");
    return next;
  }, [assetId, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    void load().catch((error) => {
      if (!cancelled) {
        setStatus(error instanceof Error ? error.message : "Unable to load attachment.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!payload || !["pending_upload", "pending_scan"].includes(payload.asset.trustState)) return;
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load, payload]);

  const previewVariant = useMemo(() => {
    if (!payload) return null;
    const priority = [
      "image_preview",
      "pdf_preview",
      "office_preview",
      "video_poster",
      "thumbnail",
    ];
    return (
      priority
        .map((kind) => payload.variants.find((variant) => variant.kind === kind && variant.status === "ready"))
        .find(Boolean) ?? null
    );
  }, [payload]);

  async function openPreview() {
    if (!previewVariant) return;
    setBusy(true);
    setStatus("Opening secure preview…");
    try {
      const signed = await action<{ url: string }>(workspaceId, {
        action: "variantDownload",
        assetId,
        variantKind: previewVariant.kind,
      });
      setPreviewUrl(signed.url);
      setPreviewMime(previewVariant.mimeType);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setStatus("Preparing secure download…");
    try {
      const signed = await action<{ url: string }>(workspaceId, {
        action: "download",
        assetId,
      });
      window.location.assign(signed.url);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOffline() {
    if (!payload) return;
    setBusy(true);
    try {
      if (offlinePinned) {
        await removeOfflineAttachment(workspaceId, assetId);
        setOfflinePinned(false);
        setStatus("Removed encrypted offline copy.");
      } else {
        const policyResponse = await fetch(`/api/offline/${workspaceId}`, { cache: "no-store" });
        const policyPayload = policyResponse.ok ? await policyResponse.json() as any : null;
        if (!policyPayload?.policy?.attachmentsAllowed) throw new Error("Workspace policy does not allow offline attachments.");
        await cacheAttachmentOffline(
          workspaceId,
          assetId,
          payload.asset.originalFilename,
          payload.asset.detectedMime ?? payload.asset.declaredMime,
          Number(policyPayload.policy.maxDeviceBytes),
        );
        setOfflinePinned(true);
        setStatus("Encrypted attachment is available offline on this browser.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Offline attachment action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openOfflineCopy() {
    const cached = await openOfflineAttachment(workspaceId, assetId);
    if (!cached) return;
    window.open(cached.url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(cached.url), 60_000);
  }

  async function remove() {
    if (!window.confirm("Move this attachment to the deletion pipeline?")) return;
    setBusy(true);
    try {
      await action(workspaceId, { action: "delete", assetId });
      setStatus("Deletion queued. Storage and derived previews will be reconciled by workers.");
      await load().catch(() => undefined);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Deletion request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!payload) {
    return (
      <section className={styles.viewer} aria-busy="true">
        <p aria-live="polite">{status}</p>
      </section>
    );
  }

  const { asset, variants } = payload;
  const processing = variants.filter((variant) =>
    ["queued", "processing"].includes(variant.status),
  );
  const failures = variants.filter((variant) => variant.status === "failed");

  return (
    <section className={styles.viewer} aria-label="Attachment">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Secure attachment</p>
          <h2>{asset.originalFilename}</h2>
          <p>
            {asset.detectedMime ?? asset.declaredMime} · {formatBytes(asset.sizeBytes)}
          </p>
        </div>
        <span className={styles.trust} data-state={asset.trustState}>
          {asset.trustState.replaceAll("_", " ")}
        </span>
      </header>

      {asset.trustState === "pending_scan" || asset.trustState === "pending_upload" ? (
        <div className={styles.notice} role="status">
          This file is not downloadable yet. Validation and malware scanning must finish first.
        </div>
      ) : null}

      {asset.trustState === "quarantined" || asset.trustState === "rejected" ? (
        <div className={styles.danger} role="alert">
          This file is quarantined and cannot be delivered. An administrator can review its audit trail.
        </div>
      ) : null}

      {asset.trustState === "trusted" ? (
        <div className={styles.actions}>
          <Button onClick={() => void download()} disabled={busy}>
            Download original
          </Button>
          <Button
            variant="secondary"
            onClick={() => void openPreview()}
            disabled={busy || !previewVariant}
          >
            {previewVariant ? "Open preview" : processing.length > 0 ? "Preview processing…" : "No preview"}
          </Button>
          <Button variant="secondary" onClick={() => void toggleOffline()} disabled={busy}>
            {offlinePinned ? "Remove offline copy" : "Make available offline"}
          </Button>
          {offlinePinned ? <Button variant="secondary" onClick={() => void openOfflineCopy()}>Open offline copy</Button> : null}
          {asset.nodeId && /(officedocument|msword|ms-excel|ms-powerpoint)/i.test(asset.detectedMime ?? asset.declaredMime) ? (
            <OfficeEditorLauncher workspaceId={workspaceId} nodeId={asset.nodeId} />
          ) : null}
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>
            Delete
          </Button>
        </div>
      ) : null}

      {previewUrl ? (
        <div className={styles.preview}>
          {previewMime?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`Preview of ${asset.originalFilename}`} />
          ) : (
            <iframe
              src={previewUrl}
              title={`Preview of ${asset.originalFilename}`}
              sandbox="allow-same-origin"
            />
          )}
        </div>
      ) : null}

      <div className={styles.variantGrid}>
        {variants.map((variant) => (
          <article key={variant.id}>
            <strong>{variant.kind.replaceAll("_", " ")}</strong>
            <span>{variant.status}</span>
            {variant.fidelityLabel ? <small>{variant.fidelityLabel}</small> : null}
          </article>
        ))}
        {variants.length === 0 ? <p>No derived previews are required yet.</p> : null}
      </div>

      {failures.length > 0 ? (
        <p className={styles.warning}>
          {failures.length} derived preview{failures.length === 1 ? "" : "s"} failed. The original trusted file remains intact.
        </p>
      ) : null}

      <p className={styles.live} aria-live="polite">
        {status}
      </p>
    </section>
  );
}