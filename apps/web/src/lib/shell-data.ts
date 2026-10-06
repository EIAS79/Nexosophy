import type { TreeNode } from "@nexosophy/ui";

export type ShellWorkspace = {
  id: string;
  name: string;
  tree: readonly TreeNode[];
};

export interface ShellDataAdapter {
  getCurrentWorkspace(): Promise<ShellWorkspace>;
}

export function buildShellWorkspace(id: string, name: string): ShellWorkspace {
  return {
    id,
    name,
    tree: [
      {
        id: "workspace-root",
        label: "Workspace",
        href: `/app/workspaces/${id}`,
        children: [
          { id: "files", label: "Files", href: `/workspace/${id}/files` },
          { id: "members", label: "Members", href: `/app/workspaces/${id}/settings/members` },
          { id: "permissions", label: "Permissions", href: `/app/workspaces/${id}/settings/permissions` },
        ],
      },
      { id: "favorites", label: "Favorites", href: "/app/favorites" },
      { id: "trash", label: "Trash", href: "/app/trash" },
    ],
  };
}

class PhaseOneShellDataAdapter implements ShellDataAdapter {
  async getCurrentWorkspace(): Promise<ShellWorkspace> {
    return {
      id: "phase-one-preview",
      name: "Personal workspace",
      tree: [
        {
          id: "workspace-root",
          label: "Workspace",
          href: "/app/workspaces",
          children: [
            { id: "notes", label: "Notes", href: "/app/notes" },
            { id: "files", label: "Files", href: "/app/files" },
            { id: "research", label: "Research", href: "/app/research" },
          ],
        },
        { id: "favorites", label: "Favorites", href: "/app/favorites" },
        { id: "trash", label: "Trash", href: "/app/trash" },
      ],
    };
  }
}

export const shellData: ShellDataAdapter = new PhaseOneShellDataAdapter();
