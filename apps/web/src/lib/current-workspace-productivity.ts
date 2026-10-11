import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { shellData } from "./shell-data";

export async function redirectToCurrentWorkspaceProductivity(
  tab: "tasks" | "calendar" | "reminders" | "inbox" | "focus",
): Promise<never> {
  const jar = await cookies();
  const selected = jar.get("nx_workspace")?.value;
  if (selected) {
    redirect(`/app/workspaces/${selected}/productivity?tab=${tab}`);
  }
  const fallback = await shellData.getCurrentWorkspace();
  redirect(`/app/workspaces/${fallback.id}/productivity?tab=${tab}`);
}
