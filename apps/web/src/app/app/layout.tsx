import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell.js";
import { shellData } from "../../lib/shell-data.js";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const workspace = await shellData.getCurrentWorkspace();

  return <AppShell workspace={workspace}>{children}</AppShell>;
}
