import type { TreeNode } from "@nexosophy/ui";

export type ShellWorkspace = {
  id: string;
  name: string;
  tree: readonly TreeNode[];
};

export interface ShellDataAdapter {
  getCurrentWorkspace(): Promise<ShellWorkspace>;
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
          href: "/app/workspace",
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
