import type { ContentNode, ContentNodeKind } from "@nexosophy/contracts";

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
  | "code-runtime"
  | "hierarchy";

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
    id: "spatial-note",
    label: "Spatial note",
    nodeKinds: ["note"],
    capabilities: [
      "title",
      "history",
      "comments-hook",
      "export-hook",
      "offline-recovery",
      "attachments",
      "canvas",
    ],
    availability: "active",
  },
  {
    id: "whiteboard",
    label: "Whiteboard",
    nodeKinds: ["whiteboard"],
    capabilities: [
      "title",
      "history",
      "comments-hook",
      "export-hook",
      "offline-recovery",
      "attachments",
      "canvas",
    ],
    availability: "active",
  },
  {
    id: "notebook",
    label: "Notebook",
    nodeKinds: ["notebook"],
    capabilities: ["title", "history", "comments-hook", "export-hook", "hierarchy"],
    availability: "active",
  },
  {
    id: "structured-data",
    label: "Structured data",
    nodeKinds: ["dataset", "spreadsheet"],
    capabilities: ["title", "history", "export-hook", "structured-data"],
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

export function resolveEditorPlugin(
  input: ContentNodeKind | Pick<ContentNode, "kind" | "metadata">,
): EditorPluginDescriptor | null {
  const kind = typeof input === "string" ? input : input.kind;
  const metadata = typeof input === "string" ? {} : input.metadata;

  if (kind === "note" && metadata.noteRole === "page") {
    return editorPlugins.find((plugin) => plugin.id === "spatial-note") ?? null;
  }
  if (kind === "whiteboard") {
    return editorPlugins.find((plugin) => plugin.id === "whiteboard") ?? null;
  }
  if (kind === "notebook") {
    return editorPlugins.find((plugin) => plugin.id === "notebook") ?? null;
  }
  return (
    editorPlugins.find(
      (plugin) =>
        plugin.availability === "active" &&
        plugin.id !== "spatial-note" &&
        plugin.nodeKinds.includes(kind),
    ) ?? null
  );
}
