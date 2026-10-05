"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { ModalDialog } from "./dialog.js";

export type CommandItem = {
  id: string;
  label: string;
  keywords?: readonly string[];
  shortcut?: string;
  icon?: ReactNode;
  href?: string;
  onSelect?: () => void;
};

export function CommandPalette({
  commands,
  label = "Command palette",
}: {
  commands: readonly CommandItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      [command.label, ...(command.keywords ?? [])].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function optionId(index: number) {
    return `${listId}-option-${index}`;
  }

  function select(command: CommandItem | undefined) {
    if (!command) return;
    command.onSelect?.();
    if (command.href) window.location.assign(command.href);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button className="nx-command-trigger" type="button" onClick={() => setOpen(true)}>
        <span>Search or run a command</span>
        <kbd>⌘K</kbd>
      </button>

      <ModalDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="Jump anywhere in Nexosophy or run a quick action."
      >
        <div className="nx-command">
          <input
            ref={inputRef}
            className="nx-command__input"
            role="combobox"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded="true"
            aria-activedescendant={filtered[activeIndex] ? optionId(activeIndex) : undefined}
            value={query}
            placeholder="Type a command…"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(0, filtered.length - 1)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                select(filtered[activeIndex]);
              }
            }}
          />

          <div className="nx-command__list" id={listId} role="listbox" aria-label="Available commands">
            {filtered.length ? (
              filtered.map((command, index) => (
                <button
                  key={command.id}
                  id={optionId(index)}
                  type="button"
                  className="nx-command__item"
                  role="option"
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(command)}
                >
                  <span className="nx-command__label">
                    {command.icon ? <span aria-hidden="true">{command.icon}</span> : null}
                    {command.label}
                  </span>
                  {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                </button>
              ))
            ) : (
              <p className="nx-command__empty">No matching commands.</p>
            )}
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
