import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell";
import { getMe, NexosophyApiError } from "../../lib/api-server";
import {
  assertClerkConfiguredForProtectedEnvironment,
  isClerkWebConfigured,
} from "../../lib/clerk-config";
import { shellData } from "../../lib/shell-data";

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  assertClerkConfiguredForProtectedEnvironment();

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

  const workspace = await shellData.getCurrentWorkspace();

  return <AppShell workspace={workspace}>{children}</AppShell>;
}
