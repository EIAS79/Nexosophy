"use client";

import type { AuditEvent } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useState } from "react";

import styles from "./history-surfaces.module.css";

export function AuditViewer({ workspaceId }: { workspaceId: string }) {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("Loading audit events…");

  const load = useCallback(async (append = false, cursor: string | null = null) => {
    const query = new URLSearchParams({ view: "audit" });
    if (filter.trim()) query.set("action", filter.trim());
    if (append && cursor) query.set("cursor", cursor);
    const response = await fetch(`/api/history/${workspaceId}?${query.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setStatus(response.status === 403 ? "You do not have permission to view this audit log." : "Unable to load audit events.");
      return;
    }
    const payload = (await response.json()) as {
      items: AuditEvent[];
      nextCursor: string | null;
    };
    setItems((current) => (append ? [...current, ...payload.items] : payload.items));
    setNextCursor(payload.nextCursor);
    setStatus("");
  }, [filter, workspaceId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <section className={styles.pageSurface}>
      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>Privileged traceability</p>
          <h1>Workspace audit log</h1>
          <p>Append-only security and operational events. Document bodies and secrets are redacted.</p>
        </div>
      </header>
      <form
        className={styles.filter}
        onSubmit={(event) => {
          event.preventDefault();
          void load(false);
        }}
      >
        <label>
          Exact action
          <input
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="content.subtree_trashed"
          />
        </label>
        <Button type="submit">Filter</Button>
      </form>
      <div className={styles.auditList}>
        {items.map((item) => (
          <article key={item.id} className={styles.auditItem}>
            <div>
              <strong>{item.action}</strong>
              <span>{item.targetType}{item.targetId ? ` · ${item.targetId}` : ""}</span>
            </div>
            <time dateTime={new Date(item.createdAt).toISOString()}>
              {new Date(item.createdAt).toLocaleString()}
            </time>
            <details>
              <summary>Metadata</summary>
              <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
            </details>
          </article>
        ))}
        {items.length === 0 && !status ? <div className={styles.empty}>No audit events match.</div> : null}
      </div>
      {nextCursor ? <Button variant="secondary" onClick={() => void load(true, nextCursor)}>Load more</Button> : null}
      <p className={styles.live} aria-live="polite">{status}</p>
    </section>
  );
}
