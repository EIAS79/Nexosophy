import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { shellData } from "../../../lib/shell-data";

export default async function GlobalSearchPage() {
  const jar = await cookies();
  const selected = jar.get("nx_workspace")?.value;
  if (selected) redirect(`/app/workspaces/${selected}/search`);
  const fallback = await shellData.getCurrentWorkspace();
  redirect(`/app/workspaces/${fallback.id}/search`);
}
