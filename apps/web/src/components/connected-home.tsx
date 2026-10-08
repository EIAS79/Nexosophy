"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import s from "./connected-home.module.css";

const paths = [
  { name: "Research", question: "What haven’t we connected yet?", detail: "Bring a question, the papers behind it, and your observations into the same conversation.", items: ["A question worth asking", "Evidence worth keeping", "An insight taking shape"] },
  { name: "Study", question: "How does it all fit together?", detail: "Give lectures, readings and your own explanations a shared home. Build understanding one connection at a time.", items: ["This week’s reading", "In your own words", "The bigger picture"] },
  { name: "Create", question: "Where could this idea lead?", detail: "Collect the fragments that catch your attention. Turn your references and rough thoughts into a direction of your own.", items: ["A small inspiration", "A different perspective", "Something of your own"] },
  { name: "Collaborate", question: "What can we see together?", detail: "A vision for shared work where the context travels with the conversation, and different perspectives move an idea forward.", items: ["A shared starting point", "Another point of view", "A clearer direction"] },
] as const;
const chapters = [
  { label: "01 / COLLECT", title: "Start with what", accent: "catches your mind.", text: "A line in a paper. An unfinished thought. A question from a conversation. Your work begins long before the first draft.", detail: "Bring your notes and sources into one place, with enough context to find your way back.", word: "Curiosity", nodes: ["A passage", "A question", "An observation"] },
  { label: "02 / CONNECT", title: "See the thought", accent: "between the thoughts.", text: "Understanding grows when the pieces start speaking to each other. Follow the relationship, not another trail of open tabs.", detail: "Explore the vision: sources, notes and questions connected around the idea you’re developing.", word: "Perspective", nodes: ["Source", "Connection", "Insight"] },
  { label: "03 / DEVELOP", title: "Let an idea", accent: "become something.", text: "Keep the thinking close to the work. Shape a clearer explanation, a stronger argument, or a next step worth taking.", detail: "Move from collecting information to making something you can stand behind.", word: "Possibility", nodes: ["Understand", "Develop", "Share"] },
] as const;

export function ConnectedHome() {
  const track = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [path, setPath] = useState(0);
  const [node, setNode] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const chosen = paths[path] ?? paths[0];
  const story = chapters[chapter] ?? chapters[0];

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 800px), (max-height: 650px)");
    let frame = 0;
    let start = 0;
    let distance = 1;
    let active = 0;
    const paint = () => {
      frame = 0;
      if (media.matches) return;
      const progress = Math.max(0, Math.min(1, (window.scrollY - start) / distance));
      const next = Math.min(2, Math.floor(progress * 3));
      element.style.setProperty("--progress", String(progress));
      if (next !== active) {
        active = next;
        setChapter(next);
        setNode(null);
      }
    };
    const request = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    const measure = () => {
      start = element.getBoundingClientRect().top + window.scrollY;
      distance = Math.max(1, element.offsetHeight - window.innerHeight);
      request();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", measure);
    media.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", measure);
      media.removeEventListener("change", measure);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const selectChapter = (index: number) => {
    setChapter(index);
    setNode(null);
    const element = track.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 800px), (max-height: 650px)").matches) return;
    window.scrollTo({
      top: element.getBoundingClientRect().top + window.scrollY + (element.offsetHeight - window.innerHeight) * ((index + 0.15) / 3),
      behavior: "smooth",
    });
  };

  return (
    <div className={s.home}>
      <a href="#content" className={s.skip}>Skip to content</a>
      <header className={s.header}>
        <Link href="/" className={s.brand}><span aria-hidden="true">✳</span> nexosophy</Link>
        <button className={s.menu} type="button" aria-expanded={menu} aria-controls="home-nav" onClick={() => setMenu(!menu)}>{menu ? "Close" : "Menu"}</button>
        <nav id="home-nav" className={s.nav} data-open={menu} aria-label="Main navigation">
          <a href="#approach">The idea</a>
          <a href="#possibilities">Your possibilities</a>
          <a href="#questions">Questions</a>
          <Link href="/sign-in">Sign in ↗</Link>
        </nav>
      </header>

      <main id="content">
        <section className={s.hero}>
          <p className={s.eyebrow}><span /> A LITTLE SPACE FOR BIGGER THINKING</p>
          <h1>Everything you know.<br /><em>More than the sum.</em></h1>
          <p className={s.lead}>A quieter place for your notes, sources and ideas.<br />Bring the pieces together. See what opens up.</p>
          <div className={s.actions}>
            <Link href="/sign-up" className={s.primary}>Find your starting point <span>↗</span></Link>
            <a href="#approach" className={s.secondary}>Explore the idea <span>↓</span></a>
          </div>
          <div className={s.horizon} aria-hidden="true"><div /><span className={s.horizonWord}>A WORLD OF CONNECTIONS</span></div>
          <div className={s.heroBottom}><span>FOR CURIOUS MINDS. AND UNFINISHED IDEAS.</span><span>SCROLL TO DISCOVER ↓</span></div>
        </section>

        <div id="approach" ref={track} className={s.track}>
          <section className={s.story}>
            <div className={s.storyTop}><p className={s.eyebrow}>THINKING HAS A NATURAL RHYTHM</p><span>01 — 03</span></div>
            <div className={s.storyGrid}>
              <div key={chapter} className={s.storyCopy}>
                <p className={s.kicker}>{story.label}</p>
                <h2>{story.title}<br /><em>{story.accent}</em></h2>
                <p>{story.text}</p>
                <p className={s.detail}>{story.detail}</p>
              </div>
              <div className={s.constellation}>
                <div className={s.ring} aria-hidden="true" />
                <div className={s.innerRing} aria-hidden="true" />
                <div className={s.core}><span>IT STARTS WITH</span><strong key={story.word}>{story.word}</strong><i aria-hidden="true">✳</i></div>
                {story.nodes.map((label, index) => (
                  <button
                    key={index === 0 ? "first" : index === 1 ? "second" : "third"}
                    className={s.node}
                    data-position={index}
                    type="button"
                    aria-pressed={node === index}
                    onClick={() => setNode(node === index ? null : index)}
                  ><span aria-hidden="true">0{index + 1}</span>{label}<span aria-hidden="true">+</span></button>
                ))}
                <p className={s.nodeHint} role="status">{node === null ? "Explore a point. Follow a thought." : [story.text, story.detail, "One connection can change how you see the whole."][node]}</p>
              </div>
            </div>
            <nav className={s.chapterNav} aria-label="Explore the process">
              {chapters.map((item, index) => <button key={item.label} type="button" aria-current={chapter === index ? "step" : undefined} onClick={() => selectChapter(index)}><span>0{index + 1}</span>{["Collect", "Connect", "Develop"][index]}<span aria-hidden="true">↗</span></button>)}
            </nav>
            <p className={s.concept}>An exploration of the Nexosophy vision.</p>
          </section>
        </div>

        <section id="possibilities" className={s.possibilities}>
          <div className={s.sectionHeading}><p className={s.eyebrow}>ROOM FOR YOUR WAY OF THINKING</p><h2>No two minds<br /><em>take the same path.</em></h2></div>
          <div className={s.pathLayout}>
            <nav className={s.pathNav} aria-label="Explore uses">
              {paths.map((item, index) => <button type="button" key={item.name} aria-pressed={path === index} onClick={() => setPath(index)}><span>0{index + 1}</span>{item.name}<span aria-hidden="true">↗</span></button>)}
            </nav>
            <div key={chosen.name} className={s.pathContent}>
              <span className={s.pathSymbol} aria-hidden="true">✳</span>
              <p className={s.kicker}>{chosen.name.toUpperCase()} / A POSSIBLE STARTING POINT</p>
              <h3>{chosen.question}</h3>
              <p>{chosen.detail}</p>
              <ol>{chosen.items.map(item => <li key={item}>{item}</li>)}</ol>
            </div>
          </div>
        </section>

        <section id="questions" className={s.questions}>
          <div><p className={s.eyebrow}>BEFORE YOU BEGIN</p><h2>A little<br /><em>more clarity.</em></h2></div>
          <div className={s.answers}>
            {[
              ["What is Nexosophy?", "A developing workspace for connected thinking. The aim is to keep notes, sources and the work they support in a shared context."],
              ["Are these features already available?", "This page describes the direction of Nexosophy. The interactive illustrations are concepts, not a claim that every connection or collaboration feature is already available."],
              ["Who is it for?", "People learning, researching, writing or building something from information. Start with your own question, subject or project."],
              ["Will my interactions here be saved?", "No. These illustrations are local to this page and do not create notes, accounts or saved work."],
            ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
          </div>
        </section>

        <section className={s.begin}>
          <p className={s.eyebrow}>THERE’S MORE TO YOUR NEXT IDEA</p>
          <h2>Give it some<br /><em>space to grow.</em></h2>
          <Link href="/sign-up" className={s.primary}>Begin with Nexosophy <span>↗</span></Link>
          <p>Bring your curiosity. The rest starts there.</p>
        </section>
      </main>
      <footer className={s.footer}><Link href="/" className={s.brand}><span aria-hidden="true">✳</span> nexosophy</Link><p>A quieter place to see the bigger picture.</p><a href="#content">Back to the beginning ↑</a></footer>
    </div>
  );
}
