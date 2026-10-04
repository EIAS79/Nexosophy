import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../lib/cx.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  leading,
  trailing,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx("nx-button", `nx-button--${variant}`, `nx-button--${size}`, className)}
      type={type}
      {...props}
    >
      {leading ? <span className="nx-button__icon" aria-hidden="true">{leading}</span> : null}
      {children ? <span className="nx-button__label">{children}</span> : null}
      {trailing ? <span className="nx-button__icon" aria-hidden="true">{trailing}</span> : null}
    </button>
  );
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={cx("nx-button", `nx-button--${variant}`, `nx-button--${size}`, className)}
      {...props}
    >
      <span className="nx-button__label">{children}</span>
    </a>
  );
}
