import type { ContentNodeKind } from "@nexosophy/contracts";

export type EditorCapability =
  | "title"
  | "rich-text"
  | "undo-redo"
  | "autosave"
  | "history"
  | "comments-hook"
  | "export-hook"
  | "offline-recovery"
  | "attachments"
  | "structured-data"
  | "canvas"
  | "code-runtime";

export type EditorPluginDescriptor = {
  id: string;
  label: string;
  nodeKinds: readonly ContentNodeKind[];
  capabilities: readonly EditorCapability[];
  availability: "active" | "future-phase";
};

export const editorPlugins: readonly EditorPluginDescriptor[] = [
  {
    id: "rich-document",
    label: "Rich document",
    nodeKinds: ["note", "document", "report", "research_item", "lab_record"],
    capabilities: [
      "title",
      "rich-text",
      "undo-redo",
      "autosave",
      "history",
      "comments-hook",
      "export-hook",
      "offline-recovery",
      "attachments",
    ],
    availability: "active",
  },
  {
    id: "whiteboard",
    label: "Whiteboard",
    nodeKinds: ["whiteboard"],
    capabilities: ["title", "history", "comments-hook", "export-hook", "canvas"],
    availability: "future-phase",
  },
  {
    id: "structured-data",
    label: "Structured data",
    nodeKinds: ["dataset", "spreadsheet"],
    capabilities: ["title", "history", "export-hook", "structured-data"],
    availability: "future-phase",
  },
  {
    id: "notebook",
    label: "Notebook",
    nodeKinds: ["notebook"],
    capabilities: ["title", "history", "export-hook", "code-runtime"],
    availability: "future-phase",
  },
  {
    id: "attachment",
    label: "Attachment viewer",
    nodeKinds: ["attachment"],
    capabilities: ["title", "history", "attachments"],
    availability: "active",
  },
];

export function resolveEditorPlugin(kind: ContentNodeKind): EditorPluginDescriptor | null {
  return editorPlugins.find((plugin) => plugin.nodeKinds.includes(kind)) ?? null;
}
