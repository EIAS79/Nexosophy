export type WorkspaceType =
  | "personal"
  | "team"
  | "research"
  | "lab"
  | "class"
  | "institution";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer" | "guest";

export type WorkspaceMemberStatus = "active" | "suspended";

export type WorkspacePermission =
  | "workspace.read"
  | "workspace.update"
  | "workspace.delete"
  | "members.read"
  | "members.invite"
  | "members.manage"
  | "roles.manage"
  | "sharing.read"
  | "sharing.manage"
  | "content.read"
  | "content.create"
  | "content.update"
  | "content.delete";

export type WorkspaceSummary = {
  id: string;
  type: WorkspaceType;
  name: string;
  slug: string;
  role: WorkspaceRole;
  memberStatus: WorkspaceMemberStatus;
  permissionVersion: number;
  version: number;
  archivedAt: Date | null;
};
