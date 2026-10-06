"use client";

import { useActionState } from "react";

import { createShareLinkAction } from "../lib/workspace-actions";
import { BearerLinkResult } from "./bearer-link-result";

const initialState = { status: "idle" as const };

export function WorkspaceShareLinkForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(createShareLinkAction, initialState);

  return (
    <form action={action} className="settings-form workspace-create">
      <h2>Create revocable share link</h2>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="resourceType" value="workspace" />
      <input type="hidden" name="resourceId" value={workspaceId} />
      <label className="settings-control">
        Password (optional)
        <input name="password" type="password" minLength={8} autoComplete="new-password" />
      </label>
      <label className="workspace-check">
        <input name="allowDownload" type="checkbox" />
        Allow downloads
      </label>
      <button className="nx-button" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create share link"}
      </button>
      <BearerLinkResult state={state} />
    </form>
  );
}
