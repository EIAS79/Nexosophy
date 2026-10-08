"use client";

import type { DocumentVersion } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useState } from "react";

import styles from "./history-surfaces.module.css";

async function api<T>(workspaceId: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/history/${workspaceId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "History request failed.");
  }
  return (await response.json()) as T;
}

export function DocumentHistoryPanel({
  workspaceId,
  nodeId,
}: {
  workspaceId: string;
  nodeId: string;
}) {
  const [items, setItems] = useState<DocumentVersion[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (append = false) => {
    setStatus(append ? "Loading more history…" : "Loading history…");
    const query = new URLSearchParams({ view: "versions", nodeId });
    if (append && nextCursor) query.set("cursor", nextCursor);
    const response = await fetch(`/api/history/${workspaceId}?${query.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setStatus("Unable to load version history.");
      return;
    }
    const payload = (await response.json()) as {
      items: DocumentVersion[];
      nextCursor: string | null;
    };
    setItems((current) => (append ? [...current, ...payload.items] : payload.items));
    setNextCursor(payload.nextCursor);
    setStatus("");
  }, [nodeId, nextCursor, workspaceId]);

  useEffect(() => {
    if (open) void load(false);
  }, [open]); // load intentionally only when panel opens

  async function checkpoint() {
    const label = window.prompt("Checkpoint label (optional)")?.trim() || undefined;
    setBusy(true);
    try {
      await api(workspaceId, { action: "checkpoint", nodeId, label });
      await load(false);
      setStatus("Checkpoint created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checkpoint failed.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(version: DocumentVersion) {
    if (!window.confirm(`Restore revision ${version.sourceRevision} as a new current revision?`)) {
      return;
    }
    setBusy(true);
    try {
      await api(workspaceId, {
        action: "restoreVersion",
        nodeId,
        versionId: version.id,
      });
      setStatus("Version restored as a new revision. Reloading…");
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Restore failed.");
      setBusy(false);
    }
  }

  return (
    <section className={styles.historyPanel}>
      <div className={styles.historyHead}>
        <div>
          <p className={styles.eyebrow}>Recoverability</p>
          <h2>Version history</h2>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide history" : "Show history"}
          </Button>
          <Button variant="secondary" onClick={() => void checkpoint()} disabled={busy}>
            Create checkpoint
          </Button>
        </div>
      </div>

      {open ? (
        <div className={styles.timeline}>
          {items.map((version) => (
            <article key={version.id} className={styles.timelineItem}>
              <div>
                <strong>{version.label ?? version.reason.replaceAll("_", " ")}</strong>
                <span>
                  Revision {version.sourceRevision} ·{" "}
                  {new Date(version.createdAt).toLocaleString()}
                </span>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void restore(version)}
              >
                Restore
              </Button>
            </article>
          ))}
          {items.length === 0 && !status ? <p>No checkpoints yet.</p> : null}
          {nextCursor ? (
            <Button variant="secondary" onClick={() => void load(true)} disabled={busy}>
              Load more
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className={styles.live} aria-live="polite">{status}</p>
    </section>
  );
}
