"use client";

import type {
  ContentNode,
  DocumentRecord,
  RichDocumentBlock,
  RichDocumentBody,
} from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { queueDocumentSave, readOfflineRecord, saveOfflineRecord, syncOfflineWorkspace } from "../lib/offline-client";
import styles from "./rich-document-editor.module.css";

type SaveState = "saved" | "dirty" | "saving" | "offline" | "error" | "conflict";

type Snapshot = {
  body: RichDocumentBody;
};

function cloneBody(body: RichDocumentBody): RichDocumentBody {
  return {
    type: "doc",
    blocks: body.blocks.map((block) => ({ ...block })),
  };
}

function newBlock(type: RichDocumentBlock["type"] = "paragraph"): RichDocumentBlock {
  return { id: crypto.randomUUID(), type, text: "" };
}

async function responseError(response: Response): Promise<{ code?: string; message: string }> {
  try {
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };
    return {
      code: payload.error?.code,
      message: payload.error?.message ?? `Request failed with status ${response.status}.`,
    };
  } catch {
    return { message: `Request failed with status ${response.status}.` };
  }
}

export function RichDocumentEditor({
  workspaceId,
  node,
  initialDocument,
}: {
  workspaceId: string;
  node: ContentNode;
  initialDocument: DocumentRecord;
}) {
  const [body, setBody] = useState<RichDocumentBody>(initialDocument.body);
  const [revision, setRevision] = useState(initialDocument.revision);
  const [nodeVersion, setNodeVersion] = useState(node.version);
  const [title, setTitle] = useState(node.name);
  const [acknowledgedTitle, setAcknowledgedTitle] = useState(node.name);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    initialDocument.body.blocks[0]?.id ?? null,
  );
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [insertOpen, setInsertOpen] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const lastAcknowledged = useRef<RichDocumentBody>(cloneBody(initialDocument.body));
  const saveTimer = useRef<number | null>(null);
  const saving = useRef(false);
  const pendingSave = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void readOfflineRecord<{ revision: number; body: RichDocumentBody }>(
      workspaceId,
      "document",
      node.id,
    ).then((cached) => {
      if (
        !cancelled &&
        cached?.body?.type === "doc" &&
        Array.isArray(cached.body.blocks) &&
        cached.revision >= initialDocument.revision
      ) {
        setBody(cached.body);
        setRevision(cached.revision);
        setSaveState(navigator.onLine ? "dirty" : "offline");
        setMessage("Recovered an encrypted offline document snapshot.");
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [initialDocument.revision, node.id, workspaceId]);


  const blockCount = body.blocks.length;
  const characterCount = useMemo(
    () => body.blocks.reduce((sum, block) => sum + block.text.length, 0),
    [body],
  );

  const persistRecovery = useCallback(
    (nextBody: RichDocumentBody, nextRevision = revision) => {
      void saveOfflineRecord(workspaceId, "document", node.id, {
        revision: nextRevision,
        body: nextBody,
      }).catch(() => undefined);
    },
    [node.id, revision, workspaceId],
  );

  useEffect(() => {
    persistRecovery(initialDocument.body, initialDocument.revision);
  }, [initialDocument.body, initialDocument.revision, persistRecovery]);

  function applyBody(nextBody: RichDocumentBody, pushHistory = true) {
    if (pushHistory) {
      setHistory((current) => [...current.slice(-99), { body: cloneBody(body) }]);
      setFuture([]);
    }
    setBody(nextBody);
    setSaveState(navigator.onLine ? "dirty" : "offline");
    persistRecovery(nextBody);
  }

  function updateBlock(id: string, text: string) {
    applyBody({
      type: "doc",
      blocks: body.blocks.map((block) => (block.id === id ? { ...block, text } : block)),
    });
  }

  function setBlockType(id: string, type: RichDocumentBlock["type"]) {
    applyBody({
      type: "doc",
      blocks: body.blocks.map((block) => (block.id === id ? { ...block, type } : block)),
    });
  }

  function insertBlock(type: RichDocumentBlock["type"]) {
    applyBody({ type: "doc", blocks: [...body.blocks, newBlock(type)] });
    setInsertOpen(false);
  }

  function removeBlock(id: string) {
    const remaining = body.blocks.filter((block) => block.id !== id);
    applyBody({ type: "doc", blocks: remaining.length > 0 ? remaining : [newBlock()] });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = body.blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= body.blocks.length) return;
    const blocks = [...body.blocks];
    const [moved] = blocks.splice(index, 1);
    if (!moved) return;
    blocks.splice(target, 0, moved);
    applyBody({ type: "doc", blocks });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [{ body: cloneBody(body) }, ...current].slice(0, 100));
    setBody(cloneBody(previous.body));
    setSaveState(navigator.onLine ? "dirty" : "offline");
    persistRecovery(previous.body);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current.slice(-99), { body: cloneBody(body) }]);
    setBody(cloneBody(next.body));
    setSaveState(navigator.onLine ? "dirty" : "offline");
    persistRecovery(next.body);
  }

  const save = useCallback(async () => {
    if (saving.current) {
      pendingSave.current = true;
      return;
    }
    if (!navigator.onLine) {
      await queueDocumentSave(workspaceId, node.id, revision, body);
      persistRecovery(body);
      setSaveState("offline");
      setMessage("Offline. This encrypted change is queued for replay.");
      return;
    }

    saving.current = true;
    setSaveState("saving");
    setMessage("");
    const idempotencyKey = crypto.randomUUID();
    try {
      const response = await fetch(`/api/documents/${workspaceId}/${node.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body,
          expectedRevision: revision,
          idempotencyKey,
        }),
      });
      if (!response.ok) {
        const error = await responseError(response);
        if (response.status === 412 || error.code === "DOCUMENT_VERSION_CONFLICT") {
          setSaveState("conflict");
          setMessage(
            "This document changed elsewhere. Reload the server copy or keep this local recovery draft before retrying.",
          );
          persistRecovery(body);
          return;
        }
        throw new Error(error.message);
      }
      const saved = (await response.json()) as DocumentRecord;
      setRevision(saved.revision);
      setBody(saved.body);
      lastAcknowledged.current = cloneBody(saved.body);
      persistRecovery(saved.body, saved.revision);
      setSaveState("saved");
      setMessage("Saved");
    } catch (error) {
      const networkFailure = !navigator.onLine || error instanceof TypeError;
      if (networkFailure) {
        await queueDocumentSave(workspaceId, node.id, revision, body).catch(() => undefined);
        setSaveState("offline");
        setMessage("Connection unavailable. Encrypted change queued for replay.");
      } else {
        setSaveState("error");
        setMessage(error instanceof Error ? error.message : "Autosave failed.");
      }
      persistRecovery(body);
    } finally {
      saving.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        window.setTimeout(() => void save(), 0);
      }
    }
  }, [body, node.id, persistRecovery, revision, workspaceId]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void save(), 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [body, save, saveState]);

  useEffect(() => {
    const online = () => {
      setMessage("Back online. Replaying encrypted changes…");
      void syncOfflineWorkspace(workspaceId)
        .then(async (result: any) => {
          if ((result?.conflicts?.length ?? 0) > 0) {
            setSaveState("conflict");
            setMessage("An offline edit conflicted with a newer server version. Resolve it in Offline & PWA.");
            return;
          }
          const response = await fetch(`/api/documents/${workspaceId}/${node.id}`, { cache: "no-store" });
          if (response.ok) {
            const latest = (await response.json()) as DocumentRecord;
            setRevision(latest.revision);
            setBody(latest.body);
            lastAcknowledged.current = cloneBody(latest.body);
            persistRecovery(latest.body, latest.revision);
          }
          setSaveState("saved");
          setMessage("Offline changes synchronized.");
        })
        .catch(() => setSaveState("dirty"));
    };
    const offline = () => {
      setSaveState("offline");
      setMessage("Offline. Changes are encrypted locally and queued for replay.");
      persistRecovery(body);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [body, node.id, persistRecovery, workspaceId]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving" || saveState === "offline") {
        persistRecovery(body);
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [body, persistRecovery, saveState]);

  async function saveTitle() {
    const normalized = title.trim();
    if (!normalized || normalized === acknowledgedTitle) return;
    setMessage("Saving title…");
    const response = await fetch(`/api/content/${workspaceId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "rename",
        nodeId: node.id,
        name: normalized,
        expectedVersion: nodeVersion,
      }),
    });
    if (!response.ok) {
      const error = await responseError(response);
      setMessage(error.message);
      return;
    }
    const updated = (await response.json()) as ContentNode;
    setTitle(updated.name);
    setAcknowledgedTitle(updated.name);
    setNodeVersion(updated.version);
    setMessage("Title saved.");
  }

  async function reloadServerCopy() {
    const response = await fetch(`/api/documents/${workspaceId}/${node.id}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      const error = await responseError(response);
      setMessage(error.message);
      return;
    }
    const latest = (await response.json()) as DocumentRecord;
    setRevision(latest.revision);
    setBody(latest.body);
    lastAcknowledged.current = cloneBody(latest.body);
    setHistory([]);
    setFuture([]);
    persistRecovery(latest.body, latest.revision);
    setSaveState("saved");
    setMessage("Reloaded latest server version.");
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLElement>) {
    const modifier = event.metaKey || event.ctrlKey;
    if (modifier && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }
    if (
      modifier &&
      (event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey))
    ) {
      event.preventDefault();
      redo();
      return;
    }
    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
      return;
    }
    if (event.key === "/" && !modifier) {
      const target = event.target as HTMLTextAreaElement;
      if (target.value.length === 0) setInsertOpen(true);
    }
  }

  return (
    <section className={styles.editor} onKeyDown={onEditorKeyDown}>
      <header className={styles.topbar}>
        <div className={styles.titleWrap}>
          <label htmlFor="document-title">Document title</label>
          <input
            id="document-title"
            value={title}
            maxLength={255}
            onChange={(event) => setTitle(event.currentTarget.value)}
            onBlur={() => void saveTitle()}
          />
        </div>
        <div className={styles.saveCluster}>
          <span className={styles.saveState} data-state={saveState} aria-live="polite">
            {saveState === "saved"
              ? "Saved"
              : saveState === "dirty"
                ? "Unsaved changes"
                : saveState === "saving"
                  ? "Saving…"
                  : saveState === "offline"
                    ? "Offline queued"
                    : saveState === "conflict"
                      ? "Conflict"
                      : "Save error"}
          </span>
          <Button variant="secondary" disabled={history.length === 0} onClick={undo}>
            Undo
          </Button>
          <Button variant="secondary" disabled={future.length === 0} onClick={redo}>
            Redo
          </Button>
          <Button onClick={() => void save()} disabled={saveState === "saving"}>
            Save now
          </Button>
        </div>
      </header>

      <div className={styles.meta}>
        <span>Revision {revision}</span>
        <span>{blockCount} blocks</span>
        <span>{characterCount.toLocaleString()} characters</span>
        <span>Ctrl/⌘+S save · Ctrl/⌘+Z undo · / insert</span>
      </div>

      {saveState === "conflict" ? (
        <div className={styles.conflict} role="alert">
          <p>{message}</p>
          <div>
            <Button variant="secondary" onClick={() => void reloadServerCopy()}>
              Reload server copy
            </Button>
            <Button onClick={() => setSaveState("dirty")}>Keep local draft and retry</Button>
          </div>
        </div>
      ) : null}

      <div className={styles.insertBar}>
        <Button variant="secondary" onClick={() => setInsertOpen((value) => !value)}>
          + Insert block
        </Button>
        {insertOpen ? (
          <div className={styles.insertMenu} role="menu" aria-label="Insert block">
            {(["paragraph", "heading", "bullet", "quote", "code"] as const).map((type) => (
              <button key={type} type="button" role="menuitem" onClick={() => insertBlock(type)}>
                {type}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.canvas}>
        {body.blocks.length === 0 ? (
          <button type="button" className={styles.empty} onClick={() => insertBlock("paragraph")}>
            Start writing
          </button>
        ) : null}
        {body.blocks.map((block, index) => (
          <article
            className={styles.block}
            data-kind={block.type}
            data-selected={selectedBlockId === block.id ? "true" : "false"}
            key={block.id}
          >
            <div className={styles.blockTools}>
              <label>
                <span className={styles.srOnly}>Block type</span>
                <select
                  value={block.type}
                  onChange={(event) =>
                    setBlockType(block.id, event.currentTarget.value as RichDocumentBlock["type"])
                  }
                >
                  <option value="paragraph">Paragraph</option>
                  <option value="heading">Heading</option>
                  <option value="bullet">Bullet</option>
                  <option value="quote">Quote</option>
                  <option value="code">Code</option>
                </select>
              </label>
              <button type="button" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}>
                ↑
              </button>
              <button
                type="button"
                disabled={index === body.blocks.length - 1}
                onClick={() => moveBlock(block.id, 1)}
              >
                ↓
              </button>
              <button type="button" onClick={() => removeBlock(block.id)} aria-label="Delete block">
                ×
              </button>
            </div>
            <textarea
              value={block.text}
              rows={block.type === "heading" ? 2 : block.type === "code" ? 8 : 4}
              spellCheck={block.type !== "code"}
              aria-label={`${block.type} block ${index + 1}`}
              placeholder={
                block.type === "heading"
                  ? "Heading"
                  : block.type === "code"
                    ? "Code"
                    : "Write something…"
              }
              onFocus={() => setSelectedBlockId(block.id)}
              onChange={(event) => updateBlock(block.id, event.currentTarget.value)}
            />
          </article>
        ))}
      </div>

      {saveState === "error" || saveState === "offline" ? (
        <div className={styles.recovery} role="status">
          <span>{message}</span>
          {saveState === "error" ? (
            <Button variant="secondary" onClick={() => void save()}>
              Retry save
            </Button>
          ) : null}
        </div>
      ) : (
        <p className={styles.live} aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}