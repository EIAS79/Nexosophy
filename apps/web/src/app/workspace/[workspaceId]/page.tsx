import { redirect } from "next/navigation";

export default async function WorkspaceAlias({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/app/workspaces/${workspaceId}`);
}
