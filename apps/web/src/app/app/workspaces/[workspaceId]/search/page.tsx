import { WorkspaceSearch } from "../../../../../components/workspace-search";

export default async function WorkspaceSearchPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WorkspaceSearch workspaceId={workspaceId} />;
}
