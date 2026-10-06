import { createWorkspaceAction } from "../../../lib/workspace-actions";
import { nexosophyApi } from "../../../lib/api-server";

type Workspace = {
  id: string;
  name: string;
  type: string;
  role: string;
  version: number;
  permissionVersion: number;
};

export default async function WorkspacesPage() {
  const data = await nexosophyApi<{ workspaces: Workspace[] }>("/v1/workspaces");

  return (
    <section className="workspace-page">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Workspace administration</p>
          <h1>Workspaces</h1>
          <p>Personal, team and research spaces with server-authoritative roles and permissions.</p>
        </div>
      </header>

      <div className="workspace-grid">
        {data.workspaces.map((workspace) => (
          <a className="workspace-card" href={`/app/workspaces/${workspace.id}`} key={workspace.id}>
            <span className="workspace-card__type">{workspace.type}</span>
            <h2>{workspace.name}</h2>
            <p>{workspace.role} · permission v{workspace.permissionVersion}</p>
          </a>
        ))}
      </div>

      <form action={createWorkspaceAction} className="settings-form workspace-create">
        <h2>Create workspace</h2>
        <label className="settings-control">
          Name
          <input name="name" maxLength={120} required />
        </label>
        <label className="settings-control">
          Type
          <select name="type" defaultValue="team">
            <option value="team">Team</option>
            <option value="research">Research</option>
            <option value="lab">Lab</option>
            <option value="class">Class</option>
            <option value="institution">Institution</option>
          </select>
        </label>
        <button className="nx-button" type="submit">Create workspace</button>
      </form>
    </section>
  );
}
