"use client";

import { useState } from "react";
import styles from "./hero-dashboard.module.css";

const taskLabels = ["Summarize key findings from 5 papers", "Compare methodologies", "Draft discussion section", "Prepare presentation"];

export function HeroDashboard() {
  const [done, setDone] = useState<number[]>([0]);
  const [active, setActive] = useState("document");

  const toggle = (index: number) =>
    setDone((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);

  return (
    <div className={styles.scene} data-active={active}>
      <svg className={styles.orbits} viewBox="0 0 1600 820" preserveAspectRatio="none" aria-hidden="true">
        <path d="M120 265 C380 75 655 135 800 390 C965 685 1240 670 1510 415" />
        <path d="M80 520 C340 690 595 645 800 390 C1035 95 1290 120 1540 285" />
        <path d="M250 120 C510 305 630 375 800 390 C1010 410 1170 300 1380 105" />
        <circle cx="338" cy="175" r="7" /><circle cx="595" cy="265" r="8" /><circle cx="1038" cy="250" r="7" />
        <circle cx="1280" cy="580" r="8" /><circle cx="1450" cy="342" r="6" />
      </svg>

      <div className={styles.planet} aria-hidden="true"><span /></div>

      <button className={styles.document} data-panel="document" type="button" onClick={() => setActive("document")}>
        <span className={styles.panelHead}><b>▤</b><strong>Document</strong><i>● ● ● +3</i></span>
        <em>The future of human–AI<br />collaboration in science</em>
        <small>Human–AI collaboration is reshaping how we discover, learn and create...</small>
      </button>

      <button className={styles.graph} data-panel="graph" type="button" onClick={() => setActive("graph")}>
        <span className={styles.panelHead}><b>⌘</b><strong>Graph</strong><i>↗</i></span>
        <div className={styles.graphBody}>
          <svg viewBox="0 0 250 135" aria-hidden="true">
            <path d="M125 68 34 35M125 68 74 112M125 68 205 30M125 68 220 98M125 68 125 16" />
            <circle cx="34" cy="35" r="6"/><circle cx="74" cy="112" r="6"/><circle cx="205" cy="30" r="6"/><circle cx="220" cy="98" r="6"/><circle cx="125" cy="16" r="6"/>
          </svg>
          <span>Human–AI<br/>Collaboration</span>
        </div>
      </button>

      <button className={styles.ai} data-panel="ai" type="button" onClick={() => setActive("ai")}>
        <span className={styles.panelHead}><b>N</b><strong>Nexa AI</strong><i>● Online</i></span>
        <small>Ask, explore, write, and make connections across all your knowledge.</small>
        <span className={styles.chips}><i>Summarize this paper</i><i>Find related research</i><i>Compare viewpoints</i></span>
        <span className={styles.prompt}>Ask anything about your knowledge... <b>↗</b></span>
      </button>

      <section className={styles.tasks} data-panel="tasks" onPointerEnter={() => setActive("tasks")}>
        <span className={styles.panelHead}><b>✓</b><strong>Tasks</strong><i>{done.length}/4</i></span>
        <div>{taskLabels.map((label,index) => <label key={label}><input type="checkbox" checked={done.includes(index)} onChange={() => toggle(index)} /><span>{label}</span></label>)}</div>
      </section>

      <button className={styles.references} data-panel="references" type="button" onClick={() => setActive("references")}>
        <span className={styles.panelHead}><b>▤</b><strong>References</strong><i>12</i></span>
        <span>Bender et al. (2023)<small>On the Dangers of Stochastic Parrots</small></span>
        <span>Nature (2024)<small>AI in Science: Opportunities and Challenges</small></span>
        <span>Azoulay, P. (2022)<small>The Labor of AI in Research</small></span>
      </button>

      <button className={styles.timeline} data-panel="timeline" type="button" onClick={() => setActive("timeline")}>
        <span className={styles.panelHead}><b>◷</b><strong>Timeline</strong><i>Week</i></span>
        <span>Oct 16 <b>Literature review</b></span><span>Oct 18 <b>Experiment results</b></span><span>Oct 22 <b>Draft paper</b></span><span>Oct 28 <b>Team sync</b></span>
      </button>
    </div>
  );
}
