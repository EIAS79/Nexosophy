import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell";
import { getMe, nexosophyApi, NexosophyApiError } from "../../lib/api-server";
import {
  assertClerkConfiguredForProtectedEnvironment,
  isClerkWebConfigured,
} from "../../lib/clerk-config";
import { buildShellWorkspace, shellData } from "../../lib/shell-data";

type WorkspaceListItem = {
  id: string;
  name: string;
};

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  assertClerkConfiguredForProtectedEnvironment();

  let workspace = await shellData.getCurrentWorkspace();
  let workspaceOptions: readonly WorkspaceListItem[] = [
    { id: workspace.id, name: workspace.name },
  ];

  if (isClerkWebConfigured()) {
    await auth.protect({ unauthenticatedUrl: "/login" });

    try {
      const account = await getMe();

      if (
        account.onboarding.status !== "completed" &&
        account.onboarding.status !== "skipped"
      ) {
        redirect("/onboarding");
      }

      const data = await nexosophyApi<{ workspaces: WorkspaceListItem[] }>("/v1/workspaces");
      if (data.workspaces.length > 0) {
        workspaceOptions = data.workspaces;
        const jar = await cookies();
        const selectedId = jar.get("nx_workspace")?.value;
        const selected =
          data.workspaces.find((item) => item.id === selectedId) ?? data.workspaces[0];
        if (selected) {
          workspace = buildShellWorkspace(selected.id, selected.name);
        }
      }
    } catch (error) {
      if (
        error instanceof NexosophyApiError &&
        (error.status === 403 || error.code === "ACCOUNT_UNAVAILABLE")
      ) {
        redirect("/access-denied");
      }

      throw error;
    }
  }

  return (
    <AppShell workspace={workspace} workspaces={workspaceOptions}>
      {children}
    </AppShell>
  );
}
