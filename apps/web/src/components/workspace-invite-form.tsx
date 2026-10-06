"use client";

import { useActionState } from "react";

import { inviteWorkspaceMemberAction } from "../lib/workspace-actions";
import { BearerLinkResult } from "./bearer-link-result";

const initialState = { status: "idle" as const };

export function WorkspaceInviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(inviteWorkspaceMemberAction, initialState);

  return (
    <form action={action} className="settings-form">
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
      <button className="nx-button" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create invitation"}
      </button>
      <BearerLinkResult state={state} />
    </form>
  );
}
