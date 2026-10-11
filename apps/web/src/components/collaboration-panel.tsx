"use client";

import type { CollaborationComment } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useRealtimeRoom } from "./realtime-room";
import styles from "./collaboration-panel.module.css";

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? "Collaboration request failed.";
  } catch {
    return "Collaboration request failed.";
  }
}

export function CollaborationPanel({
  workspaceId,
  nodeId,
}: {
  workspaceId: string;
  nodeId: string;
}) {
  const room = useRealtimeRoom();
  const [comments, setComments] = useState<CollaborationComment[]>([]);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadComments = useCallback(async () => {
    const response = await fetch(
      `/api/collaboration/${workspaceId}/${nodeId}?view=comments`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      setStatus(await responseError(response));
      return;
    }
    const payload = (await response.json()) as { items: CollaborationComment[] };
    setComments(payload.items);
  }, [nodeId, workspaceId]);

  useEffect(() => {
    if (room.status === "connected") {
      room.sendPresence({ selection: {} });
    }
  }, [room.status, room.sendPresence]);

  useEffect(() => {
    void loadComments();
    const name = "nexosophy:comments-refresh:" + nodeId;
    const handler = () => void loadComments();
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
  }, [loadComments, nodeId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room.capabilities.includes("comment")) return;
    const data = new FormData(event.currentTarget);
    const body = String(data.get("body") ?? "").trim();
    const mentions = String(data.get("mentions") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!body) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/collaboration/${workspaceId}/${nodeId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "comment",
            body,
            mentionUserIds: mentions,
            anchor: {},
          }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const created = (await response.json()) as CollaborationComment;
      setComments((current) => [...current, created]);
      event.currentTarget.reset();
      room.notifyCommentRefresh(created.id);
      setStatus("Comment added.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Comment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(comment: CollaborationComment) {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/collaboration/${workspaceId}/${nodeId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "resolve",
            commentId: comment.id,
            resolved: comment.resolvedAt === null,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const updated = (await response.json()) as CollaborationComment;
      setComments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      room.notifyCommentRefresh(updated.id);
      setStatus(updated.resolvedAt ? "Thread resolved." : "Thread reopened.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Comment update failed.");
    } finally {
      setBusy(false);
    }
  }

  const presence = Object.values(room.presence);

  return (
    <aside className={styles.panel} aria-label="Collaboration">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Collaboration</p>
          <strong>{room.status}</strong>
          <span>
            {presence.length} other collaborator{presence.length === 1 ? "" : "s"} live
          </span>
        </div>
        <Button variant="secondary" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide" : "Show"}
        </Button>
      </header>

      {open ? (
        <>
          <section className={styles.presence} aria-label="Live collaborators">
            {presence.map((entry) => (
              <span key={entry.connectionId} title={entry.userId}>
                {entry.userId.slice(0, 8)}
              </span>
            ))}
            {presence.length === 0 ? <small>No one else is active in this room.</small> : null}
          </section>

          <div className={styles.comments}>
            {comments.map((comment) => (
              <article
                key={comment.id}
                className={styles.comment}
                data-resolved={comment.resolvedAt ? "true" : "false"}
              >
                <div>
                  <strong>{comment.createdByUserId.slice(0, 8)}</strong>
                  <time dateTime={new Date(comment.createdAt).toISOString()}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </time>
                </div>
                <p>{comment.body}</p>
                {room.capabilities.includes("comment") ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void resolve(comment)}
                  >
                    {comment.resolvedAt ? "Reopen" : "Resolve"}
                  </button>
                ) : null}
              </article>
            ))}
            {comments.length === 0 ? <p className={styles.empty}>No comments yet.</p> : null}
          </div>

          {room.capabilities.includes("comment") ? (
            <form className={styles.form} onSubmit={(event) => void create(event)}>
              <label>
                Comment
                <textarea name="body" rows={3} maxLength={10000} required />
              </label>
              <label>
                Mention user IDs
                <input name="mentions" placeholder="uuid, uuid" />
              </label>
              <Button type="submit" disabled={busy}>Add comment</Button>
            </form>
          ) : (
            <p className={styles.readOnly}>This room token is read-only.</p>
          )}
        </>
      ) : null}

      <p className={styles.live} aria-live="polite">{status}</p>
    </aside>
  );
}
