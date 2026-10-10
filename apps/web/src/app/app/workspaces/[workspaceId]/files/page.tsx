import type { ContentNode, ContentNodePage } from "@nexosophy/contracts";

import { ContentExplorer } from "../../../../../components/content-explorer";
import { UploadManager } from "../../../../../components/upload-manager";
import { nexosophyApi } from "../../../../../lib/api-server";

export default async function WorkspaceFilesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [initialRoot, favorites, recent] = await Promise.all([
    nexosophyApi<ContentNodePage>(`/v1/workspaces/${workspaceId}/nodes?parentId=root&limit=50`),
    nexosophyApi<{ items: ContentNode[] }>(`/v1/workspaces/${workspaceId}/favorites`),
    nexosophyApi<{ items: ContentNode[] }>(`/v1/workspaces/${workspaceId}/recent`),
  ]);

  return (
    <>
      <nav className="workspace-subnav" aria-label="Workspace content utilities">
        <a href={`/app/workspaces/${workspaceId}/notes`}>Notes</a>
        <a href={`/app/workspaces/${workspaceId}/search`}>Search</a>
        <a href={`/app/workspaces/${workspaceId}/graph`}>Graph</a>
        <a href={`/app/workspaces/${workspaceId}/productivity`}>Productivity</a>
        <a href={`/app/workspaces/${workspaceId}/portability`}>Templates & transfer</a>
        <a href={`/app/workspaces/${workspaceId}/structured`}>Data & code</a>
        <a href={`/app/workspaces/${workspaceId}/academic`}>Courses & study</a>
        <a href={`/app/workspaces/${workspaceId}/research`}>Research & references</a>
        <a href={`/app/workspaces/${workspaceId}/trash`}>Trash</a>
        <a href={`/app/workspaces/${workspaceId}/settings/audit`}>Audit log</a>
      </nav>
      <UploadManager workspaceId={workspaceId} />
      <ContentExplorer
        workspaceId={workspaceId}
        initialRoot={initialRoot}
        favorites={favorites.items}
        recent={recent.items}
      />
    </>
  );
}
