import { CommandPalette, Tree } from "@nexosophy/ui";
import type { ReactNode } from "react";

import { appNavigation, mobileNavigation } from "../lib/navigation.js";
import type { ShellWorkspace } from "../lib/shell-data.js";
import { AppearanceControl } from "./appearance-control.js";

function WorkspacePane({ workspace }: { workspace: ShellWorkspace }) {
  return (
    <>
      <label className="app-shell__workspace-label" htmlFor="workspace-switcher">Workspace</label>
      <select className="app-shell__workspace-select" id="workspace-switcher" defaultValue={workspace.id}>
        <option value={workspace.id}>{workspace.name}</option>
      </select>
      <div className="app-shell__tree">
        <Tree label="Workspace files and sections" nodes={workspace.tree} defaultExpanded={["workspace-root"]} />
      </div>
    </>
  );
}

export function AppShell({
  workspace,
  children,
}: {
  workspace: ShellWorkspace;
  children: ReactNode;
}) {
  const commands = appNavigation.map((item) => ({
    id: item.href,
    label: `Go to ${item.label}`,
    keywords: [item.label, "navigation"],
    href: item.href,
  }));

  return (
    <div className="app-shell">
      <aside className="app-rail" aria-label="Application">
        <a className="app-rail__brand" href="/app" aria-label="Nexosophy home">N</a>
        <nav className="app-rail__nav">
          {appNavigation.map((item) => (
            <a key={item.href} href={item.href} title={item.label}>
              <span aria-hidden="true">{item.glyph}</span>
              <span className="nx-visually-hidden">{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <aside className="app-sidebar" aria-label="Workspace navigation">
        <div className="app-sidebar__head">
          <a className="brand" href="/app">
            <span className="brand__mark" aria-hidden="true">N</span>
            <span>Nexosophy</span>
          </a>
        </div>
        <WorkspacePane workspace={workspace} />
      </aside>

      <div className="app-shell__main">
        <header className="app-topbar">
          <details className="app-topbar__workspace-drawer">
            <summary aria-label="Open workspace navigation">Workspace</summary>
            <div className="app-topbar__workspace-panel">
              <WorkspacePane workspace={workspace} />
            </div>
          </details>

          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <a href="/app">Home</a>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{workspace.name}</span>
          </nav>

          <div className="app-topbar__tools">
            <CommandPalette commands={commands} />
            <AppearanceControl />
          </div>
        </header>

        <main className="app-content" id="main-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile application navigation">
        {mobileNavigation.map((item) => (
          <a key={item.href} href={item.href}>
            <span aria-hidden="true">{item.glyph}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
