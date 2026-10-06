"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { nexosophyApi } from "./api-server";

export async function switchWorkspaceAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!workspaceId) return;
  const jar = await cookies();
  jar.set("nx_workspace", workspaceId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(`/app/workspaces/${workspaceId}`);
}

export async function createWorkspaceAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "team");
  if (!name) return;
  const workspace = await nexosophyApi<{ id: string }>("/v1/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, type }),
  });
  const jar = await cookies();
  jar.set("nx_workspace", workspace.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(`/app/workspaces/${workspace.id}`);
}

export async function updateWorkspaceAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const expectedVersion = Number(formData.get("expectedVersion"));
  if (!workspaceId || !name || !Number.isInteger(expectedVersion)) return;
  await nexosophyApi(`/v1/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify({ name, expectedVersion }),
  });
  revalidatePath(`/app/workspaces/${workspaceId}`);
}

export async function archiveWorkspaceAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!workspaceId) return;
  await nexosophyApi(`/v1/workspaces/${workspaceId}`, { method: "DELETE" });
  const jar = await cookies();
  jar.delete("nx_workspace");
  redirect("/app/workspaces");
}

export async function inviteWorkspaceMemberAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "member");
  if (!workspaceId || !email) return;
  await nexosophyApi(`/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    body: JSON.stringify({ email, role, expiresInHours: 168 }),
  });
  revalidatePath(`/app/workspaces/${workspaceId}/settings/members`);
}

export async function updateWorkspaceMemberAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const role = String(formData.get("role") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!workspaceId || !userId || !Number.isInteger(expectedVersion)) return;
  await nexosophyApi(`/v1/workspaces/${workspaceId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      expectedVersion,
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    }),
  });
  revalidatePath(`/app/workspaces/${workspaceId}/settings/members`);
}

export async function createOwnershipTransferAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  if (!workspaceId || !toUserId) return;
  await nexosophyApi(`/v1/workspaces/${workspaceId}/ownership-transfer`, {
    method: "POST",
    body: JSON.stringify({ toUserId, expiresInHours: 24 }),
  });
  revalidatePath(`/app/workspaces/${workspaceId}/settings/members`);
}

export async function createShareLinkAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const resourceType = String(formData.get("resourceType") ?? "workspace");
  const resourceId = String(formData.get("resourceId") ?? workspaceId);
  const password = String(formData.get("password") ?? "");
  const allowDownload = formData.get("allowDownload") === "on";
  if (!workspaceId || !resourceId) return;
  await nexosophyApi(`/v1/workspaces/${workspaceId}/share-links`, {
    method: "POST",
    body: JSON.stringify({
      resourceType,
      resourceId,
      allowDownload,
      ...(password ? { password } : {}),
    }),
  });
  revalidatePath(`/app/workspaces/${workspaceId}/settings/permissions`);
}

export async function acceptWorkspaceInvitationAction(token: string) {
  const result = await nexosophyApi<{ accepted: true; workspaceId: string }>(
    "/v1/workspace-invitations/accept",
    { method: "POST", body: JSON.stringify({ token }) },
  );
  const jar = await cookies();
  jar.set("nx_workspace", result.workspaceId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(`/app/workspaces/${result.workspaceId}`);
}

export async function acceptOwnershipTransferAction(token: string) {
  await nexosophyApi("/v1/ownership-transfers/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  redirect("/app/workspaces");
}
