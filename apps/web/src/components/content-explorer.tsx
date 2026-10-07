"use client";

import type { ContentNode, ContentNodeKind, ContentNodePage } from "@nexosophy/contracts";
import { Button, ModalDialog } from "@nexosophy/ui";
import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import styles from "./content-explorer.module.css";

const ROOT_KEY = "root";

type VisibleNode = {
  node: ContentNode;
  depth: number;
  parentId: string | null;
};

function bucketKey(parentId: string | null): string {
  return parentId ?? ROOT_KEY;
}

function nodeGlyph(kind: ContentNodeKind): string {
  switch (kind) {
    case "folder":
      return "▣";
    case "shortcut":
      return "↗";
    case "whiteboard":
      return "◇";
    case "dataset":
    case "spreadsheet":
      return "▦";
    case "attachment":
      return "⌁";
    default:
      return "▤";
  }
}

async function responseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export function ContentExplorer({
  workspaceId,
  initialRoot,
  favorites,
  recent,
}: {
  workspaceId: string;
  initialRoot: ContentNodePage;
  favorites: readonly ContentNode[];
  recent: readonly ContentNode[];
}) {
  const [buckets, setBuckets] = useState<Record<string, ContentNode[]>>({
    [ROOT_KEY]: initialRoot.items,
  });
  const [nextCursors, setNextCursors] = useState<Record<string, string | null>>({
    [ROOT_KEY]: initialRoot.nextCursor,
  });
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [activeId, setActiveId] = useState(initialRoot.items[0]?.id ?? "");
  const [selected, setSelected] = useState<ContentNode | null>(initialRoot.items[0] ?? null);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<ContentNode[]>([]);
  const [loading, setLoading] = useState(() => new Set<string>());
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"list" | "tree">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const output: VisibleNode[] = [];
    const visit = (nodes: readonly ContentNode[], depth: number, parentId: string | null) => {
      for (const node of nodes) {
        output.push({ node, depth, parentId });
        if (node.kind === "folder" && expanded.has(node.id)) {
          visit(buckets[bucketKey(node.id)] ?? [], depth + 1, node.id);
        }
      }
    };
    visit(buckets[ROOT_KEY] ?? [], 1, null);
    return output;
  }, [buckets, expanded]);

  const loadedFolders = useMemo(() => {
    const map = new Map<string, ContentNode>();
    for (const nodes of Object.values(buckets)) {
      for (const node of nodes) {
        if (node.kind === "folder") map.set(node.id, node);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [buckets]);

  const currentItems = buckets[bucketKey(currentParentId)] ?? [];
  const currentCursor = nextCursors[bucketKey(currentParentId)] ?? null;

  function focusNode(id: string) {
    setActiveId(id);
    requestAnimationFrame(() => {
      treeRef.current
        ?.querySelector<HTMLElement>(`[data-content-tree-id="${CSS.escape(id)}"]`)
        ?.focus();
    });
  }

  async function fetchChildren(parentId: string | null, append = false) {
    const key = bucketKey(parentId);
    setLoading((current) => new Set(current).add(key));
    setStatus("");
    try {
      const query = new URLSearchParams({
        parentId: parentId ?? "root",
        limit: "50",
      });
      if (append && nextCursors[key]) query.set("cursor", nextCursors[key] ?? "");
      const response = await fetch(`/api/content/${workspaceId}?${query.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await responseError(response));
      const page = (await response.json()) as ContentNodePage;
      setBuckets((current) => {
        const existing = append ? (current[key] ?? []) : [];
        const merged = new Map(existing.map((item) => [item.id, item]));
        for (const item of page.items) merged.set(item.id, item);
        return { ...current, [key]: [...merged.values()] };
      });
      setNextCursors((current) => ({ ...current, [key]: page.nextCursor }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load content.");
    } finally {
      setLoading((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function fetchBreadcrumbs(nodeId: string) {
    try {
      const response = await fetch(
        `/api/content/${workspaceId}?view=breadcrumbs&nodeId=${encodeURIComponent(nodeId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const payload = (await response.json()) as { items: ContentNode[] };
      setBreadcrumbs(payload.items);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load breadcrumbs.");
    }
  }

  async function ensureFolder(node: ContentNode) {
    if (node.kind !== "folder") return;
    if (buckets[bucketKey(node.id)] === undefined) {
      await fetchChildren(node.id);
    }
  }

  async function selectNode(node: ContentNode) {
    setSelected(node);
    setActiveId(node.id);
    if (node.kind === "folder") {
      setCurrentParentId(node.id);
      await Promise.all([ensureFolder(node), fetchBreadcrumbs(node.id)]);
    } else {
      void fetch(`/api/content/${workspaceId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "recent", nodeId: node.id }),
      });
    }
  }

  async function toggleFolder(node: ContentNode) {
    if (node.kind !== "folder") return;
    if (!expanded.has(node.id)) await ensureFolder(node);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  function openRoot() {
    setCurrentParentId(null);
    setBreadcrumbs([]);
  }

  async function mutate(payload: Record<string, unknown>) {
    const response = await fetch(`/api/content/${workspaceId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await responseError(response));
    if (response.status === 204) return null;
    return (await response.json()) as unknown;
  }

  async function refreshParents(...parents: Array<string | null>) {
    const unique = [...new Set(parents.map(bucketKey))];
    await Promise.all(unique.map((key) => fetchChildren(key === ROOT_KEY ? null : key)));
  }

  async function performMove(node: ContentNode, parentId: string | null) {
    if (node.id === parentId) {
      setStatus("A folder cannot be moved into itself.");
      return;
    }
    try {
      setStatus("Moving…");
      const updated = (await mutate({
        action: "move",
        nodeId: node.id,
        parentId,
        expectedVersion: node.version,
      })) as ContentNode;
      await refreshParents(node.parentId, parentId);
      setSelected(updated);
      setMoveOpen(false);
      setStatus("Moved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Move failed.");
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const kind = String(data.get("kind") ?? "folder") as ContentNodeKind;
    if (!name) return;
    try {
      setStatus("Creating…");
      const created = (await mutate({
        action: "create",
        parentId: currentParentId,
        name,
        kind,
      })) as ContentNode;
      await refreshParents(currentParentId);
      setSelected(created);
      setCreateOpen(false);
      setStatus("Created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create failed.");
    }
  }

  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    try {
      setStatus("Renaming…");
      const updated = (await mutate({
        action: "rename",
        nodeId: selected.id,
        name,
        expectedVersion: selected.version,
      })) as ContentNode;
      await refreshParents(selected.parentId);
      setSelected(updated);
      setRenameOpen(false);
      setStatus("Renamed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Rename failed.");
    }
  }

  async function copySelected() {
    if (!selected) return;
    try {
      setStatus("Copying…");
      const result = (await mutate({
        action: "copy",
        nodeId: selected.id,
        parentId: currentParentId,
        name: `${selected.name} copy`,
        idempotencyKey: crypto.randomUUID(),
      })) as { status?: string };
      await refreshParents(currentParentId);
      setStatus(result.status === "queued" ? "Large copy queued." : "Copied.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Copy failed.");
    }
  }

  async function trashSelected() {
    if (!selected) return;
    const sourceParent = selected.parentId;
    try {
      setStatus("Moving to trash…");
      const result = (await mutate({
        action: "trash",
        nodeId: selected.id,
        idempotencyKey: crypto.randomUUID(),
      })) as { status?: string };
      await refreshParents(sourceParent);
      setSelected(null);
      setStatus(result.status === "queued" ? "Large trash operation queued." : "Moved to trash.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trash failed.");
    }
  }

  async function toggleFavorite(pin = false) {
    if (!selected) return;
    try {
      const favorite = pin ? true : !selected.favorite;
      const pinned = pin ? !selected.pinned : selected.pinned === true && favorite;
      await mutate({
        action: "favorite",
        nodeId: selected.id,
        favorite,
        pinned,
      });
      setSelected({ ...selected, favorite, pinned });
      setStatus(
        pin ? (pinned ? "Pinned." : "Unpinned.") : favorite ? "Favorited." : "Unfavorited.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Favorite update failed.");
    }
  }

  function onTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = visible.findIndex(({ node }) => node.id === activeId);
    const current = visible[index];
    if (!current) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = visible[Math.min(index + 1, visible.length - 1)];
      if (next) focusNode(next.node.id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = visible[Math.max(index - 1, 0)];
      if (next) focusNode(next.node.id);
    } else if (event.key === "ArrowRight" && current.node.kind === "folder") {
      event.preventDefault();
      if (!expanded.has(current.node.id)) {
        void toggleFolder(current.node);
      } else {
        const child = buckets[bucketKey(current.node.id)]?.[0];
        if (child) focusNode(child.id);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (expanded.has(current.node.id)) {
        void toggleFolder(current.node);
      } else if (current.parentId) {
        focusNode(current.parentId);
      }
    } else if (event.key === "Home") {
      event.preventDefault();
      if (visible[0]) focusNode(visible[0].node.id);
    } else if (event.key === "End") {
      event.preventDefault();
      const last = visible.at(-1);
      if (last) focusNode(last.node.id);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void selectNode(current.node);
    }
  }

  function startDrag(event: DragEvent<HTMLElement>, nodeId: string) {
    setDraggedId(nodeId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", nodeId);
  }

  function dropOnFolder(event: DragEvent<HTMLElement>, folder: ContentNode | null) {
    event.preventDefault();
    const id = draggedId ?? event.dataTransfer.getData("text/plain");
    const moving = Object.values(buckets)
      .flat()
      .find((item) => item.id === id);
    setDraggedId(null);
    if (moving) void performMove(moving, folder?.id ?? null);
  }

  return (
    <section className={styles.explorer} aria-label="Workspace content explorer">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Workspace explorer</p>
          <h1>Files & knowledge</h1>
          <p>One recursive tree for folders and every native Nexosophy document type.</p>
        </div>
        <div className={styles.toolbar}>
          <Button onClick={() => setCreateOpen(true)}>New</Button>
          <Button variant="secondary" disabled={!selected} onClick={() => setRenameOpen(true)}>
            Rename
          </Button>
          <Button variant="secondary" disabled={!selected} onClick={() => setMoveOpen(true)}>
            Move
          </Button>
          <Button variant="secondary" disabled={!selected} onClick={() => void copySelected()}>
            Copy
          </Button>
          <Button variant="danger" disabled={!selected} onClick={() => void trashSelected()}>
            Trash
          </Button>
        </div>
      </header>

      <div className={styles.quickRows}>
        <div>
          <strong>Pinned / favorites</strong>
          <div className={styles.chips}>
            {favorites.slice(0, 6).map((node) => (
              <button key={node.id} type="button" onClick={() => void selectNode(node)}>
                {node.name}
              </button>
            ))}
            {favorites.length === 0 ? <span>Nothing favorited yet</span> : null}
          </div>
        </div>
        <div>
          <strong>Recent</strong>
          <div className={styles.chips}>
            {recent.slice(0, 6).map((node) => (
              <button key={node.id} type="button" onClick={() => void selectNode(node)}>
                {node.name}
              </button>
            ))}
            {recent.length === 0 ? <span>No recent items yet</span> : null}
          </div>
        </div>
      </div>

      <div className={styles.surface}>
        <aside className={styles.treePane}>
          <div className={styles.rootDrop}>
            <button
              type="button"
              onClick={openRoot}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropOnFolder(event, null)}
            >
              Workspace root
            </button>
            <span>Drop here to move to root</span>
          </div>
          <div
            ref={treeRef}
            role="tree"
            aria-label="Workspace files"
            className={styles.tree}
            onKeyDown={onTreeKeyDown}
          >
            {visible.map(({ node, depth }) => {
              const isFolder = node.kind === "folder";
              const isExpanded = isFolder ? expanded.has(node.id) : undefined;
              return (
                <div
                  key={node.id}
                  role="treeitem"
                  aria-level={depth}
                  aria-expanded={isFolder ? isExpanded : undefined}
                  tabIndex={activeId === node.id ? 0 : -1}
                  data-content-tree-id={node.id}
                  draggable
                  className={selected?.id === node.id ? styles.treeItemSelected : styles.treeItem}
                  style={{ paddingInlineStart: `${Math.max(0, depth - 1) * 18 + 6}px` }}
                  onFocus={() => setActiveId(node.id)}
                  onDragStart={(event) => startDrag(event, node.id)}
                  onDragOver={(event) => {
                    if (isFolder) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (isFolder) dropOnFolder(event, node);
                  }}
                >
                  {isFolder ? (
                    <button
                      className={styles.disclosure}
                      type="button"
                      aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
                      tabIndex={-1}
                      onClick={() => void toggleFolder(node)}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className={styles.disclosureSpacer} aria-hidden="true" />
                  )}
                  <button
                    className={styles.treeLabel}
                    type="button"
                    tabIndex={-1}
                    onClick={() => void selectNode(node)}
                  >
                    <span aria-hidden="true">{nodeGlyph(node.kind)}</span>
                    <span>{node.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className={styles.listPane}>
          <div className={styles.listTop}>
            <nav aria-label="Content breadcrumb" className={styles.contentBreadcrumbs}>
              <button type="button" onClick={openRoot}>
                Root
              </button>
              {breadcrumbs.map((node) => (
                <span key={node.id}>
                  <span aria-hidden="true">/</span>
                  <button type="button" onClick={() => void selectNode(node)}>
                    {node.name}
                  </button>
                </span>
              ))}
            </nav>
            <fieldset className={styles.viewToggle} aria-label="Explorer view">
              <button type="button" aria-pressed={mode === "list"} onClick={() => setMode("list")}>
                List
              </button>
              <button type="button" aria-pressed={mode === "tree"} onClick={() => setMode("tree")}>
                Compact
              </button>
            </fieldset>
          </div>

          <div className={mode === "list" ? styles.itemsList : styles.itemsCompact}>
            {currentItems.map((node) => (
              <article
                key={node.id}
                className={selected?.id === node.id ? styles.itemSelected : styles.item}
                draggable
                onDragStart={(event) => startDrag(event, node.id)}
                onDragOver={(event) => {
                  if (node.kind === "folder") event.preventDefault();
                }}
                onDrop={(event) => {
                  if (node.kind === "folder") dropOnFolder(event, node);
                }}
              >
                <button
                  type="button"
                  className={styles.itemMain}
                  onClick={() => void selectNode(node)}
                >
                  <span className={styles.itemGlyph} aria-hidden="true">
                    {nodeGlyph(node.kind)}
                  </span>
                  <span>
                    <strong>{node.name}</strong>
                    <small>
                      {node.kind.replaceAll("_", " ")} · v{node.version}
                    </small>
                  </span>
                </button>
                {node.kind !== "folder" ? (
                  <a href={`/app/workspaces/${workspaceId}/node/${node.id}`}>Open</a>
                ) : (
                  <button type="button" onClick={() => void selectNode(node)}>
                    Browse
                  </button>
                )}
              </article>
            ))}
            {currentItems.length === 0 && !loading.has(bucketKey(currentParentId)) ? (
              <div className={styles.empty}>
                <strong>This folder is empty.</strong>
                <span>Create a folder or document to start organizing this workspace.</span>
              </div>
            ) : null}
          </div>

          {loading.has(bucketKey(currentParentId)) ? (
            <p className={styles.status}>Loading…</p>
          ) : null}
          {currentCursor ? (
            <Button variant="secondary" onClick={() => void fetchChildren(currentParentId, true)}>
              Load more
            </Button>
          ) : null}
        </div>

        <aside className={styles.inspector}>
          <h2>Inspector</h2>
          {selected ? (
            <>
              <div className={styles.inspectorTitle}>
                <span aria-hidden="true">{nodeGlyph(selected.kind)}</span>
                <div>
                  <strong>{selected.name}</strong>
                  <span>{selected.kind.replaceAll("_", " ")}</span>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Version</dt>
                  <dd>{selected.version}</dd>
                </div>
                <div>
                  <dt>Children</dt>
                  <dd>{selected.hasChildren ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{new Date(selected.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
              <div className={styles.inspectorActions}>
                <Button variant="secondary" onClick={() => void toggleFavorite(false)}>
                  {selected.favorite ? "Unfavorite" : "Favorite"}
                </Button>
                <Button variant="secondary" onClick={() => void toggleFavorite(true)}>
                  {selected.pinned ? "Unpin" : "Pin"}
                </Button>
              </div>
            </>
          ) : (
            <p>Select an item to inspect it.</p>
          )}
        </aside>
      </div>

      <p className={styles.live} aria-live="polite">
        {status}
      </p>

      <ModalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create content"
        description="Create in the folder currently open in the explorer."
      >
        <form className={styles.dialogForm} onSubmit={onCreate}>
          <label>
            Name
            <input name="name" maxLength={255} required />
          </label>
          <label>
            Type
            <select name="kind" defaultValue="folder">
              <option value="folder">Folder</option>
              <option value="note">Note</option>
              <option value="document">Document</option>
              <option value="whiteboard">Whiteboard</option>
              <option value="dataset">Dataset</option>
              <option value="spreadsheet">Spreadsheet</option>
              <option value="notebook">Notebook</option>
              <option value="report">Report</option>
              <option value="research_item">Research item</option>
              <option value="lab_record">Lab record</option>
              <option value="attachment">Attachment alias</option>
            </select>
          </label>
          <Button type="submit">Create</Button>
        </form>
      </ModalDialog>

      <ModalDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename item"
        description="Optimistic version checks prevent overwriting a concurrent rename or move."
      >
        <form className={styles.dialogForm} onSubmit={onRename}>
          <label>
            Name
            <input name="name" maxLength={255} defaultValue={selected?.name ?? ""} required />
          </label>
          <Button type="submit">Rename</Button>
        </form>
      </ModalDialog>

      <ModalDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title="Move item"
        description="Choose the workspace root or a folder already loaded in this explorer."
      >
        <form
          className={styles.dialogForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!selected) return;
            const data = new FormData(event.currentTarget);
            const value = String(data.get("parentId") ?? ROOT_KEY);
            void performMove(selected, value === ROOT_KEY ? null : value);
          }}
        >
          <label>
            Destination
            <select name="parentId" defaultValue={currentParentId ?? ROOT_KEY}>
              <option value={ROOT_KEY}>Workspace root</option>
              {loadedFolders.map((folder) => (
                <option key={folder.id} value={folder.id} disabled={folder.id === selected?.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Move</Button>
        </form>
      </ModalDialog>
    </section>
  );
}