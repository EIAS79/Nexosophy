import { ButtonLink } from "@nexosophy/ui";
import { notFound } from "next/navigation";

type MarketingPage = {
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
};

const pages: Record<string, MarketingPage> = {
  features: {
    eyebrow: "Product",
    title: "A connected workspace for knowledge-heavy work.",
    body: "Nexosophy brings files, notes, planning, research, analysis and collaboration into one coherent system.",
    points: ["Recursive files and folders", "Rich documents and infinite notes", "Tasks, reminders and calendar", "Search, history and relationships"],
  },
  students: {
    eyebrow: "Students",
    title: "Keep courses, notes and deadlines connected.",
    body: "Build a semester workspace where lectures, assignments, exams and study material stay in context.",
    points: ["Course workspaces", "Assignment and exam planning", "Flashcards and revision", "Mobile quick capture"],
  },
  researchers: {
    eyebrow: "Researchers",
    title: "Move from literature to evidence to writing without losing provenance.",
    body: "Organize projects, references, datasets, experiments and drafts around the same research context.",
    points: ["Literature review", "References and citations", "Research projects", "Datasets and analysis"],
  },
  professors: {
    eyebrow: "Professors",
    title: "Teaching and supervision in the same knowledge system.",
    body: "Share resources, review work and track supervision milestones without creating another disconnected toolchain.",
    points: ["Teaching workspaces", "Review and feedback", "Supervision", "Shared calendars"],
  },
  labs: {
    eyebrow: "Laboratories",
    title: "Research records with traceability built in.",
    body: "Connect ELN entries, protocols, samples, inventory and equipment to the experiments that use them.",
    points: ["ELN", "Protocols and SOPs", "Sample lineage", "Equipment and inventory"],
  },
  reporters: {
    eyebrow: "Reporters",
    title: "Investigations where claims stay connected to evidence.",
    body: "Organize sources, interviews, evidence, fact checking and publication review inside a controlled workspace.",
    points: ["Source records", "Evidence mapping", "Fact checking", "Reviewed publishing"],
  },
  templates: {
    eyebrow: "Templates",
    title: "Start with a structure that matches the work.",
    body: "Reusable templates will cover academic, research, laboratory, reporting and analysis workflows.",
    points: ["Course setup", "Research project", "Laboratory notebook", "Investigation dossier"],
  },
  security: {
    eyebrow: "Security",
    title: "Permissions, recovery and portability are foundational.",
    body: "Nexosophy is designed around tenant isolation, permission-aware search and collaboration, recoverable history and controlled provider boundaries.",
    points: ["Server-side authorization", "History and recovery", "Private object storage", "Auditable sensitive operations"],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Plans that map to real entitlements, not scattered feature flags.",
    body: "The pricing surface is established now; Stripe-backed checkout, subscriptions and effective entitlements are implemented in their owning billing phase.",
    points: ["Individual plans", "Team workspaces", "Usage-aware entitlements", "Customer billing portal"],
  },
  help: {
    eyebrow: "Help",
    title: "Support that points to the actual workflow.",
    body: "The help center will connect product errors, setup guidance and support requests to safe diagnostic context.",
    points: ["Getting started", "Account and security", "Workspace help", "Billing and troubleshooting"],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Data handling that matches the product behavior.",
    body: "Privacy, export, deletion and retention surfaces are governed by the canonical data-classification and retention specification.",
    points: ["Exportability", "Deletion pipeline", "Retention controls", "Provider transparency"],
  },
};

export default async function MarketingInfoPage({
  params,
}: {
  params: Promise<{ marketing: string }>;
}) {
  const { marketing } = await params;
  const page = pages[marketing];
  if (!page) notFound();

  return (
    <main className="route-state" id="main-content">
      <section className="route-state__card route-state__card--wide">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.body}</p>
        <ul className="route-state__list">
          {page.points.map((point) => <li key={point}>{point}</li>)}
        </ul>
        <div className="hero__actions">
          <ButtonLink href="/sign-up">Start free</ButtonLink>
          <ButtonLink href="/" variant="secondary">Back to homepage</ButtonLink>
        </div>
      </section>
    </main>
  );
}
