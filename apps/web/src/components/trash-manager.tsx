"use client";

import type { TrashEntry } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useState } from "react";

import styles from "./history-surfaces.module.css";

async function mutate<T>(workspaceId: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/history/${workspaceId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Trash request failed.");
  }
  return (await response.json()) as T;
}

export function TrashManager({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<TrashEntry[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading trash…");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (append = false, cursor: string | null = null) => {
    const query = new URLSearchParams();
    if (append && cursor) query.set("cursor", cursor);
    const response = await fetch(`/api/history/${workspaceId}?${query.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setStatus("Unable to load trash.");
      return;
    }
    const payload = (await response.json()) as {
      items: TrashEntry[];
      nextCursor: string | null;
      retentionDays: number;
    };
    setItems((current) => (append ? [...current, ...payload.items] : payload.items));
    setNextCursor(payload.nextCursor);
    setRetentionDays(payload.retentionDays);
    setStatus("");
  }, [workspaceId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  async function restore(item: TrashEntry) {
    setBusyId(item.nodeId);
    try {
      await mutate(workspaceId, { action: "restoreTrash", nodeId: item.nodeId });
      setItems((current) => current.filter((entry) => entry.nodeId !== item.nodeId));
      setStatus(`${item.name} restored.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: TrashEntry) {
    if (
      !window.confirm(
        `Permanently delete "${item.name}"? This queues irreversible deletion across storage and derived systems.`,
      )
    ) {
      return;
    }
    setBusyId(item.nodeId);
    try {
      const result = await mutate<{ jobId: string }>(workspaceId, {
        action: "deletePermanent",
        nodeId: item.nodeId,
      });
      setItems((current) => current.filter((entry) => entry.nodeId !== item.nodeId));
      setStatus(`Permanent deletion queued as job ${result.jobId}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Permanent deletion failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeRetention() {
    const value = window.prompt("Trash retention days (1–3650)", String(retentionDays));
    if (!value) return;
    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setStatus("Retention must be between 1 and 3650 days.");
      return;
    }
    try {
      await mutate(workspaceId, { action: "updateRetention", trashRetentionDays: days });
      setRetentionDays(days);
      await load(false);
      setStatus("Retention policy updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Retention update failed.");
    }
  }

  return (
    <section className={styles.pageSurface}>
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>Recoverable deletion</p>
          <h1>Trash</h1>
          <p>Items are retained for {retentionDays} days unless permanently deleted earlier.</p>
        </div>
        <Button variant="secondary" onClick={() => void changeRetention()}>
          Retention policy
        </Button>
      </header>

      <div className={styles.cards}>
        {items.map((item) => (
          <article className={styles.card} key={item.nodeId}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.kind.replaceAll("_", " ")}</span>
              <small>
                Deleted {new Date(item.trashedAt).toLocaleString()} · {item.daysRemaining} day
                {item.daysRemaining === 1 ? "" : "s"} remaining
              </small>
            </div>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                disabled={busyId === item.nodeId}
                onClick={() => void restore(item)}
              >
                Restore
              </Button>
              <Button
                variant="danger"
                disabled={busyId === item.nodeId}
                onClick={() => void remove(item)}
              >
                Delete permanently
              </Button>
            </div>
          </article>
        ))}
        {items.length === 0 && !status ? <div className={styles.empty}>Trash is empty.</div> : null}
      </div>

      {nextCursor ? (
        <Button variant="secondary" onClick={() => void load(true, nextCursor)}>Load more</Button>
      ) : null}
      <p className={styles.live} aria-live="polite">{status}</p>
    </section>
  );
}
