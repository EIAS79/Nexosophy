import { redirect } from "next/navigation";

export default async function WorkspaceNodeAlias({
  params,
}: {
  params: Promise<{ workspaceId: string; nodeId: string }>;
}) {
  const { workspaceId, nodeId } = await params;
  redirect(`/app/workspaces/${workspaceId}/node/${nodeId}`);
}