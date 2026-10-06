import type {
  WorkspaceMemberStatus,
  WorkspacePermission,
  WorkspaceRole,
} from "@nexosophy/contracts";

export const WORKSPACE_PERMISSIONS: readonly WorkspacePermission[] = [
  "workspace.read",
  "workspace.update",
  "workspace.delete",
  "members.read",
  "members.invite",
  "members.manage",
  "roles.manage",
  "sharing.read",
  "sharing.manage",
  "content.read",
  "content.create",
  "content.update",
  "content.delete",
];

export const workspaceRolePermissions: Record<
  WorkspaceRole,
  readonly WorkspacePermission[]
> = {
  owner: WORKSPACE_PERMISSIONS,
  admin: WORKSPACE_PERMISSIONS.filter(
    (permission) => permission !== "workspace.delete",
  ),
  member: [
    "workspace.read",
    "members.read",
    "sharing.read",
    "content.read",
    "content.create",
    "content.update",
  ],
  viewer: [
    "workspace.read",
    "members.read",
    "sharing.read",
    "content.read",
  ],
  guest: ["workspace.read", "content.read"],
};

export type WorkspaceAuthorizationInput = {
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  customPermissions?: readonly string[];
};

export function effectiveWorkspacePermissions(
  input: WorkspaceAuthorizationInput,
): ReadonlySet<WorkspacePermission> {
  if (input.status !== "active") return new Set();

  const permissions = new Set<WorkspacePermission>(
    workspaceRolePermissions[input.role],
  );

  for (const permission of input.customPermissions ?? []) {
    if ((WORKSPACE_PERMISSIONS as readonly string[]).includes(permission)) {
      permissions.add(permission as WorkspacePermission);
    }
  }

  return permissions;
}

export function hasWorkspacePermission(
  input: WorkspaceAuthorizationInput,
  permission: WorkspacePermission,
): boolean {
  return effectiveWorkspacePermissions(input).has(permission);
}

export function canChangeWorkspaceMemberRole(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
  nextRole: WorkspaceRole,
): boolean {
  if (actorRole !== "owner" && actorRole !== "admin") return false;
  if (targetRole === "owner" || nextRole === "owner") return false;
  if (actorRole === "admin" && (targetRole === "admin" || nextRole === "admin")) {
    return false;
  }
  return true;
}

export function canRemoveWorkspaceMember(
  actorRole: WorkspaceRole,
  targetRole: WorkspaceRole,
): boolean {
  if (actorRole !== "owner" && actorRole !== "admin") return false;
  if (targetRole === "owner") return false;
  if (actorRole === "admin" && targetRole === "admin") return false;
  return true;
}
