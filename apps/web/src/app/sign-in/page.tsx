import { ButtonLink } from "@nexosophy/ui";

export default function SignInShellPage() {
  return (
    <main className="route-state" id="main-content">
      <section className="route-state__card">
        <p className="eyebrow">Authentication boundary</p>
        <h1>Sign in to Nexosophy.</h1>
        <p>The route and return-to boundary are established here. Clerk authentication is wired in Phase 02.</p>
        <ButtonLink href="/app">Preview application shell</ButtonLink>
      </section>
    </main>
  );
}
