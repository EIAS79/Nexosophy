import { CommandPalette, Tree } from "@nexosophy/ui";
import type { ReactNode } from "react";

import { switchWorkspaceAction } from "../lib/workspace-actions";

import { appNavigation, mobileNavigation } from "../lib/navigation";
import type { ShellWorkspace } from "../lib/shell-data";
import { AppearanceControl } from "./appearance-control";

function WorkspacePane({ workspace, workspaces }: { workspace: ShellWorkspace; workspaces: readonly { id: string; name: string }[] }) {
  return (
    <>
      <label className="app-shell__workspace-label" htmlFor="workspace-switcher">Workspace</label>
      <form action={switchWorkspaceAction}>
        <select
          className="app-shell__workspace-select"
          id="workspace-switcher"
          name="workspaceId"
          defaultValue={workspace.id}
          aria-label="Current workspace"
        >
          {workspaces.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <button className="app-shell__workspace-switch" type="submit">Switch</button>
      </form>
      <div className="app-shell__tree">
        <Tree label="Workspace files and sections" nodes={workspace.tree} defaultExpanded={["workspace-root"]} />
      </div>
    </>
  );
}

export function AppShell({
  workspace,
  workspaces = [{ id: workspace.id, name: workspace.name }],
  children,
}: {
  workspace: ShellWorkspace;
  workspaces?: readonly { id: string; name: string }[];
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
        <WorkspacePane workspace={workspace} workspaces={workspaces} />
      </aside>

      <div className="app-shell__main">
        <header className="app-topbar">
          <details className="app-topbar__workspace-drawer">
            <summary aria-label="Open workspace navigation">Workspace</summary>
            <div className="app-topbar__workspace-panel">
              <WorkspacePane workspace={workspace} workspaces={workspaces} />
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
