"use client";

import { useActionState } from "react";

import { createOwnershipTransferAction } from "../lib/workspace-actions";
import { BearerLinkResult } from "./bearer-link-result";

const initialState = { status: "idle" as const };

type TargetMember = {
  userId: string;
  label: string;
};

export function WorkspaceOwnershipTransferForm({
  workspaceId,
  members,
}: {
  workspaceId: string;
  members: readonly TargetMember[];
}) {
  const [state, action, pending] = useActionState(
    createOwnershipTransferAction,
    initialState,
  );

  return (
    <form action={action} className="settings-form workspace-create">
      <h2>Transfer ownership</h2>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label className="settings-control">
        Target member
        <select name="toUserId" required defaultValue="">
          <option value="" disabled>Select a member</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>{member.label}</option>
          ))}
        </select>
      </label>
      <button className="nx-button" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create transfer"}
      </button>
      <BearerLinkResult state={state} />
    </form>
  );
}
