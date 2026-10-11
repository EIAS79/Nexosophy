"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartLineUp,
  Check,
  FileText,
  Flask,
  Folder,
  LockKey,
  Play,
  ShieldCheck,
  Users,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import {
  AIPreview,
  Comments,
  DemoPanel,
  GlassPanel,
  GraphCanvas,
  icons,
  type Kind,
  Mark,
  MiniAppWindow,
  MiniDocument,
  Permissions,
  PersonaPreview,
  SearchPreview,
  TaskList,
  Versions,
} from "./cinematic/demos";
import s from "./cinematic/home.module.css";

const capabilities: Kind[] = [
  "Document",
  "Notes",
  "Whiteboard",
  "Search",
  "Tasks",
  "Calendar",
  "References",
  "Datasets",
  "Experiments",
  "Dashboards",
];
const roles = [
  {
    name: "Students",
    subtitle: "Learn deeper. Do more.",
    copy: "A home for courses, reading, study notes and the questions that help you understand.",
    image: "student",
    kind: "Tasks" as Kind,
    title: "Study plan",
    detail:
      "Collect your course materials, connect reading to your notes, and shape a study plan. Flashcards and quizzes illustrate the longer-term learning vision.",
  },
  {
    name: "Researchers",
    subtitle: "From ideas to impact.",
    copy: "Keep your literature, evidence and developing arguments in the same conversation.",
    image: "researcher",
    kind: "References" as Kind,
    title: "Literature review",
    detail:
      "Organize papers beside the questions they answer. The concept brings research notes, source context and experiment records into a connected project.",
  },
  {
    name: "Professors",
    subtitle: "Teach, mentor, collaborate.",
    copy: "Connect the materials you teach with the ideas your students are discovering.",
    image: "research-team",
    kind: "Notes" as Kind,
    title: "Course hub",
    detail:
      "A possible home for syllabi, lecture materials, assignments and student questions. Teaching and mentoring features shown here are a product direction.",
  },
  {
    name: "Laboratories",
    subtitle: "Organize. Analyze. Advance.",
    copy: "Keep protocols, observations and the next experiment within reach.",
    image: "laboratory",
    kind: "Experiments" as Kind,
    title: "Experiments",
    detail:
      "Explore a connected record of protocols, datasets and experiments. Statuses in the homepage are illustrative, not live laboratory records.",
  },
  {
    name: "Reporters",
    subtitle: "Uncover. Verify. Tell.",
    copy: "Keep sources close to every claim, and make room for the context that matters.",
    image: "reporter",
    kind: "Tasks" as Kind,
    title: "Fact-check checklist",
    detail:
      "Organize source notes, compare perspectives and track questions requiring verification. No sample claim on this page is represented as independently verified.",
  },
  {
    name: "Analysts",
    subtitle: "Turn knowledge into insight.",
    copy: "Give data, interpretation and decisions one continuous thread.",
    image: "researcher",
    kind: "Dashboards" as Kind,
    title: "Key insights",
    detail:
      "Explore the direction of linked datasets, analysis notes and reports. The chart is illustrative and does not run a statistical analysis.",
  },
];
const stages = [
  { name: "Capture", text: "Save the spark. Keep the source.", kind: "Files" as Kind },
  { name: "Organize", text: "Give your knowledge a structure.", kind: "Notes" as Kind },
  { name: "Connect", text: "Follow the relationships.", kind: "Graph" as Kind },
  { name: "Plan", text: "Turn an insight into a next step.", kind: "Tasks" as Kind },
  { name: "Analyze", text: "Ask more of your information.", kind: "Nexa AI" as Kind },
  { name: "Collaborate", text: "Bring another perspective in.", kind: "Collaboration" as Kind },
  { name: "Produce", text: "Give your thinking a form.", kind: "Document" as Kind },
  { name: "Publish", text: "Share something worth sharing.", kind: "References" as Kind },
  { name: "Archive", text: "Keep the context for what’s next.", kind: "Search" as Kind },
];
function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={s.eyebrow}>{children}</p>;
}
function SceneBackdrop({
  name,
  priority = false,
  className = "",
}: {
  name: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`${s.backdrop} ${className}`} aria-hidden="true">
      <Image
        src={`/home/cinematic/${name}.webp`}
        alt=""
        fill
        sizes="100vw"
        preload={priority}
        className={s.sceneImage}
      />
    </div>
  );
}
function ConnectorLayer({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  const [geometry, setGeometry] = useState({ width: 1, height: 1, paths: [] as string[] });
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const center = element.querySelector<HTMLElement>("[data-center]")?.getBoundingClientRect();
      if (!center) return;
      const cx = center.left + center.width / 2 - bounds.left;
      const cy = center.top + center.height / 2 - bounds.top;
      const paths = [...element.querySelectorAll<HTMLElement>("[data-connect]")].map((node) => {
        const rect = node.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - bounds.left;
        const y = rect.top + rect.height / 2 - bounds.top;
        return `M${x} ${y} Q${cx} ${y} ${cx} ${cy}`;
      });
      setGeometry({ width: bounds.width, height: bounds.height, paths });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const node of element.querySelectorAll<HTMLElement>("[data-center], [data-connect]"))
      observer.observe(node);
    update();
    return () => observer.disconnect();
  }, [stage]);
  return (
    <svg
      className={s.connectors}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      aria-hidden="true"
    >
      {geometry.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
function WorkflowPanel({ index }: { index: number }) {
  const [chosen, setChosen] = useState("");
  if (index === 0)
    return (
      <div className={s.imports}>
        {[
          "Web clip",
          "PDF / document",
          "Note / idea",
          "Image / screenshot",
          "Import from tools",
        ].map((x) => (
          <button type="button" key={x} onClick={() => setChosen(x)} aria-pressed={chosen === x}>
            <Folder size={14} />
            {x}
          </button>
        ))}
        {chosen && (
          <p role="status" className={s.miniText}>
            {chosen} selected · import concept
          </p>
        )}
      </div>
    );
  if (index === 1)
    return (
      <div className={s.fileTree}>
        <strong>My Library</strong>
        {["Research", "Literature Review", "Experiments", "Ideas & Drafts", "Papers & Writing"].map(
          (x) => (
            <p key={x}>
              <Folder size={14} />
              {x}
            </p>
          ),
        )}
      </div>
    );
  if (index === 2) return <GraphCanvas small />;
  if (index === 3)
    return (
      <TaskList
        items={[
          "Define question",
          "Review literature",
          "Run experiments",
          "Draft outline",
          "Prepare figures",
        ]}
      />
    );
  if (index === 4) return <AIPreview />;
  if (index === 5) return <Comments />;
  if (index === 6) return <MiniDocument bright />;
  if (index === 7)
    return (
      <div className={s.imports}>
        {["Export manuscript", "Create preprint", "Share link", "Generate report", "Present"].map(
          (x) => (
            <button type="button" key={x} onClick={() => setChosen(x)} aria-pressed={chosen === x}>
              <FileText size={14} />
              {x}
            </button>
          ),
        )}
        {chosen && (
          <p role="status" className={s.miniText}>
            {chosen} is a planned publishing action, not an export operation.
          </p>
        )}
      </div>
    );
  return <SearchPreview />;
}

export function ConnectedHome() {
  const root = useRef<HTMLDivElement>(null);
  const heroStage = useRef<HTMLDivElement>(null);
  const architecture = useRef<HTMLDivElement>(null);
  const transformation = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [menu, setMenu] = useState(false);
  const [motion, setMotion] = useState(true);
  const [step, setStep] = useState(0);
  const [workflowPlaying, setWorkflowPlaying] = useState(true);
  const [workflowHovered, setWorkflowHovered] = useState(false);
  const [workflowFocused, setWorkflowFocused] = useState(false);
  const workflowDirection = useRef(1);
  const [persona, setPersona] = useState<number | null>(null);
  const [tour, setTour] = useState(0);
  const [comparison, setComparison] = useState("Connected");
  const [activity, setActivity] = useState("All");
  const showTour = () => {
    setPersona(null);
    setTour(0);
    dialog.current?.showModal();
  };
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          (entry.target as HTMLElement).dataset.visible = String(entry.isIntersecting);
      },
      { rootMargin: "80px" },
    );
    for (const scene of element.querySelectorAll<HTMLElement>("[data-scene]"))
      observer.observe(scene);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = rail.current;
    if (!element || !motion || !workflowPlaying || workflowHovered || workflowFocused) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    const timer = window.setInterval(() => {
      if (!visible || document.hidden || preference.matches) return;
      const distance = (element.children[1] as HTMLElement | undefined)?.offsetLeft;
      const first = (element.children[0] as HTMLElement | undefined)?.offsetLeft;
      if (distance === undefined || first === undefined) return;
      const end = element.scrollWidth - element.clientWidth;
      if (end <= 0) return;
      if (element.scrollLeft >= end - 2) workflowDirection.current = -1;
      if (element.scrollLeft <= 2) workflowDirection.current = 1;
      element.scrollTo({
        left: Math.max(
          0,
          Math.min(end, element.scrollLeft + (distance - first) * workflowDirection.current),
        ),
        behavior: "smooth",
      });
    }, 4500);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [motion, workflowPlaying, workflowHovered, workflowFocused]);
  const goStep = (index: number) => {
    setWorkflowPlaying(false);
    const next = Math.max(0, Math.min(8, index));
    setStep(next);
    const child = rail.current?.children[next] as HTMLElement | undefined;
    if (rail.current && child)
      rail.current.scrollTo({
        left:
          index === step - 1 &&
          rail.current.scrollLeft + rail.current.clientWidth >= rail.current.scrollWidth - 2
            ? rail.current.scrollLeft - child.getBoundingClientRect().width - 24
            : child.offsetLeft - rail.current.offsetLeft,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  return (
    <div ref={root} className={s.home} data-motion={motion}>
      <header className={s.header}>
        <Link href="/" className={s.brand}>
          <Mark />
          Nexosophy
        </Link>
        <button
          className={s.mobileMenu}
          type="button"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-controls="cinematic-nav"
        >
          {menu ? "Close" : "Menu"}
        </button>
        <nav id="cinematic-nav" data-open={menu} aria-label="Main navigation">
          <Link href="#workspace" onClick={() => setMenu(false)}>
            Workspace
          </Link>
          <Link href="#workflow" onClick={() => setMenu(false)}>
            How it connects
          </Link>
          <Link href="#people" onClick={() => setMenu(false)}>
            Who it’s for
          </Link>
          <button
            type="button"
            className={s.motionToggle}
            aria-pressed={!motion}
            onClick={() => setMotion(!motion)}
          >
            {motion ? "Pause motion" : "Enable motion"}
          </button>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className={s.navCta}>
            Get started <ArrowUpRight size={14} />
          </Link>
        </nav>
      </header>
      <main id="main-content">
        <section className={s.hero} data-scene data-visible="true" aria-labelledby="hero-title">
          <SceneBackdrop name="hero" priority />
          <div className={s.heroShade} />
          <div ref={heroStage} className={s.heroStage}>
            <ConnectorLayer stage={heroStage} />
            <svg className={s.orbitLines} viewBox="0 0 1000 700" aria-hidden="true">
              <ellipse cx="500" cy="285" rx="310" ry="175" transform="rotate(-18 500 285)" />
              <ellipse cx="500" cy="285" rx="285" ry="225" transform="rotate(30 500 285)" />
              <circle cx="241" cy="180" r="4" />
              <circle cx="775" cy="362" r="4" />
              <circle cx="660" cy="106" r="3" />
            </svg>
            <div className={s.planet} aria-hidden="true">
              <Image
                src="/home/cinematic/globe.webp"
                alt=""
                fill
                sizes="(max-width: 767px) 90vw, 52vw"
                preload
              />
            </div>
            <div className={s.heroCopy} data-center>
              <Eyebrow>A UNIFIED KNOWLEDGE AND WORK PLATFORM</Eyebrow>
              <h1 id="hero-title">
                Your knowledge
                <br />
                in a <em>brighter</em> orbit.
              </h1>
              <p>
                Your research, notes, sources and next steps.
                <br />
                One connected space for the ideas
                <br className={s.desktopBreak} /> that take you further.
              </p>
              <div className={s.ctas}>
                <Link href="/sign-up" className={s.primary}>
                  Get started <ArrowRight size={16} />
                </Link>
                <button type="button" className={s.secondary} onClick={showTour}>
                  <Play size={16} /> Explore the vision
                </button>
              </div>
              <p className={s.heroFootnote}>
                <span className={s.smallAvatars}>
                  <span>AK</span>
                  <span>MC</span>
                  <span>PS</span>
                </span>
                Made for curious minds.
                <br />
                Illustrative workspace · not live account data.
              </p>
            </div>
            <div className={s.heroPanels}>
              {(["Document", "Graph", "References", "Nexa AI", "Tasks", "Timeline"] as Kind[]).map(
                (kind, index) => (
                  <div key={kind} data-connect data-orbit={index} className={s.orbitPanel}>
                    <GlassPanel
                      kind={kind}
                      title={kind}
                      badge={kind === "Nexa AI" ? "Preview" : undefined}
                    >
                      <DemoPanel kind={kind} />
                    </GlassPanel>
                  </div>
                ),
              )}
            </div>
          </div>
          <div className={s.heroBottom}>
            <span>EVERY IDEA BEGINS WITH A CONNECTION</span>
            <a href="#transformation">
              Follow the thread <ArrowRight size={13} />
            </a>
          </div>
        </section>

        <section id="transformation" className={`${s.section} ${s.transformation}`} data-scene>
          <SceneBackdrop name="alpine-city" />
          <div className={s.sectionHeading}>
            <Eyebrow>ONE CONNECTED WORKSPACE</Eyebrow>
            <h2>
              From scattered tools
              <br />
              to a <em>connected</em> workspace.
            </h2>
            <p>
              Important work deserves more than another open tab.
              <br />
              Keep the source, the thought and the next step in context.
            </p>
          </div>
          <fieldset className={s.compareTabs} aria-label="Compare approaches">
            {["Scattered", "Connected"].map((name) => (
              <button
                type="button"
                key={name}
                aria-pressed={comparison === name}
                onClick={() => setComparison(name)}
              >
                {name}
              </button>
            ))}
          </fieldset>
          <div ref={transformation} className={s.comparison} data-side={comparison}>
            <ConnectorLayer stage={transformation} />
            <div className={s.oldWay}>
              <small>THE OLD WAY</small>
              <h3>
                Important work,
                <br />
                everywhere.
              </h3>
              <p>
                Notes in one place. Sources in another.
                <br />
                The thinking between them gets lost.
              </p>
              <div className={s.fragments}>
                {(["Notes", "Calendar", "Files", "References", "Tasks", "Datasets"] as Kind[]).map(
                  (name, index) => {
                    const Icon = icons[name];
                    return (
                      <div
                        className={s.fragment}
                        data-connect
                        key={name}
                        style={{ transform: `rotate(${index % 2 === 0 ? -7 : 6}deg)` }}
                      >
                        <Icon size={20} />
                        <strong>{name}</strong>
                        <span>
                          {
                            [
                              "Meeting notes",
                              "Research review",
                              "Drafts & papers",
                              "Source library",
                              "Next actions",
                              "Observations",
                            ][index]
                          }
                        </span>
                        <p className={s.fragmentDetail}>
                          {
                            [
                              "What if we could connect these findings?",
                              "10:00 · Team review / 14:30 · Writing",
                              "Manuscript.pdf · Notes.md · Results.csv",
                              "3 papers saved · citation missing",
                              "Review methods · Draft an outline",
                              "24 observations · 3 variables",
                            ][index]
                          }
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
            <div className={s.transformMark} data-center>
              <Mark />
              <span>One shared context</span>
            </div>
            <div className={s.newWay} data-connect>
              <small>THE NEXOSOPHY WAY</small>
              <h3>
                Everything in context.
                <br />
                <em>Built for what you do.</em>
              </h3>
              <MiniAppWindow dashboard />
            </div>
          </div>
          <div className={s.featureRail}>
            {(
              [
                "Files",
                "Notes",
                "Tasks",
                "Calendar",
                "References",
                "Experiments",
                "Dashboards",
                "Collaboration",
              ] as Kind[]
            ).map((name) => {
              const Icon = icons[name];
              return (
                <a key={name} href="#workspace">
                  <Icon size={20} />
                  <span>{name}</span>
                </a>
              );
            })}
          </div>
        </section>

        <section id="workspace" className={`${s.section} ${s.architecture}`} data-scene>
          <SceneBackdrop name="alpine-city" />
          <div className={s.sectionHeading}>
            <Eyebrow>ONE WORKSPACE. EVERY CAPABILITY.</Eyebrow>
            <h2>
              A recursive workspace
              <br />
              for how <em>knowledge</em> works.
            </h2>
            <p>
              Write, think, plan and explore around one connected project.
              <br />A product vision with shared context at its foundation.
            </p>
          </div>
          <div ref={architecture} className={s.ecosystem}>
            <ConnectorLayer stage={architecture} />
            <div className={s.satelliteLeft}>
              {capabilities.slice(0, 3).map((kind) => (
                <div data-connect key={kind}>
                  <GlassPanel
                    kind={kind}
                    title={
                      kind === "Document"
                        ? "Rich Documents"
                        : kind === "Notes"
                          ? "Infinite Notes"
                          : kind
                    }
                  >
                    <DemoPanel kind={kind} />
                  </GlassPanel>
                </div>
              ))}
            </div>
            <div className={s.centralApp} data-center>
              <MiniAppWindow />
              <div className={s.foundation}>
                <span>One Identity</span>
                <div>
                  <span>One Permissions Layer</span>
                  <Mark />
                  <span>One Relationship Graph</span>
                </div>
                <p>Shared foundations · architecture concept</p>
              </div>
            </div>
            <div className={s.satelliteRight}>
              {capabilities.slice(3).map((kind) => (
                <div data-connect key={kind}>
                  <GlassPanel kind={kind} title={kind}>
                    <DemoPanel kind={kind} />
                  </GlassPanel>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className={`${s.section} ${s.workflow}`} data-scene>
          <SceneBackdrop name="hero" />
          <div className={s.sectionHeading}>
            <Eyebrow>A COMPLETE RESEARCH AND WORKFLOW</Eyebrow>
            <h2>
              From idea to <em>impact.</em>
            </h2>
            <p>
              A continuous thread through your work.
              <br />
              Nine stages. One context that travels with you.
            </p>
          </div>
          <div className={s.workflowBlock}>
            <div className={s.workflowControls}>
              <p>
                Follow the process <span>{String(step + 1).padStart(2, "0")} / 09</span>
              </p>
              <div>
                <button
                  type="button"
                  className={s.workflowPlay}
                  aria-pressed={!workflowPlaying}
                  onClick={() => setWorkflowPlaying(!workflowPlaying)}
                >
                  {workflowPlaying ? "Pause autoplay" : "Play carousel"}
                </button>
                <button
                  type="button"
                  onClick={() => goStep(step - 1)}
                  disabled={step === 0}
                  aria-label="Previous workflow stage"
                >
                  <ArrowLeft />
                </button>
                <button
                  type="button"
                  onClick={() => goStep(step + 1)}
                  disabled={step === 8}
                  aria-label="Next workflow stage"
                >
                  <ArrowRight />
                </button>
              </div>
            </div>
            <section
              ref={rail}
              className={s.workflowRail}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setWorkflowHovered(true);
              }}
              onPointerLeave={() => setWorkflowHovered(false)}
              onPointerDown={() => setWorkflowPlaying(false)}
              onWheel={() => setWorkflowPlaying(false)}
              onFocusCapture={() => setWorkflowFocused(true)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setWorkflowFocused(false);
              }}
              onScroll={() => {
                const element = rail.current;
                if (!element) return;
                const children = [...element.children] as HTMLElement[];
                const index = children.reduce(
                  (best, child, i) =>
                    Math.abs(child.offsetLeft - element.offsetLeft - element.scrollLeft) <
                    Math.abs(
                      (children[best]?.offsetLeft ?? 0) - element.offsetLeft - element.scrollLeft,
                    )
                      ? i
                      : best,
                  0,
                );
                setStep(
                  element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 ? 8 : index,
                );
              }}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable timeline needs focus for arrow-key navigation.
              tabIndex={0}
              aria-label="Nine-stage workflow. Use arrow keys to explore."
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  goStep(step + (e.key === "ArrowRight" ? 1 : -1));
                }
              }}
            >
              {stages.map((stage, index) => {
                const Icon = icons[stage.kind];
                return (
                  <article className={s.workflowStep} key={stage.name} data-active={step === index}>
                    <button
                      className={s.stageIcon}
                      type="button"
                      onClick={() => goStep(index)}
                      aria-label={`Explore ${stage.name}`}
                      aria-current={step === index ? "step" : undefined}
                    >
                      <Icon size={23} />
                    </button>
                    <h3>{stage.name}</h3>
                    <p>{stage.text}</p>
                    <div className={s.workflowMini}>
                      <WorkflowPanel index={index} />
                    </div>
                  </article>
                );
              })}
            </section>
            <p className={s.workflowHint}>
              Swipe or use the arrows to explore · Pauses while you interact
            </p>
          </div>
          <div className={s.contextBanner}>
            <Mark />
            <div>
              <h3>Your context, preserved at every step.</h3>
              <p>
                The vision: notes, files, discussions and decisions remain linked throughout the
                lifecycle.
              </p>
            </div>
            <div className={s.contextTags}>
              {["Connected", "Versioned", "Searchable", "In context"].map((x) => (
                <span key={x}>
                  <Check size={13} />
                  {x}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="people" className={`${s.section} ${s.people}`} data-scene>
          <SceneBackdrop name="alpine-city" />
          <div className={s.sectionHeading}>
            <Eyebrow>FOR EVERY KNOWLEDGE WORKER</Eyebrow>
            <h2>
              Serving every kind of
              <br />
              <em>knowledge</em> worker.
            </h2>
            <p>
              Different questions. Different ways of working.
              <br />A shared need to see the bigger picture.
            </p>
          </div>
          <div className={s.personaGrid}>
            {roles.map((role, index) => {
              const Icon = [BookOpen, Flask, Users, Flask, FileText, ChartLineUp][index] ?? Users;
              return (
                <article className={s.personaCard} key={role.name}>
                  <Image
                    src={`/home/cinematic/${role.image}.webp`}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 90vw, (max-width: 1023px) 45vw, 30vw"
                  />
                  <div className={s.personaShade} />
                  <div className={s.personaHeader}>
                    <Icon size={25} />
                    <div>
                      <h3>{role.name}</h3>
                      <strong>{role.subtitle}</strong>
                    </div>
                    <button
                      type="button"
                      aria-label={`Explore Nexosophy for ${role.name}`}
                      onClick={() => {
                        setPersona(index);
                        dialog.current?.showModal();
                      }}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                  <p className={s.personaCopy}>{role.copy}</p>
                  <div className={s.personaOverlay}>
                    <GlassPanel title={role.title} kind={role.kind}>
                      <PersonaPreview index={index} />
                    </GlassPanel>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="trust" className={`${s.section} ${s.trust}`} data-scene>
          <SceneBackdrop name="research-team" />
          <div className={s.trustGrid}>
            <div className={s.trustCopy}>
              <Eyebrow>BUILT FOR SERIOUS WORK</Eyebrow>
              <h2>
                Trusted workspaces
                <br />
                for <em>real impact.</em>
              </h2>
              <p>
                Good collaboration needs clear context, understandable access and a record of how
                the work evolved.
              </p>
              <ul>
                {[
                  ["Access with intention", "Explore explicit roles and permissions."],
                  ["Built for collaboration", "Keep discussion beside the work."],
                  ["A traceable history", "See how a shared idea develops."],
                  ["A clear foundation", "Separate the product vision from verified capabilities."],
                ].map(([title, text], i) => {
                  const Icon = [LockKey, Users, FileText, ShieldCheck][i] ?? ShieldCheck;
                  return (
                    <li key={title}>
                      <Icon size={24} />
                      <span>
                        <strong>{title}</strong>
                        {text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className={s.trustProduct}>
              <div className={s.trustTop}>
                <GlassPanel title="Secure sharing & permissions" kind="Collaboration" badge="Demo">
                  <Permissions />
                </GlassPanel>
                <GlassPanel title="Version history" kind="Timeline">
                  <Versions />
                </GlassPanel>
              </div>
              <MiniAppWindow label="Climate Research" />
              <div className={s.trustBottom}>
                <GlassPanel title="Activity log" kind="Timeline">
                  <div className={s.chips}>
                    {["All", "Edits", "Comments"].map((x) => (
                      <button
                        type="button"
                        key={x}
                        aria-pressed={activity === x}
                        onClick={() => setActivity(x)}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                  {[
                    ["Comments", "Maya commented on the introduction"],
                    ["Edits", "Daniel refined the analysis"],
                    ["Edits", "Priya attached a dataset"],
                  ]
                    .filter(([type]) => activity === "All" || type === activity)
                    .map(([, text]) => (
                      <p className={s.activityLine} key={text}>
                        {text}
                        <small>Sample activity</small>
                      </p>
                    ))}
                </GlassPanel>
                <GlassPanel title="Comments & mentions" kind="Collaboration">
                  <Comments />
                </GlassPanel>
              </div>
            </div>
          </div>
          <div className={s.finalBanner}>
            <Users size={30} />
            <div>
              <h3>Make room for what you could discover.</h3>
              <p>For researchers, educators and teams. Start with a question of your own.</p>
            </div>
            <Link href="/sign-up" className={s.primary}>
              Get started <ArrowRight size={16} />
            </Link>
            <button type="button" className={s.secondary} onClick={showTour}>
              <Play size={16} /> Explore the vision
            </button>
          </div>
          <p className={s.disclosure}>
            Interactive illustrations show the Nexosophy product vision, including planned
            capabilities. Sample people, records and activity are not live data. No certifications,
            uptime or encryption guarantees are claimed here.
          </p>
        </section>
      </main>
      <footer className={s.footer}>
        <Link href="/" className={s.brand}>
          <Mark />
          Nexosophy
        </Link>
        <span>Knowledge, with its connections intact.</span>
        <a href="#main-content">
          Back to the beginning <ArrowUpRight size={15} />
        </a>
      </footer>
      <dialog ref={dialog} className={s.dialog} aria-labelledby="preview-dialog-title">
        <form method="dialog">
          <button type="submit" aria-label="Close preview">
            <X size={22} />
          </button>
        </form>
        {persona !== null ? (
          <>
            <Eyebrow>YOUR WORK, CONNECTED</Eyebrow>
            <h2 id="preview-dialog-title">For {roles[persona]?.name.toLowerCase()}.</h2>
            <p>{roles[persona]?.detail}</p>
            <Link href="/sign-up" className={s.primary}>
              Explore Nexosophy <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <Eyebrow>A GUIDED PRODUCT VISION</Eyebrow>
            <h2 id="preview-dialog-title">
              {
                [
                  "Bring the pieces together.",
                  "Keep the connections.",
                  "Give your work a direction.",
                ][tour]
              }
            </h2>
            <p>
              {
                [
                  "Start with research notes, documents and source records. The homepage examples demonstrate the shape of a connected workspace.",
                  "Switch between document, graph and task views. Try the source search, role selectors and conversations—all local to this demonstration.",
                  "The nine-stage journey describes where Nexosophy is heading. It is not a claim that every publishing, AI or laboratory feature has shipped.",
                ][tour]
              }
            </p>
            <div className={s.tourNav}>
              <button
                type="button"
                className={s.secondary}
                disabled={tour === 0}
                onClick={() => setTour(tour - 1)}
              >
                Previous
              </button>
              <span>{tour + 1} / 3</span>
              {tour < 2 ? (
                <button type="button" className={s.primary} onClick={() => setTour(tour + 1)}>
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" className={s.primary} onClick={() => dialog.current?.close()}>
                  Explore the page
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
