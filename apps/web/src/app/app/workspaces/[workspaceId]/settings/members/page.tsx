import { WorkspaceInviteForm } from "../../../../../../components/workspace-invite-form";
import { WorkspaceOwnershipTransferForm } from "../../../../../../components/workspace-ownership-transfer-form";
import { nexosophyApi } from "../../../../../../lib/api-server";
import { updateWorkspaceMemberAction } from "../../../../../../lib/workspace-actions";

type Workspace = {
  id: string;
  role: "owner" | "admin" | "member" | "viewer" | "guest";
};

type Member = {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: "owner" | "admin" | "member" | "viewer" | "guest";
  status: "active" | "suspended";
  version: number;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
};

export default async function WorkspaceMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const [membersData, workspaceData] = await Promise.all([
    nexosophyApi<{ members: Member[] }>(`/v1/workspaces/${workspaceId}/members`),
    nexosophyApi<{ workspaces: Workspace[] }>("/v1/workspaces"),
  ]);
  const workspace = workspaceData.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return null;

  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const isOwner = workspace.role === "owner";
  const inviteData = canManage
    ? await nexosophyApi<{ invitations: Invitation[] }>(
        `/v1/workspaces/${workspaceId}/invitations`,
      )
    : { invitations: [] };

  return (
    <section className="workspace-page">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Workspace settings</p>
          <h1>Members</h1>
          <p>Membership visibility follows the read permission. Mutations remain role-gated by the API.</p>
        </div>
      </header>

      {canManage && <WorkspaceInviteForm workspaceId={workspaceId} />}

      <div className="workspace-member-list">
        {membersData.members.map((member) => {
          const editable =
            workspace.role === "owner"
              ? member.role !== "owner"
              : workspace.role === "admin"
                ? member.role !== "owner" && member.role !== "admin"
                : false;

          if (!editable) {
            return (
              <div className="workspace-member-row" key={member.id}>
                <div>
                  <strong>{member.displayName || member.email || member.userId}</strong>
                  <small>{member.email ?? member.userId}</small>
                </div>
                <span>{member.role}</span>
                <span>{member.status}</span>
                <span>Read only</span>
              </div>
            );
          }

          return (
            <form action={updateWorkspaceMemberAction} className="workspace-member-row" key={member.id}>
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="userId" value={member.userId} />
              <input type="hidden" name="expectedVersion" value={member.version} />
              <div>
                <strong>{member.displayName || member.email || member.userId}</strong>
                <small>{member.email ?? member.userId}</small>
              </div>
              <select name="role" defaultValue={member.role}>
                {workspace.role === "owner" && <option value="admin">Admin</option>}
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="guest">Guest</option>
              </select>
              <select name="status" defaultValue={member.status}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <button className="nx-button" type="submit">Update</button>
            </form>
          );
        })}
      </div>

      {isOwner && (
        <WorkspaceOwnershipTransferForm
          workspaceId={workspaceId}
          members={membersData.members
            .filter((member) => member.role !== "owner" && member.status === "active")
            .map((member) => ({
              userId: member.userId,
              label: member.displayName || member.email || member.userId,
            }))}
        />
      )}

      {canManage && (
        <section className="settings-panel">
          <h2>Invitation history</h2>
          <div className="workspace-audit-list">
            {inviteData.invitations.map((invite) => (
              <div key={invite.id}>
                <strong>{invite.email}</strong>
                <span>
                  {invite.role} · {invite.status} · expires{" "}
                  {new Date(invite.expiresAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
