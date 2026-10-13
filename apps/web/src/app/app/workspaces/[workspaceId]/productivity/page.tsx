import { ProductivityHub } from "../../../../../components/productivity-hub";

type Tab = "tasks" | "calendar" | "reminders" | "inbox" | "focus";

export default async function WorkspaceProductivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const tab: Tab =
    query.tab === "calendar" ||
    query.tab === "reminders" ||
    query.tab === "inbox" ||
    query.tab === "focus"
      ? query.tab
      : "tasks";
  return <ProductivityHub workspaceId={workspaceId} initialTab={tab} />;
}
