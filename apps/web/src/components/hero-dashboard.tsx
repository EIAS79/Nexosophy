"use client";

import { useMemo, useState } from "react";

import styles from "./hero-dashboard.module.css";

type View = "brief" | "connections" | "tasks";

const notes = [
  "Research questions for next phase",
  "Ideas on evaluation framework",
  "Potential collaboration with MIT",
] as const;

const references = [
  ["Bender et al. (2023)", "On the Dangers of Stochastic Parrots"],
  ["Nature (2024)", "AI in Science: Opportunities and Limits"],
  ["Azoulay, P. (2022)", "The Labor of AI in Research"],
] as const;

const tasks = [
  "Summarize key findings from 5 papers",
  "Compare methodologies",
  "Draft discussion section",
] as const;

export function HeroDashboard() {
  const [view, setView] = useState<View>("brief");
  const [activeReference, setActiveReference] = useState(0);
  const [doneTasks, setDoneTasks] = useState<number[]>([0]);
  const [insightOpen, setInsightOpen] = useState(false);

  const progress = useMemo(() => Math.round((doneTasks.length / tasks.length) * 100), [doneTasks]);

  function toggleTask(index: number) {
    setDoneTasks((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  return (
    <div className={styles.orbitStage}>
      <svg
        className={styles.orbitLines}
        viewBox="0 0 920 650"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M205 178 C330 102 510 92 652 145" />
        <path d="M675 145 C760 194 797 266 785 340" />
        <path d="M792 355 C770 474 659 540 542 545" />
        <path d="M530 548 C406 558 281 510 225 423" />
      </svg>

      <article className={styles.notesCard}>
        <div className={styles.cardEyebrow}>
          <span className={styles.cardIcon}>▤</span>
          <strong>Notes</strong>
          <button type="button" aria-label="Add note">
            ＋
          </button>
        </div>
        <div className={styles.notesList}>
          {notes.map((note, index) => (
            <button key={note} type="button" onClick={() => setView("brief")}>
              <span>{index + 1}</span>
              <span>{note}</span>
              <small>{index === 0 ? "Today" : index === 1 ? "Yesterday" : "Oct 14"}</small>
            </button>
          ))}
        </div>
      </article>

      <article className={styles.insightCard} data-open={insightOpen}>
        <div className={styles.cardEyebrow}>
          <span className={styles.insightOrb}>✦</span>
          <strong>AI Insight</strong>
          <span className={styles.beta}>Beta</span>
        </div>
        <p className={styles.insightTitle}>Emerging connection detected</p>
        <p className={styles.insightCopy}>
          Your notes on human–AI collaboration connect strongly with recent work on cognitive
          augmentation.
        </p>
        <button
          type="button"
          className={styles.insightButton}
          onClick={() => {
            setInsightOpen((value) => !value);
            setView("connections");
          }}
        >
          {insightOpen ? "Connection opened" : "Explore connection"} <span>→</span>
        </button>
      </article>

      <article className={styles.graphCard}>
        <div className={styles.cardEyebrow}>
          <span className={styles.cardIcon}>⌘</span>
          <strong>Knowledge Graph</strong>
          <span className={styles.cardAction}>↗</span>
        </div>
        <div className={styles.graphVisual}>
          <svg viewBox="0 0 300 170" role="img" aria-label="Connected research knowledge graph">
            <title>Connected research knowledge graph</title>
            <path d="M150 82 72 48M150 82 224 42M150 82 248 108M150 82 89 130M150 82 146 22" />
            <circle cx="150" cy="82" r="21" />
            <circle cx="72" cy="48" r="7" />
            <circle cx="224" cy="42" r="7" />
            <circle cx="248" cy="108" r="7" />
            <circle cx="89" cy="130" r="7" />
            <circle cx="146" cy="22" r="7" />
          </svg>
          <button
            type="button"
            className={styles.graphCenter}
            onClick={() => setView("connections")}
          >
            Human–AI
            <span>Collaboration</span>
          </button>
          <span className={styles.graphLabelResearch}>Research</span>
          <span className={styles.graphLabelCreativity}>Creativity</span>
          <span className={styles.graphLabelEducation}>Education</span>
          <span className={styles.graphLabelMethods}>Methods</span>
        </div>
      </article>

      <section className={styles.workspace} aria-label="Interactive Nexosophy product preview">
        <header className={styles.workspaceHeader}>
          <a className={styles.workspaceBrand} href="/" aria-label="Nexosophy home">
            <span>N</span>
            <strong>Nexosophy</strong>
          </a>

          <label className={styles.workspaceSearch}>
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search workspace" placeholder="Search your knowledge..." />
            <kbd>⌘ K</kbd>
          </label>

          <div className={styles.workspaceAvatars} aria-hidden="true">
            <span>M</span>
            <span>D</span>
            <span>+3</span>
          </div>
        </header>

        <div className={styles.workspaceBody}>
          <aside className={styles.sidebar}>
            <nav aria-label="Workspace navigation">
              <button type="button">
                <span>⌂</span>Home
              </button>
              <button type="button">
                <span>▣</span>Inbox <b>3</b>
              </button>
            </nav>
            <p>Workspaces</p>
            <button type="button" className={styles.workspaceActive}>
              <span>▤</span>Literature Review
            </button>
            <button type="button">
              <span>◫</span>Experiments
            </button>
            <button type="button">
              <span>⌁</span>Analysis
            </button>
            <button type="button">
              <span>✎</span>Papers & Writing
            </button>
            <div className={styles.sidebarRule} />
            <button type="button">
              <span>☆</span>Starred
            </button>
            <button type="button">
              <span>◷</span>Recent
            </button>
          </aside>

          <main className={styles.canvas}>
            <div className={styles.canvasTop}>
              <div>
                <small>Literature Review</small>
                <span>/</span>
                <strong>
                  {view === "brief" ? "Document" : view === "connections" ? "Connections" : "Tasks"}
                </strong>
              </div>
              <nav aria-label="Preview views">
                <button
                  type="button"
                  data-active={view === "brief"}
                  onClick={() => setView("brief")}
                >
                  Document
                </button>
                <button
                  type="button"
                  data-active={view === "connections"}
                  onClick={() => setView("connections")}
                >
                  Connections
                </button>
                <button
                  type="button"
                  data-active={view === "tasks"}
                  onClick={() => setView("tasks")}
                >
                  Tasks
                </button>
              </nav>
            </div>

            {view === "brief" ? (
              <article className={styles.documentView}>
                <div className={styles.documentMeta}>
                  <span>Article</span>
                  <span>● In progress</span>
                  <small>Edited 2h ago</small>
                </div>
                <h3>The future of human–AI collaboration in science</h3>
                <p>
                  Human–AI collaboration is reshaping how we discover, learn and create. This review
                  explores current progress, key challenges and emerging opportunities across
                  research.
                </p>
                <blockquote>
                  AI amplifies human intellect not by replacing it, but by expanding the space of
                  what we can explore together.
                </blockquote>
                <h4>1. Introduction</h4>
                <p className={styles.documentBody}>
                  The integration of artificial intelligence into the research process is creating
                  new possibilities for human creativity, productivity, and discovery.
                </p>
              </article>
            ) : null}

            {view === "connections" ? (
              <div className={styles.connectionView}>
                <div className={styles.connectionCore}>
                  <strong>
                    Human–AI
                    <br />
                    Collaboration
                  </strong>
                  <span>12 sources</span>
                </div>
                {["Methods", "Cognition", "Creativity", "Education", "Ethics", "Datasets"].map(
                  (label, index) => (
                    <button key={label} type="button" data-index={index}>
                      <span>{label}</span>
                      <small>{index % 2 === 0 ? "Strong link" : "Related"}</small>
                    </button>
                  ),
                )}
              </div>
            ) : null}

            {view === "tasks" ? (
              <div className={styles.taskView}>
                <div className={styles.taskProgress}>
                  <div>
                    <span>Research plan</span>
                    <strong>
                      {doneTasks.length}/{tasks.length} complete
                    </strong>
                  </div>
                  <b>{progress}%</b>
                </div>
                <div className={styles.progressTrack}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                {tasks.map((task, index) => (
                  <label key={task} className={styles.taskRow}>
                    <input
                      type="checkbox"
                      checked={doneTasks.includes(index)}
                      onChange={() => toggleTask(index)}
                    />
                    <span>{task}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </main>
        </div>
      </section>

      <article className={styles.referenceCard}>
        <div className={styles.cardEyebrow}>
          <span className={styles.cardIcon}>▤</span>
          <strong>References</strong>
          <span className={styles.countBadge}>12</span>
        </div>
        <div className={styles.referenceList}>
          {references.map(([author, title], index) => (
            <button
              key={author}
              type="button"
              data-active={activeReference === index}
              onClick={() => {
                setActiveReference(index);
                setView("brief");
              }}
            >
              <span className={styles.referenceIndex}>{index + 1}</span>
              <span>
                <strong>{author}</strong>
                <small>{title}</small>
              </span>
            </button>
          ))}
        </div>
      </article>

      <article className={styles.relatedBar}>
        <div className={styles.relatedTitle}>
          <span>⌘</span>
          <strong>Related content</strong>
        </div>
        <div className={styles.relatedItems}>
          <button type="button" onClick={() => setView("brief")}>
            <span>▤</span>
            <strong>Similar papers</strong>
            <small>12 results</small>
          </button>
          <button type="button" onClick={() => setView("brief")}>
            <span>◫</span>
            <strong>Related notes</strong>
            <small>8 notes</small>
          </button>
          <button type="button" onClick={() => setView("connections")}>
            <span>◉</span>
            <strong>Related people</strong>
            <small>4 researchers</small>
          </button>
          <button type="button" onClick={() => setView("connections")}>
            <span>⌁</span>
            <strong>Related topics</strong>
            <small>6 topics</small>
          </button>
        </div>
      </article>
    </div>
  );
}