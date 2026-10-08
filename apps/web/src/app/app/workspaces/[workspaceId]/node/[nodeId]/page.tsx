import type {
  ContentNode,
  DocumentRecord,
  SpatialDocument,
  SpatialElement,
} from "@nexosophy/contracts";

import { AssetViewer } from "../../../../../../components/asset-viewer";
import { CollaborationPanel } from "../../../../../../components/collaboration-panel";
import { DocumentHistoryPanel } from "../../../../../../components/document-history-panel";
import { NotebookManager } from "../../../../../../components/notebook-manager";
import { RealtimeRoomProvider } from "../../../../../../components/realtime-room";
import { RichDocumentEditor } from "../../../../../../components/rich-document-editor";
import { SpatialCanvasEditor } from "../../../../../../components/spatial-canvas-editor";
import { nexosophyApi } from "../../../../../../lib/api-server";
import { resolveEditorPlugin } from "../../../../../../lib/editor-registry";

type SpatialResponse = {
  document: SpatialDocument;
  elements: SpatialElement[];
  nextCursor: string | null;
};

export default async function WorkspaceNodePage({
  params,
}: {
  params: Promise<{ workspaceId: string; nodeId: string }>;
}) {
  const { workspaceId, nodeId } = await params;
  const [node, breadcrumbs] = await Promise.all([
    nexosophyApi<ContentNode>(`/v1/workspaces/${workspaceId}/nodes/${nodeId}`),
    nexosophyApi<{ items: ContentNode[] }>(
      `/v1/workspaces/${workspaceId}/nodes/${nodeId}/breadcrumbs`,
    ),
  ]);

  const assetId =
    node.kind === "attachment" && typeof node.metadata.assetId === "string"
      ? node.metadata.assetId
      : null;
  const editorPlugin = resolveEditorPlugin(node);

  const document =
    editorPlugin?.id === "rich-document"
      ? await nexosophyApi<DocumentRecord>(
          `/v1/workspaces/${workspaceId}/documents/${node.id}`,
        )
      : null;

  const spatial =
    editorPlugin?.id === "spatial-note" || editorPlugin?.id === "whiteboard"
      ? await nexosophyApi<SpatialResponse>(
          `/v1/workspaces/${workspaceId}/spatial/${node.id}?limit=500`,
        )
      : null;

  return (
    <section className="workspace-page">
      <nav className="content-node-breadcrumbs" aria-label="Content breadcrumb">
        <a href={`/app/workspaces/${workspaceId}/files`}>Files</a>
        {breadcrumbs.items.map((item) => (
          <span key={item.id}>
            <span aria-hidden="true">/</span>
            {item.id === node.id ? (
              <span aria-current="page">{item.name}</span>
            ) : (
              <a href={`/app/workspaces/${workspaceId}/node/${item.id}`}>{item.name}</a>
            )}
          </span>
        ))}
      </nav>

      <header className="dashboard-head">
        <div>
          <p className="eyebrow">{node.kind.replaceAll("_", " ")}</p>
          <h1>{node.name}</h1>
          <p>
            Universal node identity · version {node.version} · updated{" "}
            {new Date(node.updatedAt).toLocaleString()}
          </p>
        </div>
        <a
          className="nx-button nx-button--secondary nx-button--md"
          href={`/app/workspaces/${workspaceId}/files`}
        >
          <span className="nx-button__label">Back to explorer</span>
        </a>
      </header>

      <RealtimeRoomProvider workspaceId={workspaceId} nodeId={node.id}>
        {assetId ? (
          <AssetViewer workspaceId={workspaceId} assetId={assetId} />
        ) : document ? (
          <>
            <RichDocumentEditor
              workspaceId={workspaceId}
              node={node}
              initialDocument={document}
            />
            <DocumentHistoryPanel workspaceId={workspaceId} nodeId={node.id} />
          </>
        ) : spatial ? (
          <>
            <SpatialCanvasEditor
              workspaceId={workspaceId}
              node={node}
              initialDocument={spatial.document}
              initialElements={spatial.elements}
            />
            <DocumentHistoryPanel workspaceId={workspaceId} nodeId={node.id} />
          </>
        ) : editorPlugin?.id === "notebook" ? (
          <NotebookManager workspaceId={workspaceId} rootNotebookId={node.id} />
        ) : (
          <div className="content-node-placeholder">
            <div>
              <p className="eyebrow">Universal node surface</p>
              <h2>{node.name}</h2>
              <p>
                This content type keeps the same stable node identity while its specialized
                editor is delivered by the capability registry in its owning phase.
              </p>
            </div>
            <dl>
              <div>
                <dt>Node ID</dt>
                <dd>{node.id}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{node.workspaceId}</dd>
              </div>
              <div>
                <dt>Parent</dt>
                <dd>{node.parentId ?? "Workspace root"}</dd>
              </div>
              <div>
                <dt>Children</dt>
                <dd>{node.hasChildren ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </div>
        )}
        <CollaborationPanel workspaceId={workspaceId} nodeId={node.id} />
      </RealtimeRoomProvider>
    </section>
  );
}
