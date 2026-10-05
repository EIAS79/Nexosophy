"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type TabItem = {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

export type TabsProps = {
  items: readonly TabItem[];
  defaultTabId?: string;
  ariaLabel: string;
};

export function Tabs({ items, defaultTabId, ariaLabel }: TabsProps) {
  const firstEnabled = items.find((item) => !item.disabled)?.id ?? "";
  const [activeId, setActiveId] = useState(defaultTabId ?? firstEnabled);
  const prefix = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const enabledIds = useMemo(
    () => items.filter((item) => !item.disabled).map((item) => item.id),
    [items],
  );

  function focusTab(id: string) {
    setActiveId(id);
    rootRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(id)}"]`)
      ?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = Math.max(0, enabledIds.indexOf(activeId));

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = enabledIds[(current + direction + enabledIds.length) % enabledIds.length];
      if (next) focusTab(next);
    }

    if (event.key === "Home") {
      event.preventDefault();
      if (enabledIds[0]) focusTab(enabledIds[0]);
    }

    if (event.key === "End") {
      event.preventDefault();
      const next = enabledIds.at(-1);
      if (next) focusTab(next);
    }
  }

  return (
    <div className="nx-tabs" ref={rootRef}>
      <div className="nx-tabs__list" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {items.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="nx-tabs__tab"
              data-tab-id={item.id}
              id={`${prefix}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${prefix}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => setActiveId(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item) => (
        <section
          key={item.id}
          role="tabpanel"
          className="nx-tabs__panel"
          id={`${prefix}-panel-${item.id}`}
          aria-labelledby={`${prefix}-tab-${item.id}`}
          hidden={item.id !== activeId}
        >
          {item.content}
        </section>
      ))}
    </div>
  );
}
