"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./workspace-command-palette.module.css";

type Command = {
  id: string;
  label: string;
  keywords?: readonly string[];
  href: string;
};

type SearchResult = {
  nodeId: string;
  kind: string;
  title: string;
  path: string;
};

export function WorkspaceCommandPalette({
  workspaceId,
  commands,
}: {
  workspaceId: string;
  commands: readonly Command[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dialogRef.current?.showModal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query.trim(), limit: "8" });
      fetch(`/api/search/${workspaceId}?${params.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) return { items: [] };
          return (await response.json()) as { items: SearchResult[] };
        })
        .then((payload) => setResults(payload.items))
        .finally(() => setLoading(false));
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, workspaceId]);

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands.slice(0, 8);
    return commands
      .filter((command) =>
        [command.label, ...(command.keywords ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 6);
  }, [commands, query]);

  return (
    <>
      <button
        className={styles.trigger}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="Open command palette"
      >
        <span>Search</span>
        <kbd>⌘ K</kbd>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClose={() => {
          setQuery("");
          setResults([]);
        }}
      >
        <form method="dialog" className={styles.top}>
          <label>
            <span className="nx-visually-hidden">Search commands and workspace knowledge</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search knowledge or run a command…"
            />
          </label>
          <button type="submit" aria-label="Close command palette">Esc</button>
        </form>
        <div className={styles.body}>
          {filteredCommands.length > 0 ? (
            <section>
              <h2>Commands</h2>
              {filteredCommands.map((command) => (
                <a key={command.id} href={command.href}>
                  <span>{command.label}</span>
                  <small>Command</small>
                </a>
              ))}
            </section>
          ) : null}
          {query.trim() ? (
            <section>
              <h2>Workspace results {loading ? "· searching…" : ""}</h2>
              {results.map((item) => (
                <a
                  key={item.nodeId}
                  href={`/app/workspaces/${workspaceId}/node/${item.nodeId}`}
                >
                  <span>{item.title}</span>
                  <small>{item.kind.replaceAll("_", " ")} · {item.path}</small>
                </a>
              ))}
              {!loading && results.length === 0 ? (
                <a href={`/app/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}`}>
                  <span>Open full search</span>
                  <small>No quick result matched.</small>
                </a>
              ) : null}
            </section>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
