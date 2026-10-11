import { KnowledgeGraph } from "../../../../../components/knowledge-graph";

export default async function WorkspaceGraphPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <KnowledgeGraph workspaceId={workspaceId} />;
}
