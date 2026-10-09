import { AuditViewer } from "../../../../../../components/audit-viewer";

export default async function WorkspaceAuditPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <section className="workspace-page">
      <AuditViewer workspaceId={workspaceId} />
    </section>
  );
}
