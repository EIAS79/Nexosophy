import { nexosophyApi } from "../../../../lib/api-server";
import { updateWorkspaceAction } from "../../../../lib/workspace-actions";

type Workspace = {
  id: string;
  name: string;
  type: string;
  role: string;
  version: number;
  permissionVersion: number;
};

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const data = await nexosophyApi<{ workspaces: Workspace[] }>("/v1/workspaces");
  const workspace = data.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return <div className="route-state"><div className="route-state__card"><h1>Workspace unavailable</h1></div></div>;

  return (
    <section className="workspace-page">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">{workspace.type} workspace</p>
          <h1>{workspace.name}</h1>
          <p>{workspace.role} · permission version {workspace.permissionVersion}</p>
        </div>
      </header>

      <div className="workspace-grid">
        <a className="workspace-card" href={`/app/workspaces/${workspace.id}/settings/members`}>
          <h2>Members</h2><p>Invites, roles, suspension and ownership transfer.</p>
        </a>
        <a className="workspace-card" href={`/app/workspaces/${workspace.id}/settings/permissions`}>
          <h2>Permissions & sharing</h2><p>Effective policy, resource grants, share links and audit history.</p>
        </a>
        <a className="workspace-card" href={`/workspace/${workspace.id}/files`}>
          <h2>Files</h2><p>Recursive explorer foundation continues in Phase 04.</p>
        </a>
      </div>

      {(workspace.role === "owner" || workspace.role === "admin") && (
        <form action={updateWorkspaceAction} className="settings-form workspace-create">
          <h2>Workspace details</h2>
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <input type="hidden" name="expectedVersion" value={workspace.version} />
          <label className="settings-control">
            Name
            <input name="name" defaultValue={workspace.name} maxLength={120} required />
          </label>
          <button className="nx-button" type="submit">Save changes</button>
        </form>
      )}
    </section>
  );
}
