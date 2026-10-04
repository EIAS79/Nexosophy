"use client";

import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

export type TooltipProps = {
  content: ReactNode;
  children: ReactElement<{ "aria-describedby"?: string }>;
};

export function Tooltip({ content, children }: TooltipProps) {
  const id = useId();

  return (
    <span className="nx-tooltip">
      {cloneElement(children, { "aria-describedby": id })}
      <span className="nx-tooltip__content" id={id} role="tooltip">
        {content}
      </span>
    </span>
  );
}
