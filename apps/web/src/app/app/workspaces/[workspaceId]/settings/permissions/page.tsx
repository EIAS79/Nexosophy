import type { WorkspacePermission, WorkspaceRole } from "@nexosophy/contracts";

const workspaceRolePermissions: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  owner: [
    "workspace.read", "workspace.update", "workspace.delete", "members.read",
    "members.invite", "members.manage", "roles.manage", "sharing.read",
    "sharing.manage", "content.read", "content.create", "content.update", "content.delete",
  ],
  admin: [
    "workspace.read", "workspace.update", "members.read", "members.invite",
    "members.manage", "roles.manage", "sharing.read", "sharing.manage",
    "content.read", "content.create", "content.update", "content.delete",
  ],
  member: [
    "workspace.read", "members.read", "sharing.read", "content.read",
    "content.create", "content.update",
  ],
  viewer: ["workspace.read", "members.read", "sharing.read", "content.read"],
  guest: ["workspace.read", "content.read"],
};

import { nexosophyApi } from "../../../../../../lib/api-server";
import { createShareLinkAction } from "../../../../../../lib/workspace-actions";

type Workspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberStatus: "active" | "suspended";
  permissionVersion: number;
};

type AuditEvent = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  request_id: string | null;
  created_at: string;
};

export default async function WorkspacePermissionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [workspaceData, auditData] = await Promise.all([
    nexosophyApi<{ workspaces: Workspace[] }>("/v1/workspaces"),
    nexosophyApi<{ events: AuditEvent[] }>(`/v1/workspaces/${workspaceId}/audit`),
  ]);
  const workspace = workspaceData.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return null;
  const effective =
    workspace.memberStatus === "active" ? workspaceRolePermissions[workspace.role] : [];

  return (
    <section className="workspace-page">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Workspace settings</p>
          <h1>Permissions & sharing</h1>
          <p>Permission version {workspace.permissionVersion}. Authorization is recalculated from database state on each request.</p>
        </div>
      </header>

      <section className="settings-panel">
        <h2>Your effective permissions</h2>
        <div className="permission-chips">
          {Array.from(effective).map((permission) => <span key={permission}>{permission}</span>)}
        </div>
      </section>

      <section className="settings-panel">
        <h2>Baseline role matrix</h2>
        <div className="role-matrix">
          {Object.entries(workspaceRolePermissions).map(([role, permissions]) => (
            <div key={role}>
              <strong>{role}</strong>
              <span>{permissions.join(", ")}</span>
            </div>
          ))}
        </div>
      </section>

      <form action={createShareLinkAction} className="settings-form workspace-create">
        <h2>Create revocable share link</h2>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="resourceType" value="workspace" />
        <input type="hidden" name="resourceId" value={workspaceId} />
        <label className="settings-control">
          Password (optional)
          <input name="password" type="password" minLength={8} />
        </label>
        <label className="workspace-check">
          <input name="allowDownload" type="checkbox" />
          Allow downloads
        </label>
        <button className="nx-button" type="submit">Create share link</button>
      </form>

      <section className="settings-panel">
        <h2>Audit trail</h2>
        <div className="workspace-audit-list">
          {auditData.events.map((event) => (
            <div key={event.id}>
              <strong>{event.action}</strong>
              <span>{event.target_type}{event.target_id ? ` · ${event.target_id}` : ""}</span>
              <small>{new Date(event.created_at).toLocaleString()} · request {event.request_id ?? "n/a"}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
