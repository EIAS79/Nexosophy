import type { CSSProperties } from "react";
import type { Metadata } from "next";

import { ConnectedWorkspaceDemo } from "../components/connected-workspace-demo";
import { HeroDashboard } from "../components/hero-dashboard";
import { HomeMotionController } from "../components/home-motion-controller";
import { MarketingHeader } from "../components/marketing-header";

import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Connected knowledge for serious work",
  description:
    "Nexosophy brings files, notes, planning, research, analysis and collaboration into one connected workspace for knowledge-intensive work.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Nexosophy — Connected knowledge for serious work",
    description:
      "One connected workspace for students, researchers, professors, laboratories, reporters and analysts.",
    url: "/",
    type: "website",
  },
};

const workflowStages = [
  ["01", "Capture", "Save notes, files, links and ideas without breaking your flow."],
  ["02", "Organize", "Turn loose information into a recursive, navigable workspace."],
  ["03", "Connect", "Relate sources, people, methods, tasks and evidence."],
  ["04", "Plan", "Move from insight to action with tasks, reminders and calendar."],
  ["05", "Analyze", "Interrogate documents and datasets while preserving provenance."],
  ["06", "Collaborate", "Review, comment and work together inside the same context."],
  ["07", "Produce", "Draft papers, reports, experiments and structured outputs."],
  ["08", "Publish", "Export or share controlled versions without losing lineage."],
  ["09", "Archive", "Keep versions, relationships and history discoverable later."],
] as const;

const personas = [
  {
    title: "Students",
    strap: "Learn deeper. Do more.",
    body: "Courses, assignments, exams, notes and study plans share one source of context.",
    tone: "cyan",
    items: ["Study plan", "Lecture notes", "Flashcards"],
  },
  {
    title: "Researchers",
    strap: "From questions to evidence.",
    body: "Literature, references, datasets, experiments and writing stay connected.",
    tone: "violet",
    items: ["Literature review", "References", "Research graph"],
  },
  {
    title: "Professors",
    strap: "Teach, mentor, collaborate.",
    body: "Resources, feedback, supervision and scheduling without another fragmented stack.",
    tone: "blue",
    items: ["Course hub", "Review queue", "Supervision"],
  },
  {
    title: "Laboratories",
    strap: "Trace every result.",
    body: "Protocols, experiments, samples, inventory and equipment with explicit provenance.",
    tone: "teal",
    items: ["Experiment runs", "Inventory", "Protocols"],
  },
  {
    title: "Reporters",
    strap: "Uncover. Verify. Tell.",
    body: "Sources, evidence, claims, interviews and publication review in one dossier.",
    tone: "amber",
    items: ["Evidence", "Fact check", "Timeline"],
  },
  {
    title: "Analysts",
    strap: "Turn knowledge into insight.",
    body: "Datasets, transformations, notebooks and dashboards stay reproducible and linked.",
    tone: "indigo",
    items: ["Dataset profile", "Analysis", "Dashboards"],
  },
] as const;

const faqs = [
  [
    "Is Nexosophy only for students?",
    "No. The same workspace primitives support students, postgraduate research, professors, laboratories, reporting and analytical work without splitting them into separate products.",
  ],
  [
    "Does everything become one giant document?",
    "No. Nexosophy keeps a recursive workspace of typed content. Documents, notes, tasks, references, datasets and domain records remain distinct while sharing identity, permissions, search, history and relationships.",
  ],
  [
    "What happens to my existing files?",
    "The product is designed around portable formats, explicit import fidelity and exportability. Original binaries are preserved where conversion would be destructive or incomplete.",
  ],
  [
    "Is AI required to use the product?",
    "No. AI is an assistive layer. Manual workflows remain available, and AI is not authoritative for permissions, billing, grades, signed records or publication approval.",
  ],
] as const;

function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? styles.markCompact : styles.mark} aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

function DocumentPreview() {
  return (
    <div className={styles.documentPreview}>
      <div className={styles.documentToolbar}>
        <span>H1</span>
        <span>Aa</span>
        <span>⌁</span>
        <span>≡</span>
        <span className={styles.documentAvatars}>● ● +3</span>
      </div>
      <div className={styles.documentPaper}>
        <p className={styles.documentKicker}>Literature review · In progress</p>
        <h3>The future of human-AI collaboration in science</h3>
        <p>
          Human-AI collaboration is reshaping the way we discover, learn and create. Keep the
          evidence, discussion and next actions beside the work.
        </p>
        <blockquote>
          Context should compound as the work evolves — not disappear between tools.
        </blockquote>
        <h4>1. Introduction</h4>
        <div className={styles.fakeLines}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function WorkspaceVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? styles.workspaceCompact : styles.workspaceVisual}>
      <div className={styles.workspaceTopbar}>
        <div className={styles.workspaceBrand}>
          <Mark compact />
          <strong>Nexosophy</strong>
        </div>
        <div className={styles.workspaceSearch}>Search across your knowledge…</div>
        <span className={styles.workspaceShare}>Share</span>
      </div>
      <div className={styles.workspaceBody}>
        <aside className={styles.workspaceSidebar}>
          <small>Workspace</small>
          <strong>PhD Research</strong>
          <span className={styles.workspaceNavItem}>Literature review</span>
          <span className={styles.workspaceNavItem}>Experiments</span>
          <span className={styles.workspaceNavItem}>Analysis</span>
          <span className={styles.workspaceNavItem}>Papers & writing</span>
          <span className={styles.workspaceNavItem}>Lab operations</span>
          <span className={styles.workspaceDivider} />
          <span className={styles.workspaceNavItem}>Shared with me</span>
          <span className={styles.workspaceNavItem}>Starred</span>
          <span className={styles.workspaceNavItem}>Recent</span>
        </aside>
        <DocumentPreview />
        <aside className={styles.workspaceInspector}>
          <div className={styles.graphCard}>
            <div className={styles.graphCore}>Human-AI</div>
            <i className={styles.nodeOne}>Methods</i>
            <i className={styles.nodeTwo}>Data</i>
            <i className={styles.nodeThree}>Evidence</i>
            <i className={styles.nodeFour}>People</i>
          </div>
          <div className={styles.referenceList}>
            <strong>Related</strong>
            <span>24 references</span>
            <span>12 citations</span>
            <span>8 backlinks</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className={styles.heroVisual}>
      <HeroDashboard />
    </div>
  );
}

function WorkflowVisual() {
  return (
    <div className={styles.workflowTrack}>
      <svg
        className={styles.workflowLine}
        viewBox="0 0 1200 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M25 104 C220 18 405 154 600 80 C790 10 985 148 1175 54" />
      </svg>
      {workflowStages.map(([number, title, description], index) => (
        <article
          className={styles.workflowStage}
          key={title}
          style={{ "--stage": index } as CSSProperties}
        >
          <span className={styles.workflowNumber}>{number}</span>
          <div className={styles.workflowNode}>{title.slice(0, 1)}</div>
          <h3>{title}</h3>
          <p>{description}</p>
          <div className={styles.workflowMini}>
            <i />
            <i />
            <i />
          </div>
        </article>
      ))}
    </div>
  );
}

function EcosystemVisual() {
  return (
    <div
      className={styles.ecosystemVisual}
      role="img"
      aria-label="One central Nexosophy workspace connected to documents, notes, whiteboards, search, tasks, calendar, references, datasets, experiments and dashboards."
    >
      <div aria-hidden="true" className={styles.ecosystemCanvas}>
        <WorkspaceVisual compact />
        <div className={styles.ecoDocs}>
          <small>Rich documents</small>
          <strong>Write with context</strong>
          <span className={styles.ecoPaper}>AI in scientific discovery</span>
        </div>
        <div className={styles.ecoNotes}>
          <small>Infinite notes</small>
          <span className={styles.ecoChip}>Research question</span>
          <span className={styles.ecoChip}>Hypothesis</span>
          <span className={styles.ecoChip}>Follow up</span>
        </div>
        <div className={styles.ecoBoard}>
          <small>Whiteboard</small>
          <div className={styles.ecoBoardGraph}>
            <i>Human</i>
            <i>AI</i>
            <i>Impact</i>
          </div>
        </div>
        <div className={styles.ecoSearch}>
          <small>Search</small>
          <strong>human ai collaboration</strong>
          <span>Documents · Notes · Datasets</span>
        </div>
        <div className={styles.ecoTasks}>
          <small>Tasks & calendar</small>
          <span>✓ Review papers</span>
          <span>11:00 · Lab meeting</span>
          <span>14:00 · Analysis</span>
        </div>
        <div className={styles.ecoData}>
          <small>References & datasets</small>
          <span>24 references</span>
          <span>320 samples</span>
          <span>48 experiment files</span>
        </div>

        <div className={styles.foundationOrbit}>
          <div className={styles.foundationCore}>
            <Mark />
          </div>
          <span className={styles.foundationIdentity}>One identity</span>
          <span className={styles.foundationPermissions}>One permissions layer</span>
          <span className={styles.foundationGraph}>One relationship graph</span>
        </div>
      </div>
    </div>
  );
}

function PersonaMini({ items, tone }: { items: readonly string[]; tone: string }) {
  return (
    <div className={styles.personaMini} data-tone={tone} aria-hidden="true">
      <div className={styles.personaMiniHead}>
        <span />
        <span />
        <span />
      </div>
      {items.map((item, index) => (
        <div className={styles.personaMiniRow} key={item}>
          <i>{index === 0 ? "✓" : "○"}</i>
          <span>{item}</span>
          <b />
        </div>
      ))}
      <div className={styles.personaChart}>
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function TrustVisual() {
  return (
    <div className={styles.trustVisual} aria-hidden="true">
      <div className={styles.permissionsPanel}>
        <div className={styles.panelHeading}>
          <strong>Secure sharing & permissions</strong>
          <span>Invite people</span>
        </div>
        <div className={styles.permissionRow}>
          <b>You</b>
          <span>Owner</span>
          <i>✓</i>
          <i>✓</i>
          <i>✓</i>
        </div>
        <div className={styles.permissionRow}>
          <b>Maya</b>
          <span>Editor</span>
          <i>✓</i>
          <i>✓</i>
          <i>—</i>
        </div>
        <div className={styles.permissionRow}>
          <b>Daniel</b>
          <span>Commenter</span>
          <i>✓</i>
          <i>—</i>
          <i>—</i>
        </div>
      </div>
      <div className={styles.historyPanel}>
        <div className={styles.panelHeading}>
          <strong>Version history</strong>
          <span>View all</span>
        </div>
        <div className={styles.historyItem}>
          <i />
          <b>v1.4</b>
          <span>Analysis section added</span>
        </div>
        <div className={styles.historyItem}>
          <i />
          <b>v1.3</b>
          <span>Methodology revised</span>
        </div>
        <div className={styles.historyItem}>
          <i />
          <b>v1.2</b>
          <span>Figures updated</span>
        </div>
      </div>
      <div className={styles.commentsPanel}>
        <div className={styles.panelHeading}>
          <strong>Comments & mentions</strong>
          <span>5 open</span>
        </div>
        <p>
          <b>Maya</b> This section looks good. @Daniel can you verify the citation?
        </p>
        <p>
          <b>Daniel</b> Updated the source and attached the figure.
        </p>
      </div>
      <div className={styles.activityPanel}>
        <div className={styles.panelHeading}>
          <strong>Activity log</strong>
          <span>Filter</span>
        </div>
        <span>Commented on Introduction · 12m</span>
        <span>Edited Section 2.3 · 24m</span>
        <span>Uploaded analysis.ipynb · 1h</span>
      </div>
      <div className={styles.infrastructurePanel}>
        <div className={styles.panelHeading}>
          <strong>Resilient by design</strong>
          <span>Observable</span>
        </div>
        <div className={styles.infrastructureMap}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className={styles.infrastructureLegend}>
          <span>Horizontally scalable services</span>
          <span>Bounded database connections</span>
          <span>Durable queues and recovery paths</span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className={styles.page} data-home-root>
      <HomeMotionController />
      <div className={styles.ambientLayer} aria-hidden="true">
        <div className={styles.ambientGlowOne} />
        <div className={styles.ambientGlowTwo} />
        <div className={styles.ambientGrid} />
        <svg className={styles.ambientThread} viewBox="0 0 100 1000" preserveAspectRatio="none">
          <title>Decorative connected knowledge path</title>
          <path
            pathLength="1"
            d="M49 0 C78 85 18 150 52 235 C80 310 27 390 53 470 C78 555 25 620 50 700 C70 775 33 845 51 1000"
          />
        </svg>
      </div>

      <MarketingHeader />

      <main id="main-content" className={styles.main}>
        <section className={styles.hero} data-motion-scene>
          <div className={styles.heroBackdrop} aria-hidden="true">
            <div className={styles.heroHumanBackdrop} />
          </div>

          <div className={styles.heroStage}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>A unified knowledge and work platform</p>
            <h1>
              Your knowledge
              <br />
              in a <em>brighter</em> orbit.
            </h1>
            <p className={styles.lede}>
              Nexosophy connects your research, notes, tasks, files, data and people with AI — so
              you can think deeper, move faster, and create what&apos;s next.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryCta} href="/signup">
                Get started free <span>→</span>
              </a>
              <a className={styles.secondaryCta} href="#product-story">
                <span className={styles.playIcon}>▶</span>
                <span>
                  Watch overview
                  <small>2 min</small>
                </span>
              </a>
            </div>
            <div className={styles.heroProof}>
              <div className={styles.avatarStack} aria-hidden="true">
                <span>A</span><span>R</span><span>P</span><span>L</span>
              </div>
              <p>Join people turning research, learning and serious work into connected progress.</p>
            </div>
          </div>

          <HeroVisual />
          </div>
        </section>

        <section className={styles.scatterSection} id="product-story" data-motion-scene>
          <header className={`${styles.sectionHeader} ${styles.contextSectionHeader}`}>
            <p className={styles.eyebrow}>One connected workspace</p>
            <h2>
              From scattered tools to a <em>connected workspace.</em>
            </h2>
            <p className={styles.contextIntro}>
              Research today lives in too many places — files, notes, tasks, calendars, references,
              data and people. Nexosophy brings it together so context stays attached to the work.
            </p>
          </header>

          <ConnectedWorkspaceDemo />
        </section>

        <section className={styles.workflowSection} id="workflow" data-motion-scene>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>A complete knowledge workflow</p>
            <h2>
              From idea to <em>impact.</em>
            </h2>
            <p>
              Capture, organize, connect, plan, analyze, collaborate and produce without rebuilding
              context at every step.
            </p>
          </header>
          <WorkflowVisual />
          <aside className={styles.contextCallout}>
            <span className={styles.infinity}>∞</span>
            <div>
              <strong>Your context, preserved at every step.</strong>
              <p>
                Notes, files, discussions, data and decisions remain linked across the lifecycle.
              </p>
            </div>
            <div className={styles.contextTags}>
              <span>Connected</span>
              <span>Versioned</span>
              <span>Searchable</span>
              <span>Permission-aware</span>
            </div>
          </aside>
        </section>

        <section className={styles.ecosystemSection} id="workspace-ecosystem" data-motion-scene>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>One workspace. Every capability.</p>
            <h2>
              A recursive workspace for how <em>knowledge</em> works.
            </h2>
            <p>
              Rich documents, infinite notes, whiteboards, planning, references, datasets and
              experiments all reuse the same foundational model.
            </p>
          </header>
          <EcosystemVisual />
        </section>

        <section className={styles.personaSection} id="use-cases" data-motion-scene>
          <header className={styles.sectionHeader}>
            <p className={styles.eyebrow}>For every knowledge worker</p>
            <h2>
              Different work. One <em>connected</em> foundation.
            </h2>
            <p>
              Nexosophy adapts to the workflow without pretending each profession needs a completely
              separate product.
            </p>
          </header>
          <div className={styles.personaGrid}>
            {personas.map((persona) => (
              <article className={styles.personaCard} key={persona.title}>
                <div className={styles.personaCardTop}>
                  <span className={styles.personaIcon}>{persona.title.slice(0, 1)}</span>
                  <a
                    href={
                      persona.title === "Laboratories"
                        ? "/labs"
                        : "/".concat(persona.title.toLowerCase())
                    }
                    aria-label={"Explore Nexosophy for ".concat(persona.title)}
                  >
                    ↗
                  </a>
                </div>
                <h3>{persona.title}</h3>
                <strong>{persona.strap}</strong>
                <p>{persona.body}</p>
                <PersonaMini items={persona.items} tone={persona.tone} />
              </article>
            ))}
          </div>
        </section>

        <section className={styles.trustSection} id="trust" data-motion-scene>
          <div className={styles.trustCopy}>
            <p className={styles.eyebrow}>Built for serious work</p>
            <h2>
              Trusted workspaces for <em>real</em> impact.
            </h2>
            <p>
              Collaboration only matters if permissions, history, recovery and infrastructure remain
              dependable. Those controls are part of the architecture, not decorative enterprise
              copy.
            </p>
            <ul className={styles.trustList}>
              <li>
                <strong>Permission-aware everywhere.</strong>
                <span>Search, realtime, exports and jobs respect workspace scope.</span>
              </li>
              <li>
                <strong>Recoverable by design.</strong>
                <span>History, trash and restore semantics protect acknowledged work.</span>
              </li>
              <li>
                <strong>Auditable where it matters.</strong>
                <span>Privileged and sensitive mutations have explicit traceability.</span>
              </li>
              <li>
                <strong>Scale without single-server assumptions.</strong>
                <span>Shared coordination, bounded pools and durable queues.</span>
              </li>
            </ul>
            <a className={styles.textLink} href="/security">
              Read the security approach →
            </a>
          </div>
          <TrustVisual />
        </section>

        <section className={styles.pricingSection} id="pricing-preview" data-motion-scene>
          <div className={styles.pricingGlow} aria-hidden="true" />
          <div>
            <p className={styles.eyebrow}>Start simple. Grow deliberately.</p>
            <h2>The workspace can grow with the work.</h2>
            <p>
              Start with the core workspace and move into deeper collaboration, research and
              institutional workflows when you need them.
            </p>
          </div>
          <div className={styles.pricingCards}>
            <article>
              <small>Start</small>
              <h3>Personal workspace</h3>
              <p>Capture, organize and connect your own work.</p>
            </article>
            <article>
              <small>Grow</small>
              <h3>Advanced workflows</h3>
              <p>Research, analysis, collaboration and specialist tools.</p>
            </article>
            <article>
              <small>Scale</small>
              <h3>Teams & institutions</h3>
              <p>Shared workspaces, governance and operational controls.</p>
            </article>
          </div>
          <a className={styles.primaryCta} href="/pricing">
            Explore pricing <span>→</span>
          </a>
        </section>

        <section className={styles.faqSection} id="faq" data-motion-scene>
          <header className={`${styles.sectionHeader} ${styles.faqHeader}`}>
            <p className={styles.eyebrow}>Questions, answered</p>
            <h2>Designed to be powerful without becoming a black box.</h2>
          </header>
          <div className={styles.faqGrid}>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finalCta} id="get-started" data-motion-scene>
          <div className={styles.finalOrb} aria-hidden="true">
            <Mark />
          </div>
          <p className={styles.eyebrow}>Build knowledge that stays connected</p>
          <h2>Bring the work together.</h2>
          <p>
            Start with what you already have. Keep the context as the work becomes more ambitious.
          </p>
          <div className={styles.actions}>
            <a className={styles.primaryCta} href="/signup">
              Create your workspace <span>→</span>
            </a>
            <a className={styles.secondaryCta} href="/features">
              Explore all features
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <a href="/" aria-label="Nexosophy home">
            <Mark compact />
            <strong>Nexosophy</strong>
          </a>
          <p className={styles.footerTagline}>Connected knowledge for serious work.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/features">Features</a>
          <a href="/students">Use cases</a>
          <a href="/pricing">Pricing</a>
          <a href="/security">Security</a>
          <a href="/help">Help</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </footer>
    </div>
  );
}