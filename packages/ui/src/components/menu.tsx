"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "./button.js";

export type MenuItem = {
  id: string;
  label: string;
  href?: string;
  disabled?: boolean;
  leading?: ReactNode;
  onSelect?: () => void;
};

export type MenuProps = {
  label: string;
  items: readonly MenuItem[];
};

export function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const focusItem = (direction: 1 | -1) => {
    const buttons = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])") ?? [],
    );
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLElement);
    const next = current < 0 ? (direction === 1 ? 0 : buttons.length - 1) : (current + direction + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>("[aria-haspopup='menu']")?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(-1);
    }
  };

  return (
    <div className="nx-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <Button
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? (
        <div className="nx-menu__surface" id={menuId} role="menu">
          {items.map((item) =>
            item.href ? (
              <a
                key={item.id}
                className="nx-menu__item"
                href={item.disabled ? undefined : item.href}
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                tabIndex={item.disabled ? -1 : 0}
                onClick={() => setOpen(false)}
              >
                {item.leading ? <span aria-hidden="true">{item.leading}</span> : null}
                <span>{item.label}</span>
              </a>
            ) : (
              <button
                key={item.id}
                className="nx-menu__item"
                type="button"
                role="menuitem"
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.leading ? <span aria-hidden="true">{item.leading}</span> : null}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
