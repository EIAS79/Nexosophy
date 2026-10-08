"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import s from "./connected-home.module.css";

const chapters = [
  {
    name: "Discover",
    label: "THE ATLAS OF YOUR IDEAS",
    title: "Think beyond",
    accent: "the page.",
    body: "A note becomes a question. A source sparks a connection. Give your thinking somewhere to go.",
  },
  {
    name: "Gather",
    label: "01 / BRING YOUR WORLD TOGETHER",
    title: "Collect the sparks.",
    accent: "Keep the context.",
    body: "A paper that sparked a question. A note you almost forgot. Make room for the whole story, with the pieces that matter within reach.",
  },
  {
    name: "Connect",
    label: "02 / FIND THE THREAD",
    title: "Find the unlikely",
    accent: "connection.",
    body: "Follow an idea back to its source, forward to a question, or across to a related note. Context stays close to your thinking.",
  },
  {
    name: "Develop",
    label: "03 / GIVE YOUR THINKING SHAPE",
    title: "Make room",
    accent: "for what’s next.",
    body: "Bring your writing and next actions together. Keep the evidence beside the work, from an early question to a considered draft.",
  },
  {
    name: "Together",
    label: "04 / MAKE SPACE FOR OTHER MINDS",
    title: "Open your world",
    accent: "to other minds.",
    body: "The vision: feedback, decisions and sources in the same place. A clearer path from working alone to thinking together.",
  },
  {
    name: "Begin",
    label: "YOUR NEXT CONNECTION STARTS HERE",
    title: "Your next idea",
    accent: "starts here.",
    body: "For the things you’re learning, the questions you’re asking, and the work you haven’t imagined yet.",
  },
];

const journeys = {
  Research: {
    project: "The living city",
    note: "A cooler, greener city",
    question: "What changes when we bring nature back into the city?",
    task: "Compare the field notes with the literature",
    files: ["Urban ecology review", "Field observations", "Research questions"],
  },
  Study: {
    project: "Beyond the lecture",
    note: "Understanding ecosystems",
    question: "How do the ideas from this week fit together?",
    task: "Turn the lecture notes into a revision outline",
    files: ["Ecology lecture notes", "Course reading", "Revision questions"],
  },
  Laboratory: {
    project: "From question to result",
    note: "A question worth testing",
    question: "Which observations should guide the next experiment?",
    task: "Review observations before the next experiment",
    files: ["Protocol notes", "Experiment observations", "Next experiment"],
  },
  Reporting: {
    project: "Behind the story",
    note: "The story taking shape",
    question: "What do we know, and what still needs verification?",
    task: "Verify the open question against source notes",
    files: ["Source notes", "Interview observations", "Questions to verify"],
  },
};

type Journey = keyof typeof journeys;
const views = ["Document", "Connections", "Next steps"] as const;
type View = (typeof views)[number];

export function ConnectedHome() {
  const root = useRef<HTMLDivElement>(null);
  const runway = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [chapter, setChapter] = useState(0);
  const [enhanced, setEnhanced] = useState(false);
  const [journey, setJourney] = useState<Journey>("Research");
  const [view, setView] = useState<View>("Document");
  const [source, setSource] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [context, setContext] = useState(false);
  const [menu, setMenu] = useState(false);
  const project = journeys[journey];

  useEffect(() => {
    const element = root.current;
    const track = runway.current;
    if (!element || !track) return;
    const fallback = window.matchMedia(
      "(prefers-reduced-motion: reduce), (max-width: 760px), (max-height: 800px)",
    );
    let frame = 0;
    let start = 0;
    let distance = 1;
    let current = -1;
    const paint = () => {
      frame = 0;
      if (fallback.matches) return;
      const progress = Math.max(0, Math.min(1, (window.scrollY - start) / distance));
      const position = progress * (chapters.length - 1);
      element.style.setProperty("--progress", String(progress));
      for (let index = 0; index < chapters.length; index++) {
        const delta = position - index;
        const opacity = Math.max(0, 1 - Math.max(0, Math.abs(delta) - 0.12) / 0.38);
        element.style.setProperty(`--copy-${index}`, String(opacity));
        element.style.setProperty(
          `--shift-${index}`,
          `${Math.max(-24, Math.min(24, -delta * 32))}px`,
        );
      }
      const next = Math.round(position);
      if (next !== current) {
        current = next;
        setChapter(next);
      }
    };
    const requestPaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    const measure = () => {
      element.dataset.motion = fallback.matches ? "reduced" : "full";
      setEnhanced(!fallback.matches);
      start = track.getBoundingClientRect().top + window.scrollY;
      distance = Math.max(1, track.offsetHeight - window.innerHeight);
      requestPaint();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", measure);
    fallback.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestPaint);
      window.removeEventListener("resize", measure);
      fallback.removeEventListener("change", measure);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setView(chapter === 2 ? "Connections" : chapter === 3 ? "Next steps" : "Document");
    setContext(false);
  }, [chapter]);

  const goTo = (index: number) => {
    setMenu(false);
    if (!enhanced || !runway.current) {
      document.getElementById(`chapter-${index}`)?.scrollIntoView({ behavior: "instant" });
      return;
    }
    const track = runway.current;
    window.scrollTo({
      top:
        track.getBoundingClientRect().top +
        window.scrollY +
        ((track.offsetHeight - window.innerHeight) * index) / (chapters.length - 1),
      behavior: "smooth",
    });
  };

  return (
    <div ref={root} className={s.home} data-motion="full">
      <noscript>
        <style>{`.${s.runway}{height:auto}.${s.scene}{position:relative;height:auto;min-height:0;padding-top:120px}.${s.copyStack}{display:block}.${s.copy}{opacity:1;transform:none;position:relative;margin-bottom:64px}.${s.chapterNav}{display:none}`}</style>
      </noscript>
      <a className={s.skip} href="#chapter-0">
        Skip to content
      </a>
      <header className={s.header}>
        <Link href="/" className={s.brand} aria-label="Nexosophy home">
          <span className={s.mark} aria-hidden="true">
            n.
          </span>{" "}
          nexosophy
        </Link>
        <button
          type="button"
          className={s.menuButton}
          aria-expanded={menu}
          aria-controls="home-navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? "Close" : "Menu"}
        </button>
        <nav id="home-navigation" className={s.headerNav} data-open={menu} aria-label="Main">
          <button type="button" onClick={() => goTo(1)}>
            The workspace
          </button>
          <button type="button" onClick={() => goTo(4)}>
            Who it’s for
          </button>
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              document.getElementById("questions")?.scrollIntoView();
            }}
          >
            Questions
          </button>
          <Link href="/sign-in">Sign in</Link>
          <Link className={s.headerCta} href="/sign-up">
            Open your workspace ↗
          </Link>
        </nav>
      </header>

      <main>
        <div ref={runway} className={s.runway}>
          <div className={s.scene}>
            <div className={s.copyStack}>
              {chapters.map((item, index) => (
                <section
                  key={item.name}
                  id={`chapter-${index}`}
                  className={s.copy}
                  data-index={index}
                  inert={enhanced && chapter !== index}
                  aria-hidden={enhanced && chapter !== index ? true : undefined}
                >
                  <p className={s.eyebrow}>{item.label}</p>
                  {index === 0 ? (
                    <h1>
                      {item.title}
                      <em>{item.accent}</em>
                    </h1>
                  ) : (
                    <h2>
                      {item.title}
                      <em>{item.accent}</em>
                    </h2>
                  )}
                  <p className={s.description}>{item.body}</p>
                  {index === 5 ? (
                    <Link className={s.primary} href="/sign-up">
                      Start with an idea <span>↗</span>
                    </Link>
                  ) : (
                    <button className={s.primary} type="button" onClick={() => goTo(index + 1)}>
                      {index === 0 ? "Explore the workspace" : "Follow the thread"} <span>↓</span>
                    </button>
                  )}
                  <p className={s.note}>
                    {index === 0
                      ? "LESS FRICTION. MORE POSSIBILITY."
                      : `0${index} / One idea, more possibilities.`}
                  </p>
                </section>
              ))}
            </div>

            <div className={s.atlas}>
              <div className={s.orbits} aria-hidden="true">
                <span /><span /><span />
              </div>
              <span className={s.atlasNumber} aria-hidden="true">0{chapter + 1}</span>
              <button
                className={s.floatingSource}
                type="button"
                onClick={() => { setSource(0); setView("Connections"); }}
              >
                <span className={s.cardIcon}>↗</span>
                <small>01 / A STARTING POINT</small>
                <strong>{project.files[0]}</strong>
                <span>Follow the connection ↗</span>
              </button>
              <button
                className={s.floatingQuestion}
                type="button"
                onClick={() => { setSource(2); setContext(true); }}
              >
                <small>WHAT IF?</small>
                <strong>{project.question}</strong>
                <span>Leave room for discovery ↗</span>
              </button>
              <div className={s.preview}>
              <div className={s.previewLabel}>
                <span>
                  <i /> FIELD NOTES / INTERACTIVE EDITION
                </span>
                <button type="button" onClick={() => dialog.current?.showModal()}>
                  About this preview ↗
                </button>
              </div>
              <div className={s.workspace}>
                <div className={s.windowBar}>
                  <span className={s.windowMark}>n.</span>
                  <span>{project.project}</span>
                  <span className={s.previewBadge}>Interactive concept</span>
                  <button
                    type="button"
                    onClick={() => setContext(!context)}
                    aria-expanded={context}
                    aria-controls="source-context"
                  >
                    Context +
                  </button>
                </div>
                <div className={s.workspaceBody}>
                  <aside className={s.sidebar} aria-label="Example sources">
                    <p>YOUR SPACE</p>
                    <strong>{journey}</strong>
                    <p className={s.sourceLabel}>
                      SOURCES <span>03</span>
                    </p>
                    {project.files.map((file, index) => (
                      <button
                        key={file}
                        type="button"
                        aria-pressed={source === index}
                        onClick={() => {
                          setSource(index);
                          setView("Document");
                        }}
                      >
                        <span aria-hidden="true">
                          {index === 0 ? "▤" : index === 1 ? "◌" : "↗"}
                        </span>
                        {file}
                      </button>
                    ))}
                    <div className={s.sidebarNote}>
                      Room for the
                      <br />
                      bigger picture.
                    </div>
                  </aside>
                  <div className={s.editor}>
                    <div className={s.tabs} role="tablist" aria-label="Workspace view">
                      {views.map((tab, index) => (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          id={`workspace-tab-${index}`}
                          aria-selected={view === tab}
                          aria-controls="workspace-view"
                          tabIndex={view === tab ? 0 : -1}
                          onClick={() => setView(tab)}
                          onKeyDown={(event) => {
                            let target = index;
                            if (event.key === "ArrowRight") target = (index + 1) % views.length;
                            else if (event.key === "ArrowLeft")
                              target = (index + views.length - 1) % views.length;
                            else if (event.key === "Home") target = 0;
                            else if (event.key === "End") target = views.length - 1;
                            else return;
                            event.preventDefault();
                            setView(views[target] ?? "Document");
                            document.getElementById(`workspace-tab-${target}`)?.focus();
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div
                      id="workspace-view"
                      role="tabpanel"
                      aria-labelledby={`workspace-tab-${views.indexOf(view)}`}
                      className={s.panel}
                    >
                      <div key={`${view}-${journey}-${source}`} className={s.panelContent}>
                        <p className={s.documentLabel}>
                          {view === "Document" ? "WORKING NOTE / 01" : "FOLLOW THE IDEA"}
                        </p>
                        <h3>
                          {view === "Document"
                            ? source === 0
                              ? project.note
                              : project.files[source]
                            : view === "Connections"
                              ? "Nothing in isolation."
                              : "A little further forward."}
                        </h3>
                        {view === "Document" && (
                          <>
                            <p className={s.question}>{project.question}</p>
                            <p>
                              Start with what you notice. Collect the evidence, leave space for
                              questions, and let the next connection emerge.
                            </p>
                            <button
                              className={s.excerpt}
                              type="button"
                              onClick={() => setContext(true)}
                            >
                              What if the most useful insight is the connection between things we
                              already know?
                              <span>Explore the source ↗</span>
                            </button>
                            <div className={s.related}>
                              <span>CONNECTED TO</span>
                              <button type="button" onClick={() => setView("Connections")}>
                                3 sources ↗
                              </button>
                              <button type="button" onClick={() => setView("Next steps")}>
                                1 next step ↗
                              </button>
                            </div>
                            {chapter === 4 && (
                              <p className={s.review}>
                                “Could we look at this from another perspective?”{" "}
                                <small>A glimpse of the collaboration vision.</small>
                              </p>
                            )}
                          </>
                        )}
                        {view === "Connections" && (
                          <>
                            <p>
                              Three starting points. A clearer picture. Open a source to follow the
                              thread.
                            </p>
                            <div className={s.connections}>
                              {project.files.map((file, index) => (
                                <button
                                  key={file}
                                  type="button"
                                  onClick={() => {
                                    setSource(index);
                                    setContext(true);
                                  }}
                                >
                                  <span className={s.connectionNumber}>0{index + 1}</span>
                                  <span>
                                    <small>
                                      {
                                        [
                                          "INFORMS THIS NOTE",
                                          "ADDS AN OBSERVATION",
                                          "OPENS A QUESTION",
                                        ][index]
                                      }
                                    </small>
                                    {file}
                                  </span>
                                  <span aria-hidden="true">↗</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                        {view === "Next steps" && (
                          <>
                            <p>Keep the next action close to the thinking that inspired it.</p>
                            <label className={s.task} data-completed={completed}>
                              <input
                                type="checkbox"
                                checked={completed}
                                onChange={(event) => setCompleted(event.target.checked)}
                              />
                              <span>{project.task}</span>
                            </label>
                            <p className={s.taskStatus} role="status">
                              {completed
                                ? "A little progress. A little more clarity. ✓"
                                : "One thoughtful next step is enough to start."}
                            </p>
                            <button
                              className={s.backButton}
                              type="button"
                              onClick={() => setView("Document")}
                            >
                              ← Return to the working note
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {context && (
                  <aside id="source-context" className={s.context} aria-label="Source context">
                    <div>
                      <span>KEEP THE CONTEXT</span>
                      <button
                        type="button"
                        onClick={() => setContext(false)}
                        aria-label="Close source context"
                      >
                        ×
                      </button>
                    </div>
                    <p className={s.documentLabel}>SOURCE / 0{source + 1}</p>
                    <h3>{project.files[source]}</h3>
                    <p>
                      An idea becomes more useful when you can see where it came from, what it
                      supports, and which questions it opens.
                    </p>
                    <blockquote>Leave a trail your future self can follow.</blockquote>
                    <button
                      className={s.backButton}
                      type="button"
                      onClick={() => {
                        setContext(false);
                        setView("Connections");
                      }}
                    >
                      See all connections ↗
                    </button>
                  </aside>
                )}
                <div className={s.workspaceFooter}>
                  <span>YOUR THINKING, IN CONTEXT</span>
                  <span>Example workspace · changes stay in this preview</span>
                </div>
              </div>
              <nav className={s.journeys} aria-label="Try an example workspace">
                <span>MAKE IT YOURS</span>
                {(Object.keys(journeys) as Journey[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={journey === item}
                    onClick={() => {
                      setJourney(item);
                      setSource(0);
                      setCompleted(false);
                      setContext(false);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </div>

            </div>

            <nav className={s.chapterNav} aria-label="The Nexosophy story">
              <div className={s.progress} />
              <span className={s.scrollHint}>SCROLL TO EXPLORE ↓</span>
              <div>
                {chapters.map((item, index) => (
                  <button
                    key={item.name}
                    type="button"
                    aria-current={chapter === index ? "step" : undefined}
                    onClick={() => goTo(index)}
                  >
                    <span>0{index + 1}</span>
                    {item.name}
                  </button>
                ))}
              </div>
              <span className={s.counter}>0{chapter + 1} / 06</span>
            </nav>
          </div>
        </div>

        <section id="questions" className={s.questions}>
          <div>
            <p className={s.eyebrow}>A FEW THINGS TO KNOW</p>
            <h2>
              Curiosity,
              <br />
              <em>welcomed.</em>
            </h2>
            <p>Good questions are always a good place to start.</p>
          </div>
          <div className={s.answers}>
            {[
              [
                "What is Nexosophy?",
                "Nexosophy is a developing workspace for connected thinking: bringing notes, sources and work into a shared context. This homepage explores that direction.",
              ],
              [
                "Is everything in this preview available?",
                "No. The interactive workspace is an illustrative concept. Connections, next steps and collaboration shown here represent the product vision, not a promise that every capability has shipped.",
              ],
              [
                "Who is it for?",
                "Students, researchers, laboratory teams, reporters, and anyone turning scattered information into considered work. Try the example workspaces above to explore different starting points.",
              ],
              [
                "Do I need AI to use it?",
                "The core idea is your thinking, with its context intact. AI assistance is an optional part of the product vision, not a requirement for making meaningful connections.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className={s.footer}>
        <Link className={s.brand} href="/">
          <span className={s.mark} aria-hidden="true">
            n.
          </span>{" "}
          nexosophy
        </Link>
        <p>A place for your thinking to become something.</p>
        <button type="button" onClick={() => goTo(0)}>
          Back to the beginning ↑
        </button>
      </footer>
      <dialog ref={dialog} className={s.dialog} aria-labelledby="preview-title">
        <form method="dialog">
          <button type="submit" aria-label="Close preview information">
            ×
          </button>
        </form>
        <p className={s.eyebrow}>AN INTERACTIVE CONCEPT</p>
        <h2 id="preview-title">A glimpse of what’s possible.</h2>
        <p>
          Explore sources, switch perspectives and check off a next step. These examples demonstrate
          the direction of Nexosophy; they don’t represent a complete list of available features.
        </p>
        <p>Your interactions here stay in this preview and aren’t saved to an account.</p>
      </dialog>
    </div>
  );
}
