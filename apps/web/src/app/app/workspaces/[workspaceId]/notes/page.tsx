import { NotebookManager } from "../../../../../components/notebook-manager";

export default async function WorkspaceNotesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <section className="workspace-page">
      <NotebookManager workspaceId={workspaceId} />
    </section>
  );
}
