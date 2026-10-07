import type { ContentNode, ContentNodePage } from "@nexosophy/contracts";

import { ContentExplorer } from "../../../../../components/content-explorer";
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
    <ContentExplorer
      workspaceId={workspaceId}
      initialRoot={initialRoot}
      favorites={favorites.items}
      recent={recent.items}
    />
  );
}