import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { formatYear } from "../src/index.ts";
import { exportLife, sampleEngine } from "./session.ts";
import { useGame } from "./useGame.ts";

type IconName = "hourglass" | "arrow" | "sun" | "heart" | "book" | "coin" | "bonds" | "pin" | "feather" | "ship" | "home" | "check" | "pause" | "play" | "close" | "download" | "restart";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    hourglass: <><path d="M6 3h12M6 21h12M8 3c0 5 1 6 4 9-3 3-4 4-4 9M16 3c0 5-1 6-4 9 3 3 4 4 4 9" /><path d="m9 18 3-3 3 3" /></>,
    arrow: <><path d="M4 12h15m-5-5 5 5-5 5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" />,
    book: <><path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3zM12 6v15M6 8h3m-3 4h3m6-4h3m-3 4h3" /></>,
    coin: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="5" /><path d="M12 9v6m-2-3h4" /></>,
    bonds: <><circle cx="8" cy="7" r="3" /><path d="M2 20v-2a6 6 0 0 1 12 0v2m3-16a3 3 0 0 1 0 6m0 4a6 6 0 0 1 5 6" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    feather: <><path d="M20 3C9 2 4 8 7 15c7 3 13-2 13-12ZM3 21 16 8M7 15l5-1" /></>,
    ship: <><path d="M3 16h18l-3 5H6l-3-5Zm9-13v13M10 4 4 13h6M14 5l6 8h-6" /></>,
    home: <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 4 12 8-12 8z" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" /></>,
    restart: <><path d="M4 9a8 8 0 1 1 0 7M4 3v6h6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Portrait() {
  return <svg viewBox="0 0 100 112" className="portrait" aria-label="Illustrated silhouette of the fictional character Damon" role="img"><path d="M14 103c2-25 15-35 36-35s34 10 36 35" fill="#c6bd9f" /><path d="m27 81 23 19 23-19M38 68l12 15 12-15" fill="none" stroke="#f0e9d9" strokeWidth="4" /><path d="M34 42c0-20 32-20 32 0v10c0 16-9 24-16 24S34 68 34 52" fill="#a89f80" /><path d="M31 49c-3-16 2-27 17-28 15-2 25 8 21 27l-6-10c-9 6-18 0-26 8" fill="#3a4a40" /><path d="M10 92C-1 54 10 23 31 12M89 92c12-38 0-69-20-80" fill="none" stroke="#89917a" strokeWidth="1.4" /><path d="M18 66C7 64 4 57 5 53c10 0 13 7 13 13m-1-21C9 41 9 32 11 30c9 4 10 10 6 15m7-19c-7-7-6-13-3-16 7 6 7 11 3 16M82 66c11-2 14-9 13-13-10 0-13 7-13 13m1-21c8-4 8-13 6-15-9 4-10 10-6 15m-7-19c7-7 6-13 3-16-7 6-7 11-3 16" fill="#89917a" /></svg>;
}

const choiceDetails: Record<string, { label: string; hint: string; icon: IconName }> = {
  stay: { label: "Build a life here", hint: "Familiar streets. People who know your name.", icon: "home" },
  sail: { label: "Take your chance at sea", hint: "New horizons, with no promise of a safe return.", icon: "ship" },
  study: { label: "Follow the written word", hint: "A quieter path, and a world of things to learn.", icon: "feather" },
};

const statIcons: Record<string, IconName> = { health: "heart", knowledge: "book", wealth: "coin", bonds: "bonds" };

function App() {
  const game = useGame();
  const { life } = game;
  const [panel, setPanel] = useState<"world" | "chronicle" | "about" | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [choiceKey, setChoiceKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const event = sampleEngine.world.events.find(item => item.id === life.pendingEventId);
  const ending = sampleEngine.world.endings.find(item => item.id === life.endingId);
  const origin = sampleEngine.world.origins.find(item => item.id === life.originId)!;
  const choices = sampleEngine.getChoices(life);
  const meaningfulJournal = life.journal.filter(entry => entry.type !== "year" && entry.type !== "choice");
  const visibleJournal = [...meaningfulJournal].reverse().slice(0, 3);
  const lastOutcome = [...life.journal].reverse().find(entry => entry.type === "outcome");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (panel || restartOpen) {
      game.setPlaying(false);
      if (dialog && !dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  }, [panel, restartOpen, game.setPlaying]);

  function closeDialog() { setPanel(null); setRestartOpen(false); }

  function download() {
    try {
      const blob = new Blob([exportLife(life)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `a-life-in-alexandria-age-${life.age}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError("");
    } catch { setDownloadError("Your chronicle could not be exported. Please try again."); }
  }

  function selectChoice(id: string) {
    game.choose(id);
    setChoiceKey(value => value + 1);
  }

  return <>
    <a className="skip-link" href="#life-scene">Skip to your life</a>
    <header className="site-header">
      <a className="brand" href="#" aria-label="Historical Lives home" onClick={e => { e.preventDefault(); setPanel("about"); }}>
        <span className="brand-mark"><Icon name="hourglass" size={26} /></span>
        <span>Historical Lives<span className="brand-caption">ONE LIFE. ANOTHER AGE.</span></span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={!panel ? "nav-link active" : "nav-link"} onClick={closeDialog}><span className="small-dot" />Your life</button>
        <button className={panel === "world" ? "nav-link active" : "nav-link"} onClick={() => setPanel("world")}>The world</button>
        <button className={panel === "chronicle" ? "nav-link active" : "nav-link"} onClick={() => setPanel("chronicle")}>Chronicle</button>
      </nav>
      <div className={`save-indicator ${game.saveStatus === "unavailable" ? "save-warning" : ""}`} role="status"><Icon name={game.saveStatus === "saved" ? "check" : "feather"} size={15} /><span>{game.saveStatus === "saved" ? "Life saved" : game.saveStatus === "saving" ? "Saving…" : "Save unavailable"}</span></div>
    </header>

    <main className="page-shell" id="life-scene">
      <section className="chapter-heading" aria-label="Current world">
        <div><p className="eyebrow"><span className="section-number">I</span> THE ANCIENT MEDITERRANEAN</p><h1>A life in Alexandria<span>.</span></h1><p className="chapter-subtitle">History remembers empires. This is the story of one life.</p></div>
        <div className="chapter-date"><span>{Math.abs(life.year)}</span><small>{life.year < 0 ? "BEFORE THE COMMON ERA" : "COMMON ERA"}</small><span className="date-rule" /><p><Icon name="pin" size={14} /> Alexandria, Egypt</p></div>
      </section>

      <div className="life-layout">
        <aside className="character-panel" aria-label="Your character">
          <div className="portrait-frame"><Portrait /><span className="portrait-label">YOUR LIFE</span></div>
          <h2>Damon</h2><p className="character-origin">Of Alexandria</p>
          <div className="age-line"><span>Age <strong>{life.age}</strong></span><span className="tiny-divider" /><span>{life.age < 21 ? "A life taking shape" : "A path of your own"}</span></div>
          <div className="character-details"><div><span>BACKGROUND</span><p>{origin.title}</p></div><div><span>YOUR PATH</span><p>{life.flags.sailed ? "A life on the water" : life.flags.studied ? "A student of words" : life.flags.stayed ? "Rooted in the city" : "Still unwritten"}</p></div></div>
          <div className="stats" aria-label="Life attributes">{Object.entries(sampleEngine.world.stats).map(([id, definition]) => <div className={`stat stat-${id}`} key={id}><div className="stat-heading"><span><Icon name={statIcons[id] ?? "sun"} size={16} />{definition.label}</span><strong>{life.stats[id]}</strong></div><div className="stat-track" role="meter" aria-label={definition.label} aria-valuemin={definition.min} aria-valuemax={definition.max} aria-valuenow={life.stats[id]}><span style={{ width: `${(life.stats[id] - definition.min) / (definition.max - definition.min) * 100}%` }} /></div></div>)}</div>
          <p className="character-quote">“A life is made of the things<br />we choose, and those we cannot.”</p>
          <button className="text-button another-life" onClick={() => setRestartOpen(true)}><Icon name="restart" size={15} /> Begin another life</button>
        </aside>

        <section className="story-column" aria-label="Your unfolding story">
          <figure className="scene-image">
            <img src="/assets/alexandria-harbor.webp" alt="An imagined ancient Alexandria harbor at sunset, with merchant boats, limestone terraces and a distant lighthouse" fetchPriority="high" />
            <div className="scene-location"><Icon name="pin" size={13} /><span>THE EASTERN HARBOR</span></div>
            <div className="scene-time"><Icon name="sun" size={16} /><span>Late afternoon</span></div>
            <figcaption><span className="scene-caption-rule" />A whole world.<br /><em>One unwritten life.</em></figcaption>
          </figure>

          <section className={`decision-area ${life.phase === "ended" ? "is-ended" : ""}`} key={`${life.pendingEventId}-${choiceKey}`} aria-labelledby="decision-title">
            <div className="decision-story"><p className="eyebrow decision-eyebrow"><span className="decision-star">✧</span>{life.phase === "choice" ? "A TURNING POINT" : life.phase === "ended" ? "THE END OF THIS CHAPTER" : "YOUR STORY CONTINUES"}<span className="decision-age">AGE {life.age}</span></p><h2 id="decision-title">{event?.title ?? ending?.title ?? "A life in the making."}</h2><p className="decision-body">{event?.text ?? ending?.text ?? "A choice becomes a memory, and the days begin to turn into years. There are people to meet, things to learn, and a life still waiting to be lived."}</p>{life.phase === "choice" && <span className="decision-prompt">What will you do?</span>}</div>
            <div className="choice-list" aria-label={life.phase === "choice" ? "Available decisions" : "Continue your life"}>{choices.map((choice, index) => {
              const detail = life.age === 18 ? choiceDetails[choice.id] : undefined;
              return <button className="choice-button" key={choice.id} onClick={() => selectChoice(choice.id)}><span className="choice-icon"><Icon name={detail?.icon ?? "feather"} size={21} /></span><span className="choice-copy"><strong>{detail?.label ?? choice.text}</strong>{detail && <span>{detail.hint}</span>}</span><span className="choice-arrow"><Icon name="arrow" size={19} /></span><span className="sr-only">Choice {index + 1}</span></button>;
            })}{life.phase === "ready" && <><div className="outcome-note"><Icon name="feather" size={22} /><p>{lastOutcome?.text ?? "Your next year is waiting."}</p></div><button className="primary-button" onClick={game.advance}>Live another year <Icon name="arrow" size={20} /></button></>}{life.phase === "ended" && <><p className="ending-note">Your choices have become a story. Keep it, or discover who you might be next.</p><button className="primary-button" onClick={() => setPanel("chronicle")}>Read your chronicle <Icon name="book" size={19} /></button><button className="text-button" onClick={() => setRestartOpen(true)}>Begin another life <Icon name="arrow" size={17} /></button></>}</div>
          </section>

          <div className="playback-bar"><div className="playback-label"><span className={`status-dot ${life.phase === "ready" && game.isPlaying ? "running" : ""}`} /><span>{life.phase === "choice" ? "Time waits for your decision" : life.phase === "ended" ? "A chapter to remember" : game.isPlaying ? "Your life is unfolding" : "A moment to reflect"}</span></div><div className="playback-controls"><button className={`play-button ${game.isPlaying ? "selected" : ""}`} aria-label={game.isPlaying ? "Pause automatic progression" : "Play automatic progression"} aria-pressed={game.isPlaying} disabled={life.phase === "ended"} onClick={() => game.setPlaying(value => !value)}><Icon name={game.isPlaying ? "pause" : "play"} size={14} /></button><span className="control-divider" />{([1, 2, 4] as const).map(speed => <button key={speed} className={`speed-button ${game.speed === speed ? "selected" : ""}`} aria-label={`Playback speed ${speed} times`} aria-pressed={game.speed === speed} onClick={() => game.setSpeed(speed)}>{speed}×</button>)}</div></div>
          <section className="chronicle-preview" aria-label="Recent life events"><div className="chronicle-heading"><h3><Icon name="feather" size={17} /> A few lines from your life</h3><button className="text-button" onClick={() => setPanel("chronicle")}>Full chronicle <Icon name="arrow" size={15} /></button></div><ol>{visibleJournal.map((entry, index) => <li key={`${entry.id}-${entry.age}-${index}`}><span className="journal-date">{formatYear(entry.year)}</span><span className="journal-point" /><p>{entry.text}</p></li>)}</ol></section>
        </section>
      </div>
      {(game.notice || downloadError) && <div className="notice" role="status"><Icon name="feather" size={16} /><span>{downloadError || game.notice}</span><button aria-label="Dismiss notification" onClick={() => { game.setNotice(""); setDownloadError(""); }}><Icon name="close" size={15} /></button></div>}
    </main>

    <footer className="site-footer"><span><Icon name="hourglass" size={13} /> Every life leaves a trace.</span><div><span>SCENE STUDY 01</span><span className="footer-dot">·</span><button onClick={() => setPanel("about")}>About this scene</button></div></footer>

    <dialog ref={dialogRef} className="detail-dialog" onCancel={e => { e.preventDefault(); closeDialog(); }} onClick={e => { if (e.target === e.currentTarget) closeDialog(); }} aria-labelledby="dialog-title"><div className="dialog-content"><button className="dialog-close" aria-label="Close panel" onClick={closeDialog}><Icon name="close" /></button>
      {restartOpen ? <><p className="eyebrow">ANOTHER POSSIBILITY</p><h2 id="dialog-title">Every beginning is different.</h2><p>Your current chapter will be replaced by a new life. You can download its chronicle first.</p><div className="dialog-actions"><button className="secondary-button" onClick={download}><Icon name="download" size={18} /> Download current life</button><button className="primary-button" onClick={() => { game.restart(); closeDialog(); }}>Begin another life <Icon name="arrow" /></button></div></> : panel === "chronicle" ? <><p className="eyebrow">THE LIFE OF DAMON</p><h2 id="dialog-title">Your chronicle.</h2><p className="dialog-subtitle">An ordinary beginning. A story that belongs to you.</p><ol className="full-journal">{meaningfulJournal.map((entry, index) => <li key={`${entry.id}-${index}`}><span className="eyebrow">AGE {entry.age} · {formatYear(entry.year)}</span><p>{entry.text}</p></li>)}</ol><button className="secondary-button" onClick={download}><Icon name="download" size={18} /> Download your life</button></> : panel === "world" ? <><p className="eyebrow">THE ANCIENT MEDITERRANEAN</p><h2 id="dialog-title">A city at the water’s edge.</h2><img className="dialog-scene" src="/assets/alexandria-harbor.webp" alt="Imagined Alexandria harbor" /><p>For this scene, your story begins in an imagined Alexandria: a harbor of merchants, artisans and people drawn to the written word.</p><p>The sea offers one kind of possibility. The city offers another. What matters is the life you make between them.</p><dl className="world-facts"><div><dt>SETTING</dt><dd>Alexandria, Egypt</dd></div><div><dt>OPENING YEAR</dt><dd>48 BCE</dd></div><div><dt>YOUR BEGINNING</dt><dd>Age 18</dd></div><div><dt>CHAPTER ENDS</dt><dd>Age 23</dd></div></dl><p className="fine-print">This fictional chapter explores the game’s interactions. Characters, events and probability weights are invented; the illustration is evocative rather than an archaeological reconstruction.</p></> : <><p className="eyebrow">HISTORICAL LIVES · SCENE STUDY 01</p><h2 id="dialog-title">One life. Another age.</h2><p>A first playable look at a life through history. Make a decision, see what changes, and continue through the next five years. Your life saves in this browser when storage is available.</p><p>The title, art direction and Alexandria setting are provisional. The story and character are fictional. An ending completes this sample chapter; it does not imply the character has died.</p><p className="fine-print">Original scene artwork created with OpenAI image generation. Built with React, Vite and the project’s independent simulation engine.</p><button className="primary-button" onClick={closeDialog}>Return to your life <Icon name="arrow" /></button></>}
    </div></dialog>
  </>;
}

export default App;
