import { redirectToCurrentWorkspaceProductivity } from "../../../lib/current-workspace-productivity";

export default async function Page() {
  return redirectToCurrentWorkspaceProductivity("tasks");
}
