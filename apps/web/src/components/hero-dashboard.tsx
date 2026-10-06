"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";

import styles from "./hero-dashboard.module.css";

type DashboardTab = "document" | "graph" | "tasks" | "references";

type Task = {
  id: number;
  label: string;
  done: boolean;
};

const workspaces = ["Literature Review", "Experiments", "Analysis", "Papers & Writing"] as const;

const references = [
  ["Bender, E. M. (2023)", "On the Dangers of Stochastic Parrots"],
  ["Nature (2024)", "AI in Science: Opportunities and Limits"],
  ["Azoulay, P. (2022)", "The Labor of AI in Research"],
] as const;

const initialTasks: Task[] = [
  { id: 1, label: "Summarize key findings from 5 papers", done: true },
  { id: 2, label: "Compare methodologies", done: false },
  { id: 3, label: "Draft discussion section", done: false },
  { id: 4, label: "Get feedback from advisor", done: false },
];

export function HeroDashboard() {
  const [activeWorkspace, setActiveWorkspace] = useState<(typeof workspaces)[number]>("Literature Review");
  const [tab, setTab] = useState<DashboardTab>("document");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [query, setQuery] = useState("");
  const [assistantReply, setAssistantReply] = useState("Ask anything about your research.");
  const [shared, setShared] = useState(false);

  const completedTasks = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }

  function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      setAssistantReply("Try asking for a summary, a connection, or your next step.");
      return;
    }

    const lower = cleanQuery.toLowerCase();

    if (lower.includes("summar")) {
      setAssistantReply("Across 12 sources, the strongest theme is that AI expands scientific throughput when human judgment stays in the loop.");
    } else if (lower.includes("connect") || lower.includes("related")) {
      setAssistantReply("I found 4 strong links between your literature notes, experiment results, and the collaboration paper.");
    } else if (lower.includes("next") || lower.includes("plan")) {
      setAssistantReply("Next: compare the two dominant methodologies, resolve one citation gap, then draft the discussion section.");
    } else {
      setAssistantReply("I found relevant context across your papers, notes, tasks, and experiment data. Open a source or ask me to synthesize it.");
    }

    setQuery("");
  }

  function runSuggestion(message: string) {
    setQuery("");
    setAssistantReply(message);
  }

  return (
    <div className={styles.stage}>
      <div className={styles.todayCard}>
        <div className={styles.smallCardTitle}>
          <div>
            <strong>Today</strong>
            <span>Wed, Oct 16</span>
          </div>
          <span className={styles.iconBadge}>◷</span>
        </div>
        <ul>
          <li><span className={styles.doneDot}>✓</span><span>Write literature review</span><time>9:00</time></li>
          <li><span className={styles.openDot}>○</span><span>Prepare lab slides</span><time>11:00</time></li>
          <li><span className={styles.openDot}>○</span><span>Review experiment results</span><time>4:00</time></li>
        </ul>
      </div>

      <div className={styles.graphCard}>
        <div className={styles.graphTabs}>
          <strong>Graph</strong>
          <span>Table</span>
          <span>Map</span>
        </div>
        <div className={styles.graphCanvas} aria-hidden="true">
          <svg viewBox="0 0 280 120">
            <title>Research relationship graph</title>
            <path d="M140 60 68 30M140 60 212 26M140 60 232 82M140 60 82 94M140 60 145 14" />
            <circle cx="140" cy="60" r="18" />
            <circle cx="68" cy="30" r="7" />
            <circle cx="212" cy="26" r="7" />
            <circle cx="232" cy="82" r="7" />
            <circle cx="82" cy="94" r="7" />
            <circle cx="145" cy="14" r="7" />
          </svg>
          <span className={styles.graphCore}>Human–AI<br />Collaboration</span>
          <span className={styles.graphLabelOne}>Research</span>
          <span className={styles.graphLabelTwo}>Methods</span>
          <span className={styles.graphLabelThree}>Education</span>
        </div>
      </div>

      <section className={styles.dashboard} aria-label="Interactive Nexosophy workspace demo">
        <header className={styles.topbar}>
          <a className={styles.brand} href="/" aria-label="Nexosophy home">
            <span className={styles.brandMark}>N</span>
            <span>Nexosophy</span>
          </a>

          <label className={styles.search}>
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search workspace" placeholder="Search across your knowledge..." />
            <kbd>⌘ K</kbd>
          </label>

          <div className={styles.topActions}>
            <div className={styles.avatarGroup} role="group" aria-label="3 collaborators">
              <span>M</span>
              <span>D</span>
              <span>+3</span>
            </div>
            <button type="button" className={styles.shareButton} onClick={() => setShared((value) => !value)}>
              {shared ? "Shared ✓" : "Share"}
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.sidebar}>
            <nav aria-label="Workspace navigation">
              <button type="button" className={styles.utilityItem}><span>⌂</span>Home</button>
              <button type="button" className={styles.utilityItem}><span>▣</span>Inbox <b>3</b></button>
            </nav>

            <div className={styles.sidebarLabel}>Workspaces</div>
            <div className={styles.workspaceList}>
              {workspaces.map((workspace) => (
                <button
                  key={workspace}
                  type="button"
                  className={workspace === activeWorkspace ? styles.workspaceActive : styles.workspaceItem}
                  onClick={() => setActiveWorkspace(workspace)}
                >
                  <span>{workspace === "Literature Review" ? "▤" : workspace === "Experiments" ? "◫" : workspace === "Analysis" ? "⌁" : "✎"}</span>
                  {workspace}
                </button>
              ))}
            </div>

            <div className={styles.sidebarDivider} />
            <button type="button" className={styles.utilityItem}><span>☆</span>Starred</button>
            <button type="button" className={styles.utilityItem}><span>◷</span>Recent</button>
          </aside>

          <main className={styles.content}>
            <div className={styles.contentHeader}>
              <div>
                <span>PhD Research</span>
                <span>/</span>
                <strong>{activeWorkspace}</strong>
              </div>
              <nav className={styles.tabs} aria-label="Workspace views">
                <button type="button" data-active={tab === "document"} onClick={() => setTab("document")}>Document</button>
                <button type="button" data-active={tab === "graph"} onClick={() => setTab("graph")}>Graph</button>
                <button type="button" data-active={tab === "tasks"} onClick={() => setTab("tasks")}>Tasks</button>
                <button type="button" data-active={tab === "references"} onClick={() => setTab("references")}>References</button>
              </nav>
            </div>

            {tab === "document" ? (
              <article className={styles.document}>
                <div className={styles.documentMeta}>
                  <span>Article</span>
                  <span className={styles.progress}>● In progress</span>
                  <span>Edited 2h ago</span>
                </div>
                <h3>The future of human–AI collaboration in science</h3>
                <p>
                  Human–AI collaboration is reshaping how we discover, learn and create. This review
                  explores current progress, key challenges and emerging opportunities across research.
                </p>
                <blockquote>
                  AI amplifies human intellect not by replacing it, but by expanding the space of what
                  we can explore together.
                </blockquote>
                <h4>1. Introduction</h4>
                <p className={styles.bodyCopy}>
                  The integration of artificial intelligence into the research process is creating new
                  possibilities for human creativity, productivity, and discovery.
                </p>
              </article>
            ) : null}

            {tab === "graph" ? (
              <div className={styles.fullGraph}>
                <div className={styles.fullGraphCore}>Human–AI<br />Collaboration</div>
                {["Methods", "Results", "Ethics", "Education", "Datasets", "Impact"].map((label, index) => (
                  <button key={label} type="button" style={{ "--i": index } as CSSProperties}>
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {tab === "tasks" ? (
              <div className={styles.taskView}>
                <div className={styles.taskViewHeader}>
                  <div>
                    <span>Research plan</span>
                    <strong>{completedTasks}/{tasks.length} complete</strong>
                  </div>
                  <span>{Math.round((completedTasks / tasks.length) * 100)}%</span>
                </div>
                {tasks.map((task) => (
                  <label key={task.id} className={styles.taskRow}>
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                    <span>{task.label}</span>
                  </label>
                ))}
              </div>
            ) : null}

            {tab === "references" ? (
              <div className={styles.referenceView}>
                <div className={styles.referenceViewHeader}>Reference library <span>{references.length}</span></div>
                {references.map(([author, title]) => (
                  <button key={author} type="button" className={styles.referenceRow}>
                    <span className={styles.referenceIcon}>▤</span>
                    <span><strong>{author}</strong><small>{title}</small></span>
                    <span>↗</span>
                  </button>
                ))}
              </div>
            ) : null}
          </main>

          <aside className={styles.rightRail}>
            <section>
              <div className={styles.railHeader}><strong>References</strong><span>12</span></div>
              {references.map(([author, title], index) => (
                <button key={author} type="button" className={styles.railReference} onClick={() => setTab("references")}>
                  <span>{index + 1}</span>
                  <span><strong>{author}</strong><small>{title}</small></span>
                </button>
              ))}
            </section>

            <section>
              <div className={styles.railHeader}><strong>Tasks</strong><span>{completedTasks}/{tasks.length}</span></div>
              {tasks.slice(0, 3).map((task) => (
                <label key={task.id} className={styles.railTask}>
                  <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                  <span>{task.label}</span>
                </label>
              ))}
            </section>
          </aside>
        </div>

        <div className={styles.assistant}>
          <div className={styles.assistantSuggestions}>
            <button type="button" onClick={() => runSuggestion("Across 12 sources, the strongest theme is that AI expands scientific throughput when human judgment stays in the loop.")}>Summarize</button>
            <button type="button" onClick={() => runSuggestion("I found 4 strong links between your literature notes, experiment results, and collaboration paper.")}>Find connections</button>
            <button type="button" onClick={() => runSuggestion("Next: compare the two dominant methodologies, resolve one citation gap, then draft the discussion section.")}>Plan next steps</button>
          </div>
          <form onSubmit={submitQuery}>
            <span className={styles.assistantMark}>N</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Ask Nexosophy"
              placeholder="Ask anything about your research..."
            />
            <button type="submit" aria-label="Send question">➤</button>
          </form>
          <p aria-live="polite">{assistantReply}</p>
        </div>
      </section>
    </div>
  );
}
