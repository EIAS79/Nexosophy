"use client";

import type { NoteHierarchyItem, SpatialPageMode } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type CreateRole = "notebook" | "section" | "page";

async function request<T>(
  workspaceId: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`/api/notes/${workspaceId}`, body
    ? {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }
    : { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Notes request failed.");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function NotebookManager({
  workspaceId,
  rootNotebookId,
}: {
  workspaceId: string;
  rootNotebookId?: string;
}) {
  const [items, setItems] = useState<NoteHierarchyItem[]>([]);
  const [status, setStatus] = useState("Loading notebooks…");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("Loading notebooks…");
    try {
      const payload = await request<{ items: NoteHierarchyItem[] }>(workspaceId);
      setItems(payload.items);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load notebooks.");
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const notebooks = useMemo(
    () =>
      items
        .filter((item) => item.role === "notebook")
        .filter((item) => !rootNotebookId || item.id === rootNotebookId),
    [items, rootNotebookId],
  );

  async function create(role: CreateRole, parentId?: string) {
    const label =
      role === "notebook" ? "Notebook name" : role === "section" ? "Section name" : "Page name";
    const name = window.prompt(label)?.trim();
    if (!name) return;
    let pageMode: SpatialPageMode = "infinite";
    if (role === "page") {
      const selected = window.prompt(
        "Page mode: infinite, vertical, or fixed",
        "infinite",
      )?.trim();
      if (selected === "vertical" || selected === "fixed") pageMode = selected;
    }

    setBusy(true);
    try {
      await request(workspaceId, {
        action: "create",
        role,
        name,
        ...(parentId ? { parentId } : {}),
        ...(role === "page" ? { pageMode } : {}),
      });
      await load();
      setStatus(`${role} created.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reorder(parentId: string, orderedNodeIds: string[]) {
    setBusy(true);
    try {
      await request(workspaceId, {
        action: "reorder",
        parentId,
        orderedNodeIds,
      });
      await load();
      setStatus("Order saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reorder failed.");
    } finally {
      setBusy(false);
    }
  }

  function move(
    siblings: NoteHierarchyItem[],
    itemId: string,
    direction: -1 | 1,
    parentId: string,
  ) {
    const ordered = siblings.map((item) => item.id);
    const index = ordered.indexOf(itemId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex]!, ordered[index]!];
    void reorder(parentId, ordered);
  }

  return (
    <section className="notes-manager" aria-labelledby="notes-manager-title">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Knowledge notebook</p>
          <h2 id="notes-manager-title">
            {rootNotebookId ? "Notebook sections and pages" : "Notebooks"}
          </h2>
          <p>
            Notebooks, sections, and pages use the universal content tree, permissions,
            trash, history, search, and collaboration model.
          </p>
        </div>
        {!rootNotebookId ? (
          <Button disabled={busy} onClick={() => void create("notebook")}>
            New notebook
          </Button>
        ) : null}
      </header>

      <div className="notes-notebook-list">
        {notebooks.map((notebook) => {
          const sections = items
            .filter((item) => item.role === "section" && item.parentId === notebook.id)
            .sort((a, b) => a.rank - b.rank);
          return (
            <article className="notes-notebook-card" key={notebook.id}>
              <header>
                <div>
                  <p className="eyebrow">Notebook</p>
                  <h3>
                    <a href={`/app/workspaces/${workspaceId}/node/${notebook.id}`}>
                      {notebook.name}
                    </a>
                  </h3>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void create("section", notebook.id)}
                >
                  New section
                </Button>
              </header>

              <div className="notes-section-list">
                {sections.map((section, sectionIndex) => {
                  const pages = items
                    .filter((item) => item.role === "page" && item.parentId === section.id)
                    .sort((a, b) => a.rank - b.rank);
                  return (
                    <section className="notes-section-card" key={section.id}>
                      <header>
                        <div>
                          <strong>{section.name}</strong>
                          <span>{pages.length} page{pages.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="notes-row-actions">
                          <button
                            type="button"
                            disabled={busy || sectionIndex === 0}
                            onClick={() => move(sections, section.id, -1, notebook.id)}
                            aria-label={`Move ${section.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={busy || sectionIndex === sections.length - 1}
                            onClick={() => move(sections, section.id, 1, notebook.id)}
                            aria-label={`Move ${section.name} down`}
                          >
                            ↓
                          </button>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void create("page", section.id)}
                          >
                            New page
                          </Button>
                        </div>
                      </header>

                      <ol className="notes-page-list">
                        {pages.map((page, pageIndex) => (
                          <li key={page.id}>
                            <a href={`/app/workspaces/${workspaceId}/node/${page.id}`}>
                              {page.name}
                            </a>
                            <div className="notes-row-actions">
                              <button
                                type="button"
                                disabled={busy || pageIndex === 0}
                                onClick={() => move(pages, page.id, -1, section.id)}
                                aria-label={`Move ${page.name} up`}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={busy || pageIndex === pages.length - 1}
                                onClick={() => move(pages, page.id, 1, section.id)}
                                aria-label={`Move ${page.name} down`}
                              >
                                ↓
                              </button>
                            </div>
                          </li>
                        ))}
                        {pages.length === 0 ? <li className="notes-empty">No pages yet.</li> : null}
                      </ol>
                    </section>
                  );
                })}
                {sections.length === 0 ? (
                  <div className="notes-empty">Create a section to start this notebook.</div>
                ) : null}
              </div>
            </article>
          );
        })}
        {notebooks.length === 0 && !status ? (
          <div className="notes-empty">No notebooks yet.</div>
        ) : null}
      </div>
      <p className="notes-live" aria-live="polite">{status}</p>
    </section>
  );
}
