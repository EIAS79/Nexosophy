"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cx } from "../lib/cx";

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
};

export function Field({ id, label, hint, error, className, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("nx-field", Boolean(error) && "nx-field--error")}>
      <label className="nx-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        className={cx("nx-field__control", className)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
      {hint ? <div className="nx-field__hint" id={hintId}>{hint}</div> : null}
      {error ? <div className="nx-field__error" id={errorId} role="alert">{error}</div> : null}
    </div>
  );
}
