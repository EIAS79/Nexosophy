import { ButtonLink } from "@nexosophy/ui";

export default function NotFound() {
  return (
    <main className="route-state" id="main-content">
      <section className="route-state__card">
        <p className="eyebrow">404</p>
        <h1>That page does not exist.</h1>
        <p>The link may be outdated, moved or unavailable to this route.</p>
        <ButtonLink href="/">Return home</ButtonLink>
      </section>
    </main>
  );
}
