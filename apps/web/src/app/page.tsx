import { ButtonLink } from "@nexosophy/ui";

import { MarketingHeader } from "../components/marketing-header";

const capabilities = [
  ["One recursive workspace", "Files, notes, datasets, projects and evidence live in one navigable knowledge structure."],
  ["Notes that fit the work", "Write structured documents, infinite-page notes, ink and visual thinking without losing context."],
  ["Plan beside the knowledge", "Tasks, reminders and calendar events link directly to the material that created the work."],
  ["Research with provenance", "References, experiments, evidence and analysis stay connected to their sources and versions."],
] as const;

const personas = [
  ["Students", "Courses, assignments, exams, notes and study planning."],
  ["Researchers", "Literature, projects, datasets, experiments and writing."],
  ["Laboratories", "ELN, protocols, samples, inventory and equipment."],
  ["Reporters", "Sources, interviews, claims, evidence and publication review."],
  ["Professors", "Teaching, feedback, supervision and shared research."],
  ["Analysts", "Datasets, transformations, notebooks, charts and reports."],
] as const;

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main id="main-content">
        <section className="hero">
          <div className="hero__content">
            <p className="eyebrow">Connected knowledge, not another isolated note app</p>
            <h1>Keep the work, the evidence and the thinking in one place.</h1>
            <p className="hero__lede">
              Nexosophy connects files, notes, planning, research, analysis and collaboration in one
              workspace built for serious knowledge work.
            </p>
            <div className="hero__actions">
              <ButtonLink href="/sign-up" size="lg">Start free</ButtonLink>
              <ButtonLink href="#capabilities" variant="secondary" size="lg">Explore the product</ButtonLink>
            </div>
            <p className="hero__trust">Portable by design. Permission-aware. Built for desktop, tablet and phone.</p>
          </div>

          <div className="product-preview" role="img" aria-label="Nexosophy workspace preview">
            <div className="product-preview__rail" aria-hidden="true">
              <span>N</span><span>H</span><span>F</span><span>N</span><span>T</span>
            </div>
            <div className="product-preview__tree">
              <strong>Research workspace</strong>
              <span>▾ Literature review</span>
              <span>　Reading notes</span>
              <span>　References</span>
              <span>▾ Experiments</span>
              <span>　Week 12 results</span>
            </div>
            <article className="product-preview__document">
              <span className="preview-kicker">Literature review</span>
              <h2>CRISPR delivery approaches</h2>
              <p>Compare delivery systems, evidence quality and experimental constraints in one working document.</p>
              <div className="preview-note">Linked: 18 references · 6 notes · 3 tasks</div>
            </article>
          </div>
        </section>

        <section className="marketing-section" id="capabilities" aria-labelledby="capabilities-title">
          <div className="section-heading">
            <p className="eyebrow">A common foundation</p>
            <h2 id="capabilities-title">Stop rebuilding context between tools.</h2>
          </div>
          <div className="feature-grid">
            {capabilities.map(([title, description]) => (
              <article className="feature-card" key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-section--tinted" aria-labelledby="roles-title">
          <div className="section-heading">
            <p className="eyebrow">One platform, different workflows</p>
            <h2 id="roles-title">Built around the work people actually do.</h2>
          </div>
          <div className="persona-grid">
            {personas.map(([title, description]) => (
              <article className="persona-card" key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section security-story" aria-labelledby="trust-title">
          <div>
            <p className="eyebrow">Trust is part of the product</p>
            <h2 id="trust-title">History, permissions and portability are foundational.</h2>
          </div>
          <div>
            <p>
              Nexosophy is designed so collaboration, search, exports and background work respect the same
              workspace authorization model. Your work should remain recoverable, auditable where required,
              and exportable without being trapped in a proprietary island.
            </p>
            <a className="text-link" href="/security">Read the security approach →</a>
          </div>
        </section>

        <section className="final-cta" aria-labelledby="final-cta-title">
          <p className="eyebrow">Build knowledge that stays connected</p>
          <h2 id="final-cta-title">Start with the work you already have.</h2>
          <div className="hero__actions">
            <ButtonLink href="/sign-up" size="lg">Create your workspace</ButtonLink>
            <ButtonLink href="/features" variant="secondary" size="lg">See all features</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div>
          <a className="brand" href="/"><span className="brand__mark" aria-hidden="true">N</span><span>Nexosophy</span></a>
          <p>Connected knowledge for serious work.</p>
        </div>
        <nav aria-label="Footer">
          <a href="/features">Features</a>
          <a href="/pricing">Pricing</a>
          <a href="/security">Security</a>
          <a href="/help">Help</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </footer>
    </>
  );
}
