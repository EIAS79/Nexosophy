import { z } from "zod";

export const workspaceTypeSchema = z.enum([
  "personal",
  "team",
  "research",
  "lab",
  "class",
  "institution",
]);
export type WorkspaceType = z.infer<typeof workspaceTypeSchema>;

export const workspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "member",
  "viewer",
  "guest",
]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceMemberStatusSchema = z.enum(["active", "suspended"]);
export type WorkspaceMemberStatus = z.infer<typeof workspaceMemberStatusSchema>;

export const workspacePermissionSchema = z.enum([
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
]);
export type WorkspacePermission = z.infer<typeof workspacePermissionSchema>;

const nameSchema = z.string().trim().min(1).max(120);
const uuidSchema = z.string().uuid();

export const createWorkspaceRequestSchema = z.object({
  name: nameSchema,
  type: workspaceTypeSchema.exclude(["personal"]).default("team"),
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export const updateWorkspaceRequestSchema = z.object({
  name: nameSchema.optional(),
  expectedVersion: z.number().int().positive(),
});
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;

export const createWorkspaceInvitationRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  role: workspaceRoleSchema.exclude(["owner"]).default("member"),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(168),
});
export type CreateWorkspaceInvitationRequest = z.infer<
  typeof createWorkspaceInvitationRequestSchema
>;

export const acceptWorkspaceInvitationRequestSchema = z.object({
  token: z.string().min(32).max(512),
});
export type AcceptWorkspaceInvitationRequest = z.infer<
  typeof acceptWorkspaceInvitationRequestSchema
>;

export const updateWorkspaceMemberRequestSchema = z
  .object({
    role: workspaceRoleSchema.exclude(["owner"]).optional(),
    status: workspaceMemberStatusSchema.optional(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "At least one member field must be changed.",
  });
export type UpdateWorkspaceMemberRequest = z.infer<
  typeof updateWorkspaceMemberRequestSchema
>;

export const createOwnershipTransferRequestSchema = z.object({
  toUserId: uuidSchema,
  expiresInHours: z.number().int().min(1).max(72).default(24),
});
export type CreateOwnershipTransferRequest = z.infer<
  typeof createOwnershipTransferRequestSchema
>;

export const acceptOwnershipTransferRequestSchema = z.object({
  token: z.string().min(32).max(512),
});
export type AcceptOwnershipTransferRequest = z.infer<
  typeof acceptOwnershipTransferRequestSchema
>;

export const createResourceGrantRequestSchema = z.object({
  principalUserId: uuidSchema,
  resourceType: z.string().trim().min(1).max(80),
  resourceId: z.string().trim().min(1).max(200),
  permission: workspacePermissionSchema,
});
export type CreateResourceGrantRequest = z.infer<typeof createResourceGrantRequestSchema>;

export const createShareLinkRequestSchema = z.object({
  resourceType: z.string().trim().min(1).max(80),
  resourceId: z.string().trim().min(1).max(200),
  password: z.string().min(8).max(200).optional(),
  allowDownload: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});
export type CreateShareLinkRequest = z.infer<typeof createShareLinkRequestSchema>;

export const resolveShareLinkRequestSchema = z.object({
  password: z.string().max(200).optional(),
});
export type ResolveShareLinkRequest = z.infer<typeof resolveShareLinkRequestSchema>;

export const workspaceSummarySchema = z.object({
  id: uuidSchema,
  type: workspaceTypeSchema,
  name: z.string(),
  slug: z.string(),
  role: workspaceRoleSchema,
  memberStatus: workspaceMemberStatusSchema,
  permissionVersion: z.number().int().positive(),
  version: z.number().int().positive(),
  archivedAt: z.coerce.date().nullable(),
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

export const workspaceMemberSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  displayName: z.string(),
  email: z.string().nullable(),
  role: workspaceRoleSchema,
  status: workspaceMemberStatusSchema,
  version: z.number().int().positive(),
  joinedAt: z.coerce.date(),
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
