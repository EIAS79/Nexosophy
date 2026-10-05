import { ButtonLink } from "@nexosophy/ui";

export default function AppHomePage() {
  return (
    <>
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1>Your knowledge, in context.</h1>
          <p>Continue recent work, capture something new, or move to the next task.</p>
        </div>
        <ButtonLink href="/app/notes" size="sm">New note</ButtonLink>
      </header>

      <section className="dashboard-grid" aria-label="Dashboard">
        <article className="dashboard-card dashboard-card--wide">
          <h2>Continue working</h2>
          <div className="empty-state">
            <div>
              <strong>No recent documents yet.</strong>
              <p>Your recently opened files and notes will appear here.</p>
            </div>
          </div>
        </article>

        <article className="dashboard-card">
          <h2>Upcoming</h2>
          <div className="empty-state">
            <div>
              <strong>Your schedule is clear.</strong>
              <p>Tasks, reminders and calendar items will appear here.</p>
            </div>
          </div>
        </article>

        <article className="dashboard-card">
          <h2>Quick capture</h2>
          <p>Create a note now. Tasks, files and other capture actions arrive in their owning phases.</p>
          <ButtonLink href="/app/notes" variant="secondary" size="sm">Open notes</ButtonLink>
        </article>

        <article className="dashboard-card">
          <h2>Workspace</h2>
          <p>The shell is connected to a typed adapter, ready for the real workspace model in Phase 03.</p>
          <ButtonLink href="/app/workspace" variant="secondary" size="sm">Open workspace</ButtonLink>
        </article>

        <article className="dashboard-card">
          <h2>Search</h2>
          <p>The command palette already provides keyboard navigation; indexed content arrives in Phase 10.</p>
          <ButtonLink href="/app/search" variant="secondary" size="sm">Open search</ButtonLink>
        </article>
      </section>
    </>
  );
}
