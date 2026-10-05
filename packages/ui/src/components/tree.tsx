"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type TreeNode = {
  id: string;
  label: ReactNode;
  href?: string;
  children?: readonly TreeNode[];
};

type VisibleNode = {
  node: TreeNode;
  depth: number;
  parentId: string | undefined;
};

export function Tree({
  label,
  nodes,
  defaultExpanded = [],
}: {
  label: string;
  nodes: readonly TreeNode[];
  defaultExpanded?: readonly string[];
}) {
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));
  const [activeId, setActiveId] = useState(nodes[0]?.id ?? "");
  const rootRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const output: VisibleNode[] = [];

    const visit = (items: readonly TreeNode[], depth: number, parentId?: string) => {
      for (const node of items) {
        output.push({ node, depth, parentId });
        if (node.children?.length && expanded.has(node.id)) {
          visit(node.children, depth + 1, node.id);
        }
      }
    };

    visit(nodes, 1);
    return output;
  }, [nodes, expanded]);

  function focus(id: string) {
    setActiveId(id);
    requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)
        ?.focus();
    });
  }

  function toggle(id: string, next?: boolean) {
    setExpanded((current) => {
      const value = new Set(current);
      const shouldExpand = next ?? !value.has(id);
      if (shouldExpand) value.add(id);
      else value.delete(id);
      return value;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = visible.findIndex(({ node }) => node.id === activeId);
    const current = visible[index];
    if (!current) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = visible[Math.min(index + 1, visible.length - 1)];
      if (next) focus(next.node.id);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = visible[Math.max(index - 1, 0)];
      if (next) focus(next.node.id);
    }

    if (event.key === "ArrowRight" && current.node.children?.length) {
      event.preventDefault();
      if (!expanded.has(current.node.id)) toggle(current.node.id, true);
      else focus(current.node.children[0]?.id ?? current.node.id);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (expanded.has(current.node.id)) toggle(current.node.id, false);
      else if (current.parentId) focus(current.parentId);
    }

    if (event.key === "Home") {
      event.preventDefault();
      if (visible[0]) focus(visible[0].node.id);
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = visible.at(-1);
      if (last) focus(last.node.id);
    }
  }

  return (
    <div className="nx-tree" ref={rootRef} role="tree" aria-label={label} onKeyDown={onKeyDown}>
      {visible.map(({ node, depth }) => {
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = hasChildren ? expanded.has(node.id) : undefined;

        return (
          <div
            key={node.id}
            role="treeitem"
            data-tree-id={node.id}
            aria-expanded={isExpanded}
            aria-level={depth}
            tabIndex={activeId === node.id ? 0 : -1}
            className="nx-tree__item"
            style={{ "--nx-tree-depth": depth } as CSSProperties}
            onFocus={() => setActiveId(node.id)}
          >
            {hasChildren ? (
              <button
                type="button"
                className="nx-tree__toggle"
                aria-label={isExpanded ? "Collapse" : "Expand"}
                tabIndex={-1}
                onClick={() => toggle(node.id)}
              >
                {isExpanded ? "▾" : "▸"}
              </button>
            ) : (
              <span className="nx-tree__spacer" aria-hidden="true" />
            )}
            {node.href ? <a href={node.href}>{node.label}</a> : <span>{node.label}</span>}
          </div>
        );
      })}
    </div>
  );
}
