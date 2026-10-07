"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import styles from "./connected-workspace-demo.module.css";

type View = "overview" | "connections" | "actions";

type Source = {
  id: string;
  type: string;
  title: string;
  meta: string;
  glyph: string;
};

const sources: Source[] = [
  { id: "paper", type: "Paper", title: "Human–AI collaboration", meta: "12 citations", glyph: "▤" },
  { id: "note", type: "Note", title: "Cognitive augmentation", meta: "Edited today", glyph: "✎" },
  { id: "task", type: "Task", title: "Compare methodologies", meta: "Due Friday", glyph: "✓" },
  { id: "data", type: "Dataset", title: "Experiment results", meta: "3.2k rows", glyph: "▥" },
  { id: "meeting", type: "Meeting", title: "Lab review", meta: "4 collaborators", glyph: "◷" },
  { id: "person", type: "Person", title: "Dr. Maya Chen", meta: "Advisor", glyph: "◉" },
];

const actionItems = [
  "Resolve the methodology gap between two papers",
  "Link experiment result #3 to the discussion draft",
  "Ask Maya to review the emerging cognition theme",
];

export function ConnectedWorkspaceDemo() {
  const [activeSources, setActiveSources] = useState<string[]>([
    "paper",
    "note",
    "task",
    "data",
    "person",
  ]);
  const [view, setView] = useState<View>("overview");
  const [doneActions, setDoneActions] = useState<number[]>([1]);

  const activeCount = activeSources.length;

  const confidence = useMemo(() => {
    if (activeCount >= 5) return "High";
    if (activeCount >= 3) return "Medium";
    return "Low";
  }, [activeCount]);

  function toggleSource(id: string) {
    setActiveSources((current) =>
      current.includes(id) ? current.filter((sourceId) => sourceId !== id) : [...current, id],
    );
  }

  function selectAll() {
    setActiveSources(sources.map((source) => source.id));
  }

  function toggleAction(index: number) {
    setDoneActions((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  return (
    <div className={styles.stage}>
      <section className={styles.fragments} aria-label="Scattered knowledge sources">
        <div className={styles.columnHeader}>
          <div>
            <span>01</span>
            <strong>Fragments</strong>
          </div>
          <small>Choose what enters context</small>
        </div>

        <div className={styles.sourceList}>
          {sources.map((source, index) => {
            const active = activeSources.includes(source.id);

            return (
              <button
                key={source.id}
                type="button"
                className={styles.sourceCard}
                data-active={active}
                style={{ "--source-index": index } as CSSProperties}
                onClick={() => toggleSource(source.id)}
                aria-pressed={active}
              >
                <span className={styles.sourceGlyph}>{source.glyph}</span>
                <span className={styles.sourceText}>
                  <small>{source.type}</small>
                  <strong>{source.title}</strong>
                  <em>{source.meta}</em>
                </span>
                <span className={styles.sourceState}>{active ? "Linked" : "Off"}</span>
              </button>
            );
          })}
        </div>

        <button type="button" className={styles.selectAll} onClick={selectAll}>
          Link every source <span>＋</span>
        </button>
      </section>

      <div className={styles.weave} aria-hidden="true">
        <svg className={styles.weaveLines} viewBox="0 0 440 620" preserveAspectRatio="none">
          <title>Knowledge sources flowing into connected context</title>
          {sources.map((source, index) => {
            const y = 74 + index * 88;
            const active = activeSources.includes(source.id);

            return (
              <path
                key={source.id}
                d={`M0 ${y} C130 ${y} 125 310 220 310 C305 310 302 310 440 310`}
                data-active={active}
              />
            );
          })}
        </svg>

        <div className={styles.contextCore}>
          <div className={styles.contextHaloOne} />
          <div className={styles.contextHaloTwo} />
          <span className={styles.contextBrand}>N</span>
          <small>Nexosophy</small>
          <strong>Context layer</strong>
          <p>{activeCount} sources understood together</p>
          <div className={styles.contextMetric}>
            <span>{confidence}</span>
            <small>context confidence</small>
          </div>
        </div>

        <div className={styles.contextTokens}>
          <span>Semantics</span>
          <span>Relationships</span>
          <span>History</span>
          <span>Permissions</span>
        </div>
      </div>

      <section className={styles.workspace} aria-label="Connected Nexosophy workspace">
        <div className={styles.workspaceHeader}>
          <div>
            <span>02</span>
            <strong>Connected workspace</strong>
          </div>
          <small>{activeCount} live sources · synced now</small>
        </div>

        <div className={styles.workspaceShell}>
          <header className={styles.shellTopbar}>
            <div className={styles.shellBrand}>
              <span>N</span>
              <strong>PhD Research</strong>
            </div>
            <div className={styles.shellSearch}>⌕ Search this context...</div>
            <div className={styles.shellPeople}>
              <span>M</span>
              <span>D</span>
              <span>+3</span>
            </div>
          </header>

          <div className={styles.shellBody}>
            <aside className={styles.shellSidebar}>
              <span>Overview</span>
              <strong>Human–AI Collaboration</strong>
              <button type="button" data-active={view === "overview"} onClick={() => setView("overview")}>
                ◫ Overview
              </button>
              <button type="button" data-active={view === "connections"} onClick={() => setView("connections")}>
                ⌁ Connections
              </button>
              <button type="button" data-active={view === "actions"} onClick={() => setView("actions")}>
                ✓ Next actions
              </button>

              <div className={styles.sidebarSummary}>
                <small>Context</small>
                <strong>{activeCount} sources</strong>
                <span>{confidence} confidence</span>
              </div>
            </aside>

            <main className={styles.shellCanvas}>
              {view === "overview" ? (
                <div className={styles.overviewView}>
                  <div className={styles.viewEyebrow}>
                    <span>Live synthesis</span>
                    <small>Updated from linked context</small>
                  </div>
                  <h3>The strongest signal is not AI replacing researchers — it is AI expanding the space they can reason across.</h3>
                  <p>
                    Your papers, notes, experiment data and advisor feedback converge on the same pattern:
                    augmentation works best when evidence, decisions and people stay connected.
                  </p>

                  <div className={styles.evidenceGrid}>
                    <article>
                      <span>01</span>
                      <strong>Evidence</strong>
                      <p>8 of 12 papers support augmentation over replacement.</p>
                    </article>
                    <article>
                      <span>02</span>
                      <strong>Connection</strong>
                      <p>Your experiment mirrors the cognition theme in three notes.</p>
                    </article>
                    <article>
                      <span>03</span>
                      <strong>Gap</strong>
                      <p>Two methodologies conflict and need comparison before drafting.</p>
                    </article>
                  </div>

                  <div className={styles.contextQuote}>
                    <span>✦</span>
                    <p>
                      Nexosophy can explain <strong>why</strong> these things belong together because the
                      relationships were preserved, not reconstructed after the fact.
                    </p>
                  </div>
                </div>
              ) : null}

              {view === "connections" ? (
                <div className={styles.connectionsView}>
                  <div className={styles.connectionCore}>
                    <span>N</span>
                    <strong>Human–AI<br />Collaboration</strong>
                    <small>{activeCount} live sources</small>
                  </div>
                  {[
                    ["Research", "12 papers"],
                    ["Cognition", "8 notes"],
                    ["Experiments", "3 datasets"],
                    ["People", "4 collaborators"],
                    ["Methods", "2 competing"],
                    ["Writing", "1 draft"],
                  ].map(([label, meta], index) => (
                    <button key={label} type="button" data-index={index}>
                      <strong>{label}</strong>
                      <small>{meta}</small>
                    </button>
                  ))}
                  <svg viewBox="0 0 520 320" aria-hidden="true">
                    <path d="M260 160 105 68M260 160 415 70M260 160 455 176M260 160 374 270M260 160 148 270M260 160 72 175" />
                  </svg>
                </div>
              ) : null}

              {view === "actions" ? (
                <div className={styles.actionsView}>
                  <div className={styles.actionHeader}>
                    <div>
                      <span>Next actions</span>
                      <strong>Turn context into momentum.</strong>
                    </div>
                    <b>{doneActions.length}/{actionItems.length}</b>
                  </div>

                  {actionItems.map((item, index) => (
                    <label key={item} className={styles.actionRow}>
                      <input
                        type="checkbox"
                        checked={doneActions.includes(index)}
                        onChange={() => toggleAction(index)}
                      />
                      <span>
                        <strong>{item}</strong>
                        <small>
                          {index === 0
                            ? "Evidence review"
                            : index === 1
                              ? "Experiment → Draft"
                              : "Collaboration"}
                        </small>
                      </span>
                    </label>
                  ))}

                  <button type="button" className={styles.generateButton}>
                    ✦ Generate the next research plan
                  </button>
                </div>
              ) : null}
            </main>
          </div>
        </div>
      </section>
    </div>
  );
}
