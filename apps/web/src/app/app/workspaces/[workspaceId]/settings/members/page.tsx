import { nexosophyApi } from "../../../../../../lib/api-server";
import {
  createOwnershipTransferAction,
  inviteWorkspaceMemberAction,
  updateWorkspaceMemberAction,
} from "../../../../../../lib/workspace-actions";

type Member = {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: string;
  status: string;
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
  const [membersData, inviteData] = await Promise.all([
    nexosophyApi<{ members: Member[] }>(`/v1/workspaces/${workspaceId}/members`),
    nexosophyApi<{ invitations: Invitation[] }>(`/v1/workspaces/${workspaceId}/invitations`),
  ]);

  return (
    <section className="workspace-page">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Workspace settings</p>
          <h1>Members</h1>
          <p>Invitations are expiring and single-use. Role and status changes are version checked.</p>
        </div>
      </header>

      <form action={inviteWorkspaceMemberAction} className="settings-form">
        <h2>Invite member</h2>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label className="settings-control">
          Email
          <input name="email" type="email" required />
        </label>
        <label className="settings-control">
          Role
          <select name="role" defaultValue="member">
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="guest">Guest</option>
          </select>
        </label>
        <button className="nx-button" type="submit">Create invitation</button>
      </form>

      <div className="workspace-member-list">
        {membersData.members.map((member) => (
          <form action={updateWorkspaceMemberAction} className="workspace-member-row" key={member.id}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="userId" value={member.userId} />
            <input type="hidden" name="expectedVersion" value={member.version} />
            <div>
              <strong>{member.displayName || member.email || member.userId}</strong>
              <small>{member.email ?? member.userId}</small>
            </div>
            <select name="role" defaultValue={member.role} disabled={member.role === "owner"}>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="guest">Guest</option>
            </select>
            <select name="status" defaultValue={member.status} disabled={member.role === "owner"}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <button className="nx-button" type="submit" disabled={member.role === "owner"}>Update</button>
          </form>
        ))}
      </div>

      <form action={createOwnershipTransferAction} className="settings-form workspace-create">
        <h2>Transfer ownership</h2>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <label className="settings-control">
          Target member
          <select name="toUserId" required>
            <option value="">Select a member</option>
            {membersData.members.filter((member) => member.role !== "owner" && member.status === "active").map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName || member.email || member.userId}
              </option>
            ))}
          </select>
        </label>
        <button className="nx-button" type="submit">Create transfer</button>
      </form>

      <section className="settings-panel">
        <h2>Invitation history</h2>
        <div className="workspace-audit-list">
          {inviteData.invitations.map((invite) => (
            <div key={invite.id}>
              <strong>{invite.email}</strong>
              <span>{invite.role} · {invite.status} · expires {new Date(invite.expiresAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
