import { describe, expect, it } from "vitest";

import type { WorkspacePermission, WorkspaceRole } from "@nexosophy/contracts";

import {
  effectiveWorkspacePermissions,
  hasWorkspacePermission,
  workspaceRolePermissions,
} from "./workspace-policy.js";

const permissions: readonly WorkspacePermission[] = [
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

const expected: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  owner: permissions,
  admin: permissions.filter((permission) => permission !== "workspace.delete"),
  member: [
    "workspace.read",
    "members.read",
    "sharing.read",
    "content.read",
    "content.create",
    "content.update",
  ],
  viewer: ["workspace.read", "members.read", "sharing.read", "content.read"],
  guest: ["workspace.read", "content.read"],
};

describe("workspace policy", () => {
  it("matches the complete baseline role-permission matrix", () => {
    for (const role of Object.keys(expected) as WorkspaceRole[]) {
      for (const permission of permissions) {
        expect(hasWorkspacePermission({ role, status: "active" }, permission)).toBe(
          expected[role].includes(permission),
        );
      }
      expect(workspaceRolePermissions[role]).toEqual(expected[role]);
    }
  });

  it("gives suspended memberships no effective permissions", () => {
    expect(
      effectiveWorkspacePermissions({
        role: "owner",
        status: "suspended",
        customPermissions: ["workspace.delete"],
      }),
    ).toEqual([]);
  });

  it("accepts only known custom permissions", () => {
    const effective = effectiveWorkspacePermissions({
      role: "guest",
      status: "active",
      customPermissions: ["sharing.manage", "invented.permission"],
    });
    expect(effective).toContain("sharing.manage");
    expect(effective).not.toContain("invented.permission");
  });
});
