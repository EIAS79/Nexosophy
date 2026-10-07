import type { ContentNode } from "@nexosophy/contracts";

import { AssetViewer } from "../../../../../../components/asset-viewer";
import { nexosophyApi } from "../../../../../../lib/api-server";

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

      {assetId ? (
        <AssetViewer workspaceId={workspaceId} assetId={assetId} />
      ) : (
      <div className="content-node-placeholder">
        <div>
          <p className="eyebrow">Phase 04 node surface</p>
          <h2>{node.name}</h2>
          <p>
            This route is the stable identity surface reused by note, document, whiteboard, dataset,
            spreadsheet, notebook, report, research, lab, and attachment editors in later phases.
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
    </section>
  );
}