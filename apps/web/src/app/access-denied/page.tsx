import { ButtonLink } from "@nexosophy/ui";

export default function AccessDeniedPage() {
  return (
    <main className="route-state" id="main-content">
      <section className="route-state__card">
        <p className="eyebrow">Access denied</p>
        <h1>You do not have access to this resource.</h1>
        <p>Authentication and permission enforcement are implemented in the identity and workspace phases.</p>
        <ButtonLink href="/app" variant="secondary">Return to workspace</ButtonLink>
      </section>
    </main>
  );
}
