import { ButtonLink } from "@nexosophy/ui";
import { notFound } from "next/navigation";

const sections = {
  workspace: ["Workspace", "Browse the recursive workspace structure. Real node persistence arrives in Phase 04."],
  files: ["Files", "File browsing, uploads and previews land in the content and storage phases."],
  notes: ["Notes", "The shell is ready for rich documents, infinite pages, ink and media."],
  tasks: ["Tasks", "Tasks and projects plug into this route in the productivity phase."],
  calendar: ["Calendar", "Scheduling, recurrence and linked events plug into this route in the productivity phase."],
  search: ["Search", "Global permission-safe indexing and relationship search arrives in the search phase."],
  inbox: ["Inbox", "Notifications, mentions and activity plug into this route in the productivity phase."],
  research: ["Research", "Research projects, references and postgraduate workflows attach to this route later."],
  favorites: ["Favorites", "Pinned and favorite content will use the canonical node model."],
  trash: ["Trash", "Recoverable deletion and retention behavior arrives with history and recovery."],
} as const;

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const config = sections[section as keyof typeof sections];
  if (!config) notFound();

  return (
    <section className="route-state" aria-labelledby="section-title">
      <div className="route-state__card route-state__card--wide">
        <p className="eyebrow">Application shell</p>
        <h1 id="section-title">{config[0]}</h1>
        <p>{config[1]}</p>
        <div className="hero__actions">
          <ButtonLink href="/app" variant="secondary">Back to dashboard</ButtonLink>
        </div>
      </div>
    </section>
  );
}
