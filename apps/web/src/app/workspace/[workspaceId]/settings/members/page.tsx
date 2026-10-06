import { redirect } from "next/navigation";

export default async function MembersAlias({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/app/workspaces/${workspaceId}/settings/members`);
}
