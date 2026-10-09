"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarBlank,
  ChartLineUp,
  Check,
  CheckSquare,
  Database,
  FileText,
  Flask,
  Folder,
  GitBranch,
  Infinity as InfinityIcon,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  Sparkle,
  Users,
  X,
} from "@phosphor-icons/react";
import { type ReactNode, useId, useState } from "react";
import s from "./home.module.css";

export const icons = {
  Document: FileText,
  Graph: GitBranch,
  References: BookOpen,
  "Nexa AI": Sparkle,
  Tasks: CheckSquare,
  Timeline: CalendarBlank,
  Notes: FileText,
  Whiteboard: GitBranch,
  Search: MagnifyingGlass,
  Calendar: CalendarBlank,
  Datasets: Database,
  Experiments: Flask,
  Dashboards: ChartLineUp,
  Files: Folder,
  Collaboration: Users,
};
export type Kind = keyof typeof icons;
export function Mark() {
  return (
    <span className={s.mark}>
      <InfinityIcon size={26} weight="bold" aria-hidden="true" />
    </span>
  );
}
export function GlassPanel({
  title,
  kind = "Document",
  children,
  className = "",
  badge,
}: {
  title: string;
  kind?: Kind;
  children: ReactNode;
  className?: string;
  badge?: string | undefined;
}) {
  const Icon = icons[kind];
  return (
    <section className={`${s.glass} ${className}`}>
      <header className={s.panelHeader}>
        <span className={s.iconTile}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <h3>{title}</h3>
        {badge && <small>{badge}</small>}
      </header>
      <div className={s.panelBody}>{children}</div>
    </section>
  );
}
const researchTasks = [
  "Summarize key findings",
  "Compare methodologies",
  "Draft discussion section",
  "Prepare presentation",
];
export function TaskList({
  compact = false,
  items = researchTasks,
}: {
  compact?: boolean;
  items?: string[];
}) {
  const [done, setDone] = useState(() => items.map((_, i) => i === 0));
  return (
    <div className={s.taskList}>
      {items.slice(0, compact ? 3 : items.length).map((task, index) => (
        <label key={task}>
          <input
            type="checkbox"
            checked={done[index] ?? false}
            onChange={() => setDone(done.map((value, i) => (i === index ? !value : value)))}
          />
          <span>{task}</span>
        </label>
      ))}
    </div>
  );
}
export function GraphCanvas({ small = false }: { small?: boolean }) {
  const [selected, setSelected] = useState("Human–AI collaboration");
  const nodes = [
    { label: "Human–AI collaboration", x: 50, y: 49 },
    { label: "Creativity", x: 20, y: 20 },
    { label: "Education", x: 82, y: 22 },
    { label: "Methods", x: 16, y: 73 },
    { label: "Discovery", x: 79, y: 78 },
    { label: "Society", x: 54, y: 91 },
  ];
  return (
    <div className={s.graph} data-small={small}>
      <svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
        {nodes.slice(1).map((n) => (
          <path key={n.label} d={`M150 98 Q${n.x * 3} 98 ${n.x * 3} ${n.y * 2}`} />
        ))}
      </svg>
      {nodes.map((n) => (
        <button
          type="button"
          key={n.label}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
          aria-pressed={selected === n.label}
          onClick={() => setSelected(n.label)}
        >
          {n.label}
        </button>
      ))}
      <span className={s.graphStatus} role="status">
        Selected: {selected}
      </span>
    </div>
  );
}
export function References() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div className={s.references}>
        {[
          "Human–AI collaboration: a research agenda",
          "Artificial intelligence in scientific discovery",
          "Cognitive tools and collective intelligence",
        ].map((paper, index) => (
          <button
            key={paper}
            type="button"
            onClick={() => setOpen(open === paper ? null : paper)}
            aria-expanded={open === paper}
          >
            <FileText size={17} aria-hidden="true" />
            <span>
              {paper}
              <small>Illustrative reference · 0{index + 1}</small>
            </span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
      {open && (
        <p className={s.demoResult}>
          {open} — Example source record, linked to the current research note. This is demo
          metadata, not a verified citation.
        </p>
      )}
    </>
  );
}
export function AIPreview() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(false);
  return (
    <>
      <p className={s.miniText}>Explore what context-aware assistance could look like.</p>
      <div className={s.suggestions}>
        {[
          "Summarize this paper",
          "Find related research",
          "Generate an outline",
          "Compare viewpoints",
        ].map((text) => (
          <button
            type="button"
            key={text}
            onClick={() => {
              setPrompt(text);
              setResult(false);
            }}
          >
            {text}
          </button>
        ))}
      </div>
      <form
        className={s.aiInput}
        onSubmit={(e) => {
          e.preventDefault();
          setResult(true);
        }}
      >
        <input
          aria-label="Try an AI preview prompt"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setResult(false);
          }}
          placeholder="Ask about your knowledge…"
          required
        />
        <button type="submit" aria-label="Preview prompt">
          <PaperPlaneTilt size={17} />
        </button>
      </form>
      {result && (
        <p role="status" className={s.demoResult}>
          Prompt selected: “{prompt}”. This is a UI demonstration; no AI request was sent.
        </p>
      )}
    </>
  );
}
export function Timeline() {
  const [view, setView] = useState("Week");
  return (
    <>
      <div className={s.chips}>
        {["Day", "Week", "Month"].map((x) => (
          <button type="button" key={x} aria-pressed={view === x} onClick={() => setView(x)}>
            {x}
          </button>
        ))}
      </div>
      <div className={s.timeline}>
        {(view === "Day"
          ? [
              ["09:00", "Read and annotate"],
              ["14:00", "Research discussion"],
            ]
          : view === "Week"
            ? [
                ["Mon", "Literature review"],
                ["Wed", "Experiment results"],
                ["Fri", "Draft paper"],
              ]
            : [
                ["Week 1", "Discover & collect"],
                ["Week 2", "Connect & analyze"],
                ["Week 3", "Write & review"],
              ]
        ).map(([date, name]) => (
          <p key={date}>
            <span>{date}</span>
            {name}
          </p>
        ))}
      </div>
    </>
  );
}
export function Notes() {
  const [notes, setNotes] = useState([
    "Research question",
    "Working hypothesis",
    "Follow-up experiment?",
  ]);
  return (
    <div className={s.notes}>
      {notes.map((text, index) => (
        <span key={text}>
          {index > 0 && <ArrowRight size={12} aria-hidden="true" />}
          {text}
        </span>
      ))}
      <button type="button" onClick={() => setNotes([...notes, `New thought ${notes.length + 1}`])}>
        <Plus size={13} /> Add a thought
      </button>
    </div>
  );
}
export function DatasetList() {
  return (
    <div className={s.dataList}>
      {[
        ["Survey responses", "CSV", "2.4 MB"],
        ["Observation log", "XLSX", "840 KB"],
        ["Model outputs", "JSON", "1.2 MB"],
      ].map(([name, type, size]) => (
        <p key={name}>
          <Database size={15} aria-hidden="true" />
          <span>
            {name}
            <small>
              {type} · {size} · sample
            </small>
          </span>
        </p>
      ))}
    </div>
  );
}
export function ExperimentList() {
  const [filter, setFilter] = useState("All");
  return (
    <>
      <div className={s.chips}>
        {["All", "Running", "Planned"].map((x) => (
          <button type="button" key={x} aria-pressed={filter === x} onClick={() => setFilter(x)}>
            {x}
          </button>
        ))}
      </div>
      <div className={s.experiments}>
        {[
          ["Cell culture — batch A", "Completed"],
          ["Western blot — p53", "Running"],
          ["RNA extraction", "Planned"],
        ]
          .filter(([, status]) => filter === "All" || status === filter)
          .map(([name, status]) => (
            <p key={name}>
              {name}
              <small data-status={status}>{status}</small>
            </p>
          ))}
      </div>
    </>
  );
}
export function Chart() {
  return (
    <div className={s.chart}>
      <svg
        viewBox="0 0 240 85"
        role="img"
        aria-label="Illustrative trend rising across six observations"
      >
        <path className={s.chartGrid} d="M0 20H240M0 45H240M0 70H240" />
        <path d="M8 68L47 58L89 62L133 34L180 43L230 12" />
      </svg>
      <span>
        6 observations <small>Illustrative data</small>
      </span>
    </div>
  );
}
export function SearchPreview() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const data = [
    ["Human–AI collaboration", "Documents"],
    ["Literature review notes", "Notes"],
    ["Research observations", "Datasets"],
  ];
  return (
    <>
      <label className={s.search}>
        <MagnifyingGlass size={15} />
        <input
          aria-label="Search demo records"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your knowledge…"
        />
      </label>
      <div className={s.chips}>
        {["All", "Documents", "Notes", "Datasets"].map((x) => (
          <button key={x} type="button" aria-pressed={filter === x} onClick={() => setFilter(x)}>
            {x}
          </button>
        ))}
      </div>
      <ul className={s.searchResults}>
        {data
          .filter(
            ([name, category]) =>
              (filter === "All" || filter === category) &&
              name?.toLowerCase().includes(query.toLowerCase()),
          )
          .map(([name, category]) => (
            <li key={name}>
              {name}
              <small>{category} · Demo</small>
            </li>
          ))}
      </ul>
      {!data.some(
        ([name, category]) =>
          (filter === "All" || filter === category) &&
          name?.toLowerCase().includes(query.toLowerCase()),
      ) && <p className={s.miniText}>No matching demo records.</p>}
    </>
  );
}
export function MiniDocument({ bright = false, title }: { bright?: boolean; title?: string }) {
  return (
    <div
      className={bright ? s.paper : s.miniDocument}
      contentEditable={bright}
      suppressContentEditableWarning
      {...(bright
        ? {
            role: "textbox" as const,
            "aria-label": "Editable sample manuscript",
            "aria-multiline": true,
          }
        : {})}
    >
      <small>RESEARCH NOTE / DRAFT</small>
      <h4>
        {title ??
          (bright
            ? "The future of human-AI collaboration in science"
            : "AI in Scientific Discovery")}
      </h4>
      <p>Scientific progress depends on the connections between people, evidence and ideas.</p>
      {bright && (
        <>
          <p>
            When sources remain connected to our thinking, we can revisit the reasoning behind a
            decision—not just its outcome.
          </p>
          <blockquote>Better tools should extend human curiosity, not replace it.</blockquote>
          <h5>A shared foundation for discovery</h5>
          <p>
            We explore how contextual knowledge can support transparent and collaborative research.
          </p>
        </>
      )}
    </div>
  );
}
export function DemoPanel({ kind }: { kind: Kind }) {
  switch (kind) {
    case "Document":
      return <MiniDocument />;
    case "Graph":
    case "Whiteboard":
      return <GraphCanvas small />;
    case "References":
      return <References />;
    case "Nexa AI":
      return <AIPreview />;
    case "Tasks":
      return <TaskList compact />;
    case "Timeline":
    case "Calendar":
      return <Timeline />;
    case "Notes":
      return <Notes />;
    case "Search":
      return <SearchPreview />;
    case "Datasets":
    case "Files":
      return <DatasetList />;
    case "Experiments":
      return <ExperimentList />;
    case "Dashboards":
      return <Chart />;
    default:
      return <Comments />;
  }
}
export function MiniAppWindow({
  label = "PhD Research",
  dashboard = false,
}: {
  label?: string;
  dashboard?: boolean;
}) {
  const views = dashboard
    ? ["Overview", "Notes", "Files", "References", "Tasks", "Experiments", "Analytics"]
    : ["Document", "Graph", "Tasks"];
  const [tab, setTab] = useState(dashboard ? "Overview" : "Document");
  const [area, setArea] = useState(label);
  const [shared, setShared] = useState(false);
  const id = useId();
  return (
    <div className={s.appWindow}>
      <header className={s.appBar}>
        <Mark />
        <strong>Nexosophy</strong>
        <span className={s.appBarLabel}>Interactive product concept</span>
        <button type="button" onClick={() => setShared(!shared)} aria-expanded={shared}>
          <Users size={14} /> Share
        </button>
      </header>
      {shared && (
        <p role="status" className={s.shareNotice}>
          Sharing preview: invite controls shown here do not grant account access.
        </p>
      )}
      <div className={s.appLayout}>
        <aside className={s.appSidebar}>
          <small>YOUR WORKSPACE</small>
          {[
            "Home",
            "Inbox",
            "PhD Research",
            "Literature Review",
            "Experiments",
            "Analysis",
            "Papers & Writing",
            "Lab Operations",
            "Class Notes",
            "Ideas & Drafts",
            "Team Hub",
            "Archive",
          ].map((name) => (
            <button
              type="button"
              key={name}
              aria-pressed={area === name}
              onClick={() => setArea(name)}
            >
              <Folder size={12} />
              {name}
            </button>
          ))}
          <small>Shared with me · Starred · Recent</small>
        </aside>
        <div className={s.appMain}>
          <div className={s.appBreadcrumb}>
            {area} <span>/ Working note</span>
          </div>
          <div className={s.appTabs} role="tablist" aria-label="Product preview views">
            {views.map((name, index, all) => (
              <button
                type="button"
                key={name}
                role="tab"
                id={`${id}-${name}`}
                aria-controls={`${id}-panel`}
                aria-selected={tab === name}
                tabIndex={tab === name ? 0 : -1}
                onClick={() => setTab(name)}
                onKeyDown={(e) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? all.length - 1
                        : (index + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length;
                  const value = all[next] ?? "Document";
                  setTab(value);
                  document.getElementById(`${id}-${value}`)?.focus();
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-${tab}`}
            className={s.appContent}
          >
            {tab === "Overview" ? (
              <div className={s.overviewDemo}>
                <MiniDocument />
                <Chart />
                <TaskList compact />
              </div>
            ) : tab === "Notes" ? (
              <Notes />
            ) : tab === "Files" ? (
              <DatasetList />
            ) : tab === "References" ? (
              <References />
            ) : tab === "Experiments" ? (
              <ExperimentList />
            ) : tab === "Analytics" ? (
              <Chart />
            ) : tab === "Document" ? (
              <MiniDocument
                bright
                title={
                  label === "Climate Research"
                    ? "Modeling climate resilience in urban systems"
                    : "The future of human-AI collaboration in science"
                }
              />
            ) : tab === "Graph" ? (
              <GraphCanvas />
            ) : (
              <TaskList />
            )}
          </div>
        </div>
        <aside className={s.appRail}>
          <small>CONNECTED KNOWLEDGE</small>
          <GraphCanvas small />
          <References />
        </aside>
      </div>
      <footer className={s.appFooter}>
        <GitBranch size={12} /> Sources, thinking and next steps—together. <span>Local demo</span>
      </footer>
    </div>
  );
}
export function Permissions() {
  const [roles, setRoles] = useState(["Owner", "Editor", "Commenter", "Viewer"]);
  return (
    <div className={s.permissionTable}>
      <p className={s.miniText}>Illustrative roles. Changes affect this preview only.</p>
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>View</th>
            <th>Comment</th>
            <th>Edit</th>
            <th>Admin</th>
          </tr>
        </thead>
        <tbody>
          {["You", "Maya Chen", "Daniel Kim", "Priya Shah"].map((name, index) => (
            <tr key={name}>
              <td>{name}</td>
              <td>
                <select
                  aria-label={`Demo role for ${name}`}
                  value={roles[index]}
                  onChange={(e) =>
                    setRoles(roles.map((role, i) => (i === index ? e.target.value : role)))
                  }
                >
                  {["Owner", "Editor", "Commenter", "Viewer"].map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </td>
              <td>
                <Check size={13} aria-label="Can view" />
              </td>
              <td>
                {roles[index] !== "Viewer" ? (
                  <Check size={13} aria-label="Can comment" />
                ) : (
                  <X size={13} aria-label="Cannot comment" />
                )}
              </td>
              <td>
                {["Owner", "Editor"].includes(roles[index] ?? "") ? (
                  <Check size={13} aria-label="Can edit" />
                ) : (
                  <X size={13} aria-label="Cannot edit" />
                )}
              </td>
              <td>
                {roles[index] === "Owner" ? (
                  <Check size={13} aria-label="Can administer" />
                ) : (
                  <X size={13} aria-label="Cannot administer" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Versions() {
  const [version, setVersion] = useState("v1.4");
  return (
    <div className={s.versions}>
      {[
        ["v1.4", "Maya", "Added analysis section"],
        ["v1.3", "Daniel", "Refined methodology"],
        ["v1.2", "Priya", "Updated figures"],
      ].map(([v, name, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={version === v}
          onClick={() => setVersion(v ?? "v1.4")}
        >
          <span>{v}</span>
          <strong>
            {name}
            <small>{text}</small>
          </strong>
        </button>
      ))}
      <p className={s.miniText} role="status">
        Viewing {version} · sample revision
      </p>
    </div>
  );
}
export function Comments() {
  const [resolved, setResolved] = useState(false);
  return (
    <div className={s.comments}>
      <p>
        <span className={s.avatar}>MC</span>
        <strong>
          Maya Chen <small>Example comment</small>
        </strong>
      </p>
      <blockquote>Could we link this observation to the methodology?</blockquote>
      <p className={s.miniText}>Daniel: The reference is now attached to the working note.</p>
      <button type="button" className={s.smallButton} onClick={() => setResolved(!resolved)}>
        {resolved ? "Reopen conversation" : "Resolve conversation"}
      </button>
      <small role="status">{resolved ? "Resolved in this preview" : "Open discussion"}</small>
    </div>
  );
}

export function PersonaPreview({ index }: { index: number }) {
  const [answer, setAnswer] = useState(false);
  const [course, setCourse] = useState("Syllabus");
  if (index === 0)
    return (
      <div className={s.personaDemo}>
        <TaskList items={["Read chapter 4", "Make flashcards"]} />
        <div className={s.flashcard}>
          <small>FLASHCARD · 1 / 8</small>
          <p>
            {answer
              ? "Plants convert light into chemical energy, using water and carbon dioxide."
              : "What happens during photosynthesis?"}
          </p>
          <button type="button" aria-pressed={answer} onClick={() => setAnswer(!answer)}>
            {answer ? "Show question" : "Reveal answer"}
          </button>
        </div>
      </div>
    );
  if (index === 1)
    return (
      <>
        <TaskList items={["Find relevant papers", "Identify research gaps"]} />
        <References />
      </>
    );
  if (index === 2)
    return (
      <div className={s.courseHub}>
        <strong>Modern AI Systems</strong>
        <div className={s.chips}>
          {["Syllabus", "Slides", "Assignments", "Student Q&A"].map((x) => (
            <button key={x} type="button" aria-pressed={course === x} onClick={() => setCourse(x)}>
              {x}
            </button>
          ))}
        </div>
        <p role="status">
          {course === "Syllabus"
            ? "Week 04 · Reasoning and evaluation"
            : course === "Slides"
              ? "Lecture 4 · Evaluating AI systems"
              : course === "Assignments"
                ? "Compare two evaluation methods"
                : "What makes a benchmark reliable?"}
        </p>
      </div>
    );
  if (index === 3) return <ExperimentList />;
  if (index === 4)
    return (
      <>
        <p className={s.miniText}>Sample claim: urban green space improves resilience.</p>
        <small className={s.contextWarning}>Needs context · not verified</small>
        <TaskList
          items={["Find primary sources", "Compare perspectives", "Identify missing context"]}
        />
      </>
    );
  return (
    <>
      <TaskList items={["Clean & prepare", "Run analysis", "Create report"]} />
      <Chart />
    </>
  );
}
