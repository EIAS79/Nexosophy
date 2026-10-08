import { TrashManager } from "../../../../../components/trash-manager";

export default async function WorkspaceTrashPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <section className="workspace-page">
      <TrashManager workspaceId={workspaceId} />
    </section>
  );
}
