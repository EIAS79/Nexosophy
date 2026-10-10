"use client";

import type { SavedSearch, SearchResult, Tag } from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import styles from "./workspace-search.module.css";

type HistoryItem = {
  queryText: string;
  filters: Record<string, unknown>;
  useCount: number;
  lastUsedAt: string;
};

type SearchState = {
  q: string;
  kind: string;
  ownerUserId: string;
  tagId: string;
  from: string;
  to: string;
};

const EMPTY: SearchState = {
  q: "",
  kind: "",
  ownerUserId: "",
  tagId: "",
  from: "",
  to: "",
};

function HighlightedSnippet({ value }: { value: string }) {
  const parts = value.split(/(<mark>|<\/mark>)/g);
  let marked = false;
  let offset = 0;
  return (
    <p>
      {parts.map((part) => {
        const key = `${offset}:${part}`;
        offset += part.length;
        if (part === "<mark>") {
          marked = true;
          return null;
        }
        if (part === "</mark>") {
          marked = false;
          return null;
        }
        return marked ? <mark key={key}>{part}</mark> : <span key={key}>{part}</span>;
      })}
    </p>
  );
}

async function postAction(
  workspaceId: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(`/api/search/${workspaceId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function WorkspaceSearch({ workspaceId }: { workspaceId: string }) {
  const [draft, setDraft] = useState<SearchState>(EMPTY);
  const [active, setActive] = useState<SearchState>(EMPTY);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [indexStatus, setIndexStatus] = useState<{
    lastReconciledAt: string | null;
    indexedNodes: number;
    laggingNodes: number;
    lastError: string | null;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const queryString = useCallback(
    (state: SearchState, cursor?: string | null) => {
      const query = new URLSearchParams({ q: state.q, limit: "30" });
      if (state.kind) query.set("kinds", state.kind);
      if (state.ownerUserId) query.set("ownerUserId", state.ownerUserId);
      if (state.tagId) query.set("tagIds", state.tagId);
      if (state.from) query.set("from", new Date(state.from).toISOString());
      if (state.to) query.set("to", new Date(state.to + "T23:59:59.999Z").toISOString());
      if (cursor) query.set("cursor", cursor);
      return query;
    },
    [],
  );

  const loadMeta = useCallback(async () => {
    const [tagsResponse, savedResponse, historyResponse, statusResponse] = await Promise.all([
      fetch(`/api/search/${workspaceId}?view=tags`, { cache: "no-store" }),
      fetch(`/api/search/${workspaceId}?view=saved`, { cache: "no-store" }),
      fetch(`/api/search/${workspaceId}?view=history`, { cache: "no-store" }),
      fetch(`/api/search/${workspaceId}?view=status`, { cache: "no-store" }),
    ]);
    if (tagsResponse.ok) {
      setTags(((await tagsResponse.json()) as { items: Tag[] }).items);
    }
    if (savedResponse.ok) {
      setSaved(((await savedResponse.json()) as { items: SavedSearch[] }).items);
    }
    if (historyResponse.ok) {
      setHistory(((await historyResponse.json()) as { items: HistoryItem[] }).items);
    }
    if (statusResponse.ok) {
      setIndexStatus(await statusResponse.json());
    }
  }, [workspaceId]);

  const run = useCallback(
    async (state: SearchState, append = false, cursor: string | null = null) => {
      setLoading(true);
      setStatus(append ? "Loading more results…" : "Searching…");
      try {
        const response = await fetch(
          `/api/search/${workspaceId}?${queryString(
            state,
            append ? cursor : null,
          ).toString()}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Search request failed.");
        const payload = (await response.json()) as {
          items: SearchResult[];
          nextCursor: string | null;
        };
        setItems((current) => (append ? [...current, ...payload.items] : payload.items));
        setNextCursor(payload.nextCursor);
        setActive(state);
        setStatus(
          payload.items.length === 0 && !append
            ? "No permitted content matched this search."
            : "",
        );
        void loadMeta();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Search failed.");
      } finally {
        setLoading(false);
      }
    },
    [loadMeta, queryString, workspaceId],
  );

  useEffect(() => {
    void Promise.all([loadMeta(), run(EMPTY)]);
  }, [loadMeta, run]);

  const activeQueryObject = useMemo(
    () => ({
      q: active.q,
      ...(active.kind ? { kinds: active.kind } : {}),
      ...(active.ownerUserId ? { ownerUserId: active.ownerUserId } : {}),
      ...(active.tagId ? { tagIds: active.tagId } : {}),
      ...(active.from ? { from: active.from } : {}),
      ...(active.to ? { to: active.to } : {}),
    }),
    [active],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    void run({ ...draft });
  }

  async function saveCurrent() {
    const name = window.prompt("Saved search name")?.trim();
    if (!name) return;
    const response = await postAction(workspaceId, {
      action: "saveSearch",
      name,
      query: activeQueryObject,
      shared: false,
    });
    if (response.ok) {
      setStatus("Search saved.");
      void loadMeta();
    } else {
      setStatus("Could not save this search.");
    }
  }

  function applySaved(item: SavedSearch) {
    const query = item.query as Record<string, unknown>;
    const next: SearchState = {
      q: typeof query.q === "string" ? query.q : "",
      kind: typeof query.kinds === "string" ? query.kinds : "",
      ownerUserId: typeof query.ownerUserId === "string" ? query.ownerUserId : "",
      tagId: typeof query.tagIds === "string" ? query.tagIds : "",
      from: typeof query.from === "string" ? query.from.slice(0, 10) : "",
      to: typeof query.to === "string" ? query.to.slice(0, 10) : "",
    };
    setDraft(next);
    void run(next);
  }

  async function reindex() {
    const response = await postAction(workspaceId, {
      action: "reindex",
      scope: "workspace",
    });
    if (response.ok) {
      const job = (await response.json()) as { id?: string };
      setStatus(`Reindex queued${job.id ? " · " + job.id : ""}.`);
    } else if (response.status === 403) {
      setStatus("Only workspace administrators can start a full reindex.");
    } else {
      setStatus("Unable to queue reindex.");
    }
  }

  return (
    <section className={styles.surface}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Discover and connect</p>
          <h1>Workspace search</h1>
          <p>Search titles, content, OCR text, metadata, tags, paths, and connected knowledge.</p>
        </div>
        <div className={styles.indexStatus}>
          <strong>{indexStatus?.indexedNodes ?? 0} indexed</strong>
          <span>{indexStatus?.laggingNodes ?? 0} pending reconciliation</span>
          <Button variant="secondary" onClick={() => void reindex()}>Reindex</Button>
        </div>
      </header>

      <form className={styles.searchForm} onSubmit={submit}>
        <label className={styles.query}>
          Search
          <input
            value={draft.q}
            onChange={(event) => setDraft((current) => ({ ...current, q: event.currentTarget.value }))}
            placeholder="Find notes, files, reports, OCR text…"
          />
        </label>
        <label>
          Type
          <select
            value={draft.kind}
            onChange={(event) => setDraft((current) => ({ ...current, kind: event.currentTarget.value }))}
          >
            <option value="">All types</option>
            {["folder","note","document","whiteboard","dataset","spreadsheet","notebook","report","research_item","lab_record","attachment"].map((kind) => (
              <option value={kind} key={kind}>{kind.replaceAll("_", " ")}</option>
            ))}
          </select>
        </label>
        <label>
          Tag
          <select
            value={draft.tagId}
            onChange={(event) => setDraft((current) => ({ ...current, tagId: event.currentTarget.value }))}
          >
            <option value="">Any tag</option>
            {tags.map((tag) => <option value={tag.id} key={tag.id}>{tag.name}</option>)}
          </select>
        </label>
        <label>
          Owner user ID
          <input
            value={draft.ownerUserId}
            onChange={(event) => setDraft((current) => ({ ...current, ownerUserId: event.currentTarget.value }))}
            placeholder="Optional UUID"
          />
        </label>
        <label>
          From
          <input type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.currentTarget.value }))} />
        </label>
        <label>
          To
          <input type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.currentTarget.value }))} />
        </label>
        <div className={styles.formActions}>
          <Button type="submit" disabled={loading}>Search</Button>
          <Button variant="secondary" type="button" onClick={() => void saveCurrent()}>
            Save search
          </Button>
        </div>
      </form>

      <div className={styles.layout}>
        <aside className={styles.side}>
          <section>
            <h2>Saved searches</h2>
            {saved.map((item) => (
              <button key={item.id} type="button" onClick={() => applySaved(item)}>
                {item.name}{item.shared ? " · shared" : ""}
              </button>
            ))}
            {saved.length === 0 ? <p>None yet.</p> : null}
          </section>
          <section>
            <h2>Recent queries</h2>
            {history.slice(0, 8).map((item) => (
              <button
                key={item.queryText + item.lastUsedAt}
                type="button"
                onClick={() => {
                  const next = { ...EMPTY, q: item.queryText };
                  setDraft(next);
                  void run(next);
                }}
              >
                {item.queryText}
              </button>
            ))}
            {history.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  void postAction(workspaceId, { action: "clearHistory" }).then(() => loadMeta());
                }}
              >
                Clear history
              </button>
            ) : null}
          </section>
          <a href={`/app/workspaces/${workspaceId}/graph`}>Open knowledge graph →</a>
        </aside>

        <div className={styles.results} aria-busy={loading}>
          {items.map((item) => (
            <article key={item.nodeId}>
              <div className={styles.resultHead}>
                <div>
                  <span className={styles.kind}>{item.kind.replaceAll("_", " ")}</span>
                  <h2>
                    <a href={`/app/workspaces/${workspaceId}/node/${item.nodeId}`}>
                      {item.title}
                    </a>
                  </h2>
                </div>
                <time>{new Date(item.updatedAt).toLocaleDateString()}</time>
              </div>
              <small>{item.path}</small>
              <HighlightedSnippet value={item.snippet} />
              <div className={styles.tags}>
                {item.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}
              </div>
            </article>
          ))}
          {nextCursor ? (
            <Button variant="secondary" disabled={loading} onClick={() => void run(active, true, nextCursor)}>
              Load more
            </Button>
          ) : null}
        </div>
      </div>

      <p className={styles.live} aria-live="polite">{status}</p>
    </section>
  );
}
