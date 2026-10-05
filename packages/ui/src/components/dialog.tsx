"use client";

import {
  useEffect,
  useId,
  useRef,
  type DialogHTMLAttributes,
  type ReactNode,
} from "react";

import { Button } from "./button.js";
import { cx } from "../lib/cx.js";

export type ModalDialogProps = Omit<DialogHTMLAttributes<HTMLDialogElement>, "open"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  kind?: "dialog" | "drawer";
};

export function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeLabel = "Close",
  kind = "dialog",
  className,
  ...props
}: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      {...props}
      ref={ref}
      className={cx("nx-dialog", kind === "drawer" && "nx-dialog--drawer", className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        if (open) onOpenChange(false);
      }}
    >
      <section className="nx-dialog__surface">
        <header className="nx-dialog__header">
          <div>
            <h2 className="nx-dialog__title" id={titleId}>{title}</h2>
            {description ? (
              <p className="nx-dialog__description" id={descriptionId}>{description}</p>
            ) : null}
          </div>
          <Button
            aria-label={closeLabel}
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            ×
          </Button>
        </header>
        <div className="nx-dialog__body">{children}</div>
      </section>
    </dialog>
  );
}
