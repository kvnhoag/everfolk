import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { formatYear } from "../src/index.ts";
import type { LifeState, JournalEntry, WorldPack } from "../src/types.ts";
import type { WorldRoute } from "../server/content.ts";
import type { EventVisuals } from "./scene-model.ts";
import type { ArchivedLife } from "./session.ts";
import { engineForLife, exportLife, loadAnyLife, sampleEngine } from "./session.ts";
import { useGame } from "./useGame.ts";
import PaperScene from "./PaperScene.tsx";
import ChoiceImpact from "./ChoiceImpact.tsx";
import CharacterPanel from "./CharacterPanel.tsx";
import BirthStatRoll from "./BirthStatRoll.tsx";
import { getNetWorth } from "../src/economy.ts";
import { formatMoney } from "./wealth.ts";

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

function Portrait({ age = 18, name = "Damon" }: { age?: number; name?: string }) {
  if (age < 5) return <svg viewBox="0 0 100 112" className="portrait" role="img" aria-label="Illustrated infant in a cradle"><circle cx="50" cy="35" r="17" fill="#b4aa8b"/><path d="M25 100V70c0-22 50-22 50 0v30" fill="#c9c3aa"/><path d="m29 63 39 25M26 82l38 22M75 63 33 89" stroke="#f0e9d9" strokeWidth="3"/><path d="M16 99h68M22 99l-7 10m63-10 7 10" stroke="#89917a" strokeWidth="3" fill="none"/></svg>;
  return <svg viewBox="0 0 100 112" className="portrait" aria-label={`Illustrated silhouette of the fictional character ${name}`} role="img"><path d="M14 103c2-25 15-35 36-35s34 10 36 35" fill="#c6bd9f" /><path d="m27 81 23 19 23-19M38 68l12 15 12-15" fill="none" stroke="#f0e9d9" strokeWidth="4" /><path d="M34 42c0-20 32-20 32 0v10c0 16-9 24-16 24S34 68 34 52" fill="#a89f80" /><path d="M31 49c-3-16 2-27 17-28 15-2 25 8 21 27l-6-10c-9 6-18 0-26 8" fill={age >= 60 ? "#c2c5b5" : "#3a4a40"} /><path d="M10 92C-1 54 10 23 31 12M89 92c12-38 0-69-20-80" fill="none" stroke="#89917a" strokeWidth="1.4" /><path d="M18 66C7 64 4 57 5 53c10 0 13 7 13 13m-1-21C9 41 9 32 11 30c9 4 10 10 6 15m7-19c-7-7-6-13-3-16 7 6 7 11 3 16M82 66c11-2 14-9 13-13-10 0-13 7-13 13m1-21c8-4 8-13 6-15-9 4-10 10-6 15m-7-19c7-7 6-13 3-16-7 6-7 11-3 16" fill="#89917a" /></svg>;
}

const choiceDetails: Record<string, { label: string; hint: string; icon: IconName }> = {
  stay: { label: "Build a life here", hint: "Familiar streets. People who know your name.", icon: "home" },
  sail: { label: "Take your chance at sea", hint: "Work aboard a merchant ship and travel between ports.", icon: "ship" },
  study: { label: "Follow the written word", hint: "Copy documents and practise reading and writing.", icon: "feather" },
};

const statIcons: Record<string, IconName> = { health: "heart", knowledge: "book", wealth: "coin", bonds: "bonds" };

function lifeStage(age: number): string {
  if (age < 5) return "Infancy";
  if (age < 13) return "Childhood";
  if (age < 18) return "Youth";
  if (age < 40) return "Adulthood";
  if (age < 60) return "Middle years";
  return "Later life";
}

function lifePath(life: LifeState): string {
  if (life.age < 5) return "In your household’s care";
  if (life.age < 13) return "Learning your world";
  if (life.flags.retired) return "Retired";
  if (life.flags.sailed) return "A life on the water";
  if (life.flags.studied) return "A student of words";
  if (life.flags.stayed) return "Living in the city";
  return "No route chosen";
}

function yearsLived(age: number): string {
  return age === 0 ? "Less than one year" : `${age} ${age === 1 ? "year" : "years"}`;
}

function evidenceLabel(evidence?: string): string {
  if (evidence === "documented-history") return "Documented history";
  if (evidence === "historically-inspired") return "Historical context · fictional story";
  return "Fictional personal story";
}

function SourceLinks({ ids = [], world = sampleEngine.world }: { ids?: readonly string[]; world?: WorldPack }) {
  const sources = ids.map(id => world.sources?.find(source => source.id === id)).filter(source => source !== undefined);
  if (sources.length === 0) return null;
  return <div className="source-links">{sources.map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</div>;
}

function journalSourceIds(entry: JournalEntry, world = sampleEngine.world): string[] {
  if (entry.type === "birth") return world.origins.find(item => item.id === entry.id)?.sourceIds ?? [];
  if (entry.type === "event") return world.events.find(item => item.id === entry.id)?.sourceIds ?? [];
  if (entry.type === "ending") return world.endings.find(item => item.id === entry.id)?.sourceIds ?? [];
  return [];
}

function journalKind(entry: JournalEntry, world = sampleEngine.world): string {
  if (entry.type === "choice") return "You chose";
  if (entry.type === "outcome") return "Outcome";
  if (entry.type === "activity") return "You made time for";
  if (entry.type === "birth") return "A beginning";
  if (entry.type === "ending") return "Life ended";
  const event = world.events.find(item => item.id === entry.id);
  if (event?.trigger.type === "year") return "History";
  if (event?.mode === "automatic" && event.trigger.type === "age") return "A milestone";
  return event?.mode === "automatic" ? "Life event" : "A decision";
}

function LifeJournal({ life, newestFirst = false }: { life: LifeState; newestFirst?: boolean }) {
  const world = engineForLife(life).world;
  const years = useMemo(() => {
    const groups = new Map<number, { age: number; year: number; entries: JournalEntry[] }>();
    for (const entry of life.journal) {
      let group = groups.get(entry.age);
      if (!group) {
        group = { age: entry.age, year: entry.year, entries: [] };
        groups.set(entry.age, group);
      }
      // Birthday markers establish a year even when no narrative event occurred.
      if (entry.type !== "year") group.entries.push(entry);
    }
    const result = [...groups.values()];
    return newestFirst ? result.reverse() : result;
  }, [life.journal, newestFirst]);

  return <div className="life-timeline">
    {years.map(group => <section className="journal-year" key={group.age} aria-label={`${formatYear(group.year)}, age ${group.age}`}>
      <header className="journal-year-heading"><h3>{formatYear(group.year)}</h3><span>{group.age === 0 ? "Birth year" : `Age ${group.age}`}</span></header>
      {group.entries.length > 0 ? <ol className="journal-year-entries">
        {group.entries.map((entry, index) => <li className={`journal-row journal-${entry.type}`} key={`${entry.type}-${entry.id}-${index}`}>
          <span className="journal-point" aria-hidden="true" /><div className="journal-copy"><span className="journal-kind">{journalKind(entry, world)}</span><p>{entry.text}</p>
            {journalSourceIds(entry, world).length > 0 && <details className="journal-sources"><summary>Sources</summary><SourceLinks ids={journalSourceIds(entry, world)} world={world} /></details>}
          </div>
        </li>)}
      </ol> : <p className="journal-quiet-year">This year passed without a recorded event.</p>}
    </section>)}
  </div>;
}

function App({ isAdmin = false, onChooseWorld, onNewLife, worldPickerOpen = false, startFresh = false, worldRoutes = [], eventVisuals }: { isAdmin?: boolean; onChooseWorld?: () => void; onNewLife?: () => void; worldPickerOpen?: boolean; startFresh?: boolean; worldRoutes?: WorldRoute[]; eventVisuals?: EventVisuals }) {
  const [panel, setPanel] = useState<"world" | "chronicle" | "sources" | "archive" | "about" | "character" | null>(null);
  const [characterSection, setCharacterSection] = useState<"career" | "wealth">("career");
  const [restartOpen, setRestartOpen] = useState(false);
  const game = useGame({ isOverlayOpen: panel !== null || restartOpen || worldPickerOpen, startFresh });
  const { life } = game;
  const lifeEngine = engineForLife(life);
  const world = lifeEngine.world;
  const characterName = life.character?.name ?? "Damon";
  const displayName = game.hasRevealedStats ? characterName : "Your life";
  const deathCause = world.character?.deathCauses.find(item => item.id === life.deathCauseId);
  const [downloadError, setDownloadError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [choiceKey, setChoiceKey] = useState(0);
  const [viewedLife, setViewedLife] = useState<LifeState | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const decisionTitleRef = useRef<HTMLHeadingElement>(null);
  const yearReviewRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const event = world.events.find(item => item.id === life.pendingEventId);
  const ending = world.endings.find(item => item.id === life.endingId);
  const origin = world.origins.find(item => item.id === life.originId)!;
  const thisYearEvents = life.journal.filter(entry => entry.age === life.age && entry.type === "event")
    .map(entry => ({ entry, event: world.events.find(item => item.id === entry.id) }))
    .filter(item => item.event?.mode === "automatic");
  const thisYearOutcomes = life.journal.filter(entry => entry.age === life.age && entry.type === "outcome");
  const choices = lifeEngine.getChoices(life);
  const chronicleLife = viewedLife ?? life;
  const chronicleName = chronicleLife.character?.name ?? "Damon";
  const chronicleNameKnown = viewedLife !== null || game.hasRevealedStats;
  const chronicleWorld = engineForLife(chronicleLife).world;
  const chronicleCause = chronicleWorld.character?.deathCauses.find(item => item.id === chronicleLife.deathCauseId);
  const chronicleEnding = chronicleWorld.endings.find(item => item.id === chronicleLife.endingId);
  const stage = lifeStage(life.age);
  const isDead = life.phase === "ended" && ending?.kind === "death";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (panel || restartOpen) {
      if (dialog && !dialog.open) dialog.showModal();
    } else if (dialog?.open) dialog.close();
  }, [panel, restartOpen]);

  useEffect(() => {
    if (game.hasBegun && !panel && !restartOpen && (life.phase === "choice" || life.phase === "ended")) {
      decisionTitleRef.current?.focus({ preventScroll: life.phase === "choice" });
      if (life.phase === "choice") (sceneRef.current ?? yearReviewRef.current)?.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [game.hasBegun, life.pendingEventId, life.phase, panel, restartOpen]);

  function closeDialog() {
    setPanel(null);
    setRestartOpen(false);
    setViewedLife(null);
    setDialogError("");
  }

  function openChronicle() {
    setViewedLife(null);
    setPanel("chronicle");
  }

  function downloadLife(saved?: string, filename?: string) {
    try {
      const blob = new Blob([saved ?? exportLife(life)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename ?? `a-life-in-alexandria-age-${life.age}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError("");
    } catch {
      setDownloadError("This life could not be exported. Please try again.");
    }
  }

  function selectChoice(id: string) {
    game.choose(id);
    setChoiceKey(value => value + 1);
  }

  function readArchived(entry: ArchivedLife) {
    try {
      setViewedLife(loadAnyLife(entry.save));
      setDialogError("");
      setPanel("chronicle");
    } catch {
      setDialogError("This archived life belongs to different world content. Its original save can still be downloaded.");
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error("This save file is too large.");
      if (game.importLife(await file.text())) closeDialog();
      else setDialogError("This save could not be opened. Please use a save from the current full-life world.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "This save could not be imported.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return <>
    <a className="skip-link" href="#life-scene">Skip to your life</a>
    <header className="site-header">
      <a className="brand" href="#" aria-label="About Historical Lives" onClick={e => { e.preventDefault(); setPanel("about"); }}>
        <span className="brand-mark"><Icon name="hourglass" size={26} /></span>
        <span>Historical Lives<span className="brand-caption">ONE LIFE. ANOTHER AGE.</span></span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={!panel ? "nav-link active" : "nav-link"} onClick={closeDialog}><span className="small-dot" />Your life</button>
        <button className={panel === "character" ? "nav-link active" : "nav-link"} disabled={!game.hasRevealedStats} onClick={() => { setCharacterSection("career"); setPanel("character"); }}>Character</button>
        <button className={panel === "world" ? "nav-link active" : "nav-link"} onClick={() => setPanel("world")}>The world</button>
        <button className={panel === "chronicle" ? "nav-link active" : "nav-link"} onClick={openChronicle}>Chronicle</button>
        <button className={panel === "archive" ? "nav-link active" : "nav-link"} onClick={() => setPanel("archive")}>Past lives</button>
        <button className={panel === "sources" ? "nav-link active" : "nav-link"} onClick={() => setPanel("sources")}>Sources</button>
        {onChooseWorld && <button className="nav-link" onClick={onChooseWorld}>Worlds</button>}
        {isAdmin && <a className="nav-link admin-nav-link" href="/admin">World editor</a>}
      </nav>
      <div className={`save-indicator ${game.saveStatus === "unavailable" ? "save-warning" : ""}`} role="status">
        <Icon name={game.saveStatus === "saved" ? "check" : "feather"} size={15} />
        <span>{game.saveStatus === "saved" ? "Life saved" : game.saveStatus === "saving" ? "Saving…" : "Save unavailable"}</span>
      </div>
    </header>

    <main className="page-shell" id="life-scene">
      <section className="chapter-heading" aria-label="Current world">
        <div>
          <p className="eyebrow"><span className="section-number">I</span> THE ANCIENT MEDITERRANEAN</p>
          <h1>{isDead ? "Life ended" : world.title}<span>.</span></h1>
          <p className="chapter-subtitle">{isDead ? "See the cause of death and the full record below." : "Live in Alexandria, choose what to do and see what happens."}</p>
        </div>
        <div className="chapter-date" aria-label={`Current year ${formatYear(life.year)}`}><span className="date-label">{isDead ? "FINAL YEAR" : "CURRENT YEAR"}</span><span className="date-value">{Math.abs(life.year)} <small>{life.year < 0 ? "BCE" : "CE"}</small></span><p><Icon name="pin" size={14} /> Alexandria, Egypt</p></div>
      </section>

      <div className={`life-layout ${isDead ? "life-has-ended" : ""}`}>
        <aside className="character-panel" aria-label="Your character">
          <div className="portrait-frame"><Portrait age={life.age} name={displayName} /><span className="portrait-label">{isDead ? "DECEASED" : "YOUR LIFE"}</span></div>
          <h2>{displayName}</h2><p className="character-origin">Of Alexandria</p>
          <div className="age-line"><span>{isDead && life.age === 0 ? "Died in infancy" : <>Age <strong>{life.age}</strong></>}</span><span className="tiny-divider" /><span>{isDead ? "Life ended" : stage}</span></div>
          <div className="character-details">
            <div><span>BACKGROUND</span><p>{game.hasRevealedStats ? origin.title : "Not revealed yet"}</p></div>
            <div><span>YOUR PATH</span><p>{worldRoutes.find(route => life.flags[route.flag])?.title ?? lifePath(life)}</p></div>
            <div><span>WORK</span><p>{world.character?.jobs.find(job => job.id === life.character?.jobId)?.title ?? (life.age < 16 ? "Growing up" : "No chosen occupation")}</p></div>
            <div><span>HOUSEHOLD</span><p>{life.character?.partnerId ? `${world.character?.partners.find(person => person.id === life.character?.partnerId)?.name} · ${life.character.relationshipStatus}` : "Your family home"}{life.character && life.character.children.length > 0 ? ` · ${life.character.children.length} ${life.character.children.length === 1 ? "child" : "children"}` : ""}</p></div>
            <div><span>BORN</span><p>{formatYear(world.startYear)}</p></div>
          </div>
          <div className="stats" aria-label="Life attributes">
            {Object.entries(world.stats).map(([id, definition]) => world.economy?.stat === id && life.economy ? <div className={`stat stat-${id} stat-financial`} key={id}>
              <button className="stat-wealth-open" type="button" disabled={!game.hasRevealedStats} aria-label="Open wealth details" onClick={() => { setCharacterSection("wealth"); setPanel("character"); }}><div className="stat-heading"><span><Icon name="coin" size={16} />Wealth</span><strong>{game.hasRevealedStats ? formatMoney(getNetWorth(world, life), world) : "—"}</strong></div><span className="stat-wealth-cash"><span>{game.hasRevealedStats ? `Cash ${formatMoney(life.economy.cash, world)}` : "Money not yet revealed"}</span><span aria-hidden="true">Details ↗</span></span></button>
            </div> : <div className={`stat stat-${id}`} key={id}>
              <div className="stat-heading"><span><Icon name={statIcons[id] ?? "sun"} size={16} />{definition.label}</span><strong key={life.stats[id]}>{game.hasRevealedStats ? Number(life.stats[id].toFixed(1)) : "—"}<small> / {definition.max}</small></strong></div>
              <div className="stat-track" role={game.hasRevealedStats ? "meter" : undefined} aria-label={game.hasRevealedStats ? definition.label : `${definition.label} not yet revealed`} aria-valuemin={game.hasRevealedStats ? definition.min : undefined} aria-valuemax={game.hasRevealedStats ? definition.max : undefined} aria-valuenow={game.hasRevealedStats ? life.stats[id] : undefined}><span style={{ width: game.hasRevealedStats ? `${(life.stats[id] - definition.min) / (definition.max - definition.min) * 100}%` : "0%" }} /></div>
            </div>)}
          </div>
          <button className="secondary-button character-open" disabled={!game.hasRevealedStats} onClick={() => { setCharacterSection("career"); setPanel("character"); }}>Work, skills &amp; family <Icon name="arrow" size={16} /></button>
          <p className="character-quote">Train skills, choose work and manage your household.</p>
          <button className="text-button another-life" onClick={() => setRestartOpen(true)}><Icon name="restart" size={15} /> Begin another life</button>
        </aside>

        <section className="story-column" aria-label="Your unfolding story">
          <div ref={sceneRef}>{!game.hasBegun ? <BirthStatRoll key={`${life.worldFingerprint}:${life.seed}`} life={life} world={world} revealed={game.hasRevealedStats} onComplete={game.revealStats} paused={panel !== null || restartOpen || worldPickerOpen} /> : <PaperScene life={life} compact eventVisuals={eventVisuals} paused={!game.isPlaying || panel !== null || restartOpen || worldPickerOpen} />}</div>

          {!game.hasBegun ? <section className="birth-record" aria-labelledby="birth-title">
            <div className="birth-record-heading"><p className="eyebrow"><Icon name="hourglass" size={16} /> A LIFE BEGINS</p><span className="birth-record-seal">{formatYear(world.startYear)}</span></div>
            <h2 id="birth-title">{game.hasRevealedStats ? `${characterName} is born.` : "A new life begins."}</h2>
            <p>{game.hasRevealedStats ? origin.text : "Reveal your household and starting stats, then begin your life."}</p>
            <dl className="birth-facts"><div><dt>PLACE</dt><dd>Alexandria, Egypt</dd></div><div><dt>BORN</dt><dd>{formatYear(world.startYear)}</dd></div><div><dt>HOUSEHOLD</dt><dd>{game.hasRevealedStats ? origin.title : "Not revealed yet"}</dd></div></dl>
            {game.hasRevealedStats && <SourceLinks ids={origin.sourceIds} />}
            <div className="birth-actions"><button className="primary-button" disabled={!game.hasRevealedStats} onClick={game.beginLife}>Begin this life <Icon name="arrow" size={20} /></button><button className="text-button" onClick={() => setPanel("sources")}>History, chance and the sources <Icon name="book" size={15} /></button></div>
            <p className="birth-note">At 1×, each year takes 25 seconds. Decisions arrive roughly every 2–3 years and pause time. Early deaths are possible. Sources explains this world's death risks and game balance.</p>
          </section> : <>
            <div className="life-stages" aria-label="Life stage">{["Infancy", "Childhood", "Youth", "Adulthood", "Middle years", "Later life"].map(label => <span className={stage === label ? "current-stage" : ""} key={label}>{label}</span>)}</div>
            {life.phase !== "ended" && <section className="year-review" ref={yearReviewRef} aria-labelledby="year-review-title" key={`year-${life.age}`}>
              <header className="year-review-heading"><div><p className="eyebrow"><Icon name="sun" size={16} /> THIS YEAR</p><h2 id="year-review-title">A year in your life.</h2></div><span className="year-age-badge">{formatYear(life.year)}<strong>Age {life.age}</strong></span></header>
              <div className="year-event-list">
                {thisYearEvents.map(({ entry, event: annualEvent }) => <article className={`year-event ${annualEvent?.trigger.type === "year" ? "history-event" : "background-event"}`} key={`${entry.id}-${entry.age}`}>
                  <span className="event-kind"><Icon name={annualEvent?.trigger.type === "year" ? "book" : "feather"} size={15} />{annualEvent?.trigger.type === "year" ? "HISTORY" : annualEvent?.trigger.type === "age" ? "A MILESTONE" : "LIFE EVENT"}</span>
                  <h3>{annualEvent?.title}</h3><p>{annualEvent?.text}</p>
                  <details className="annual-evidence"><summary>Story &amp; sources</summary><span>{evidenceLabel(annualEvent?.evidence)}</span><SourceLinks ids={annualEvent?.sourceIds} /></details>
                </article>)}
                {thisYearEvents.length === 0 && <article className="year-event background-event"><span className="event-kind"><Icon name="home" size={15} /> EVERYDAY LIFE</span><h3>{life.age === 0 ? "Your first days in Alexandria." : "An ordinary year."}</h3><p>{life.age === 0 ? "Your household feeds, washes and looks after you. Ships arrive at the harbor, and the markets stay busy." : "You spend the year working, doing errands and seeing people you know."}</p><span className="annual-fiction-label">Fictional personal story</span></article>}
                {thisYearOutcomes.map((entry, index) => <article className="year-outcome" key={`${entry.id}-${index}`}><span className="event-kind"><Icon name="check" size={15} /> RESULT</span><p>{entry.text}</p></article>)}
              </div>
            </section>}
            <section className={`decision-area ${life.phase === "choice" ? "has-decision" : ""} ${life.phase === "ended" ? "is-ended" : ""}`} key={`${life.pendingEventId}-${choiceKey}`} aria-labelledby="decision-title">
              <div className="decision-story">
                <p className="eyebrow decision-eyebrow"><span className="decision-star">✧</span>{life.phase === "choice" ? "A DECISION · TIME IS PAUSED" : isDead ? "THE END OF A LIFE" : life.phase === "ended" ? "A LIFE RECORDED" : "BETWEEN TURNING POINTS"}<span className="decision-age">AGE {life.age}</span></p>
                <h2 id="decision-title" ref={decisionTitleRef} tabIndex={-1}>{isDead ? "Death record" : event?.title ?? ending?.title ?? "The year continues."}</h2>
                <p className="decision-body">{event?.text ?? deathCause?.text ?? ending?.text ?? "Read this year’s events or choose a personal activity. The next year starts automatically. You can pause at any time."}</p>
                {event && <div className="event-evidence"><span>{evidenceLabel(event.evidence)}</span><SourceLinks ids={event.sourceIds} />{(event.sourceIds?.length ?? 0) > 0 && <small>The sources support the setting or historical event. Personal choices and their numerical effects are authored.</small>}</div>}
                {life.phase === "choice" && <span className="decision-prompt">{life.age < 5 ? "What will your household do?" : "What will you do?"}</span>}
              </div>
              <div className="choice-list" aria-label={life.phase === "choice" ? "Available decisions" : "Continue your life"}>
                {life.phase === "choice" && <p className="choice-impact-note"><span className="impact-gain">Green: gain.</span> <span className="impact-loss">Red: loss.</span> Ranges show possible outcomes.</p>}
                {choices.map((choice, index) => {
                  const route = worldRoutes.find(route => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "flag" && effect.flag === route.flag && effect.value)));
                  const baseDetail = event?.id === "a-place-on-the-manifest" ? choiceDetails[choice.id] : undefined;
                  const detail = route ? { label: route.title, hint: route.description, icon: baseDetail?.icon ?? "feather" as IconName } : baseDetail;
                  return <button className="choice-button choice-with-impact" key={choice.id} onClick={() => selectChoice(choice.id)}><span className="choice-icon"><Icon name={detail?.icon ?? "feather"} size={21} /></span><span className="choice-copy"><strong>{detail?.label ?? choice.text}</strong>{detail && <span>{detail.hint}</span>}<ChoiceImpact choice={choice} life={life} world={world} /></span><span className="choice-arrow"><Icon name="arrow" size={19} /></span><span className="sr-only">Choice {index + 1}</span></button>;
                })}
                {life.phase === "ready" && <>
                  <div className={`year-clock ${game.isClockRunning ? "clock-running" : ""}`}>
                    <div className="year-clock-heading"><span><Icon name="hourglass" size={18} />{game.isPlaying ? "Time is running" : "Time is paused"}</span><span className="year-clock-countdown" role="timer" aria-live="off">{game.isClockRunning ? `${(game.clockRemainingMs / 1000).toFixed(1)}s` : "Paused"}</span></div>
                    <div className="year-clock-track" role="progressbar" aria-label="Progress to the next year" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(game.clockProgress * 100)}><span style={{ width: `${game.clockProgress * 100}%` }} /></div>
                    <div className="year-clock-footer"><small>{game.isClockRunning ? "Until another year passes" : game.isPlaying ? "Time will resume when you return" : "Resume whenever you’re ready"}</small><button className="clock-toggle" onClick={() => game.setPlaying(value => !value)}><Icon name={game.isPlaying ? "pause" : "play"} size={13} />{game.isPlaying ? "Pause time" : "Resume time"}</button></div>
                  </div>
                  <button className="text-button turning-point-button" onClick={game.nextTurningPoint}>Next turning point <Icon name="arrow" size={16} /></button>
                </>}
                {life.phase === "ended" && <>
                  <div className="memorial-summary"><span className="eyebrow">{characterName.toLocaleUpperCase()} OF ALEXANDRIA</span>{deathCause && <p className="memorial-cause"><span>CAUSE OF DEATH</span><strong>{deathCause.title}</strong></p>}{life.deathCauseContext && <p className="death-context"><strong>What led to it</strong>{life.deathCauseContext}</p>}<p className="memorial-dates">{formatYear(world.startYear)} <span>—</span> {formatYear(life.year)}</p><strong>{yearsLived(life.age)}</strong>{!deathCause && <p>{life.age === 0 ? "You died before your first birthday." : life.age < 18 ? "You died before reaching adulthood." : life.flags.parent ? "Your children and household are listed in the character record." : "Read the chronicle to review this life."}</p>}</div>
                  <button className="primary-button" onClick={openChronicle}>Read your life’s chronicle <Icon name="book" size={19} /></button>
                  <button className="text-button" onClick={() => setRestartOpen(true)}>Begin another life <Icon name="arrow" size={17} /></button>
                  <SourceLinks ids={ending?.sourceIds} />
                </>}
              </div>
            </section>

            <div className="playback-bar">
              <div className="playback-label"><span className={`status-dot ${game.isClockRunning ? "running" : ""}`} /><span>{life.phase === "choice" ? game.isPlaying ? "Time waits for your decision" : "Time paused · a decision awaits" : life.phase === "ended" ? "Life ended" : game.isClockRunning ? `Next year in ${(game.clockRemainingMs / 1000).toFixed(1)}s` : game.isPlaying ? "Time is resting while you explore" : "Time is paused"}</span></div>
              <div className="playback-controls"><button className={`play-button ${game.isPlaying ? "selected" : ""}`} aria-label={game.isPlaying ? "Pause automatic progression" : "Play automatic progression"} aria-pressed={game.isPlaying} disabled={life.phase === "ended"} onClick={() => game.setPlaying(value => !value)}><Icon name={game.isPlaying ? "pause" : "play"} size={14} /></button><span className="control-divider" />{([1, 2, 4, 8] as const).map(speed => <button key={speed} className={`speed-button ${game.speed === speed ? "selected" : ""}`} aria-label={`Playback speed ${speed} times`} aria-pressed={game.speed === speed} onClick={() => game.setSpeed(speed)}>{speed}×</button>)}</div>
            </div>
            <section className="chronicle-preview" aria-labelledby="life-timeline-title"><div className="chronicle-heading"><h2 id="life-timeline-title"><Icon name="feather" size={20} /> Your life, year by year</h2><button className="text-button" onClick={openChronicle}>Full chronicle <Icon name="arrow" size={15} /></button></div><p className="chronicle-description">Every year, event and choice stays here. Newest year first.</p><LifeJournal life={life} newestFirst /></section>
          </>}
        </section>
      </div>
      {(game.notice || downloadError) && <div className="notice" role="status"><Icon name="feather" size={16} /><span>{downloadError || game.notice}</span><button aria-label="Dismiss notification" onClick={() => { game.setNotice(""); setDownloadError(""); }}><Icon name="close" size={15} /></button></div>}
    </main>

    <footer className="site-footer"><span><Icon name="hourglass" size={13} /> Historical Lives · Alexandria</span><div><button onClick={() => setPanel("sources")}>History &amp; sources</button><span className="footer-dot">·</span><button onClick={() => setPanel("about")}>About this world</button></div></footer>
    <dialog ref={dialogRef} className={`detail-dialog ${panel === "sources" ? "sources-dialog" : ""}`} onCancel={e => { e.preventDefault(); closeDialog(); }} onClick={e => { if (e.target === e.currentTarget) closeDialog(); }} aria-labelledby="dialog-title">
      <div className="dialog-content"><button className="dialog-close" aria-label="Close panel" onClick={closeDialog}><Icon name="close" /></button><input ref={importRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Import a saved life" onChange={e => { void importFile(e.target.files?.[0]); }} />
        {(dialogError || downloadError) && <p className="dialog-error" role="alert">{dialogError || downloadError}</p>}
        {restartOpen ? <>
          <p className="eyebrow">NEW LIFE</p><h2 id="dialog-title">Start a new life?</h2>
          <p>Your current life will be replaced by a new birth. Completed lives remain in this browser’s past-lives archive. You can download the current life first.</p>
          <div className="dialog-actions"><button className="secondary-button" onClick={() => downloadLife()}><Icon name="download" size={18} /> Download current life</button><button className="primary-button" onClick={() => { game.setPlaying(false); closeDialog(); if (onNewLife) onNewLife(); else game.restart(); }}>Begin another life <Icon name="arrow" /></button></div>
        </> : panel === "character" ? <>
          <p className="eyebrow">THE PEOPLE AND WORK OF YOUR LIFE</p><h2 id="dialog-title">Your character.</h2>
          <CharacterPanel key={characterSection} life={life} world={world} onActivity={game.act} initialSection={characterSection} />
        </> : panel === "chronicle" ? <>
          <p className="eyebrow">{chronicleNameKnown ? `THE LIFE OF ${chronicleName.toLocaleUpperCase()}` : "YOUR CHRONICLE"}</p><h2 id="dialog-title">{chronicleLife.phase === "ended" ? "Life ended." : "Your chronicle."}</h2>
          <p className="dialog-subtitle">{chronicleLife.phase === "ended" ? `${formatYear(chronicleWorld.startYear)} — ${formatYear(chronicleLife.year)} · ${yearsLived(chronicleLife.age)}` : "Every recorded year, event and decision."}</p>
          {chronicleLife.deathCauseContext && <p><strong>What led to it:</strong> {chronicleLife.deathCauseContext}</p>}{chronicleCause ? <p><strong>Cause of death: {chronicleCause.title}.</strong> {chronicleCause.text}</p> : chronicleEnding && <p>{chronicleEnding.text}</p>}
          {chronicleWorld.economy && chronicleLife.economy && <p className="wealth-summary-line"><strong>{chronicleLife.phase === "ended" ? "Wealth at death" : "Current wealth"}:</strong> {formatMoney(getNetWorth(chronicleWorld, chronicleLife), chronicleWorld)} estimated net worth · {formatMoney(chronicleLife.economy.cash, chronicleWorld)} cash · {formatMoney(chronicleLife.economy.debt, chronicleWorld)} debt.</p>}
          <LifeJournal life={chronicleLife} />
          <button className="secondary-button" onClick={() => downloadLife(exportLife(chronicleLife), `${chronicleName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "historical"}-life-age-${chronicleLife.age}.json`)}><Icon name="download" size={18} /> Download this life</button>
        </> : panel === "archive" ? <>
          <p className="eyebrow">HELD IN THIS BROWSER</p><h2 id="dialog-title">Past lives.</h2>
          <p>Up to ten completed lives are kept here, newest first. Download a save to keep a copy outside this browser.</p>
          <div className="past-lives">{game.archivedLives.length === 0 ? <p className="empty-archive">No life has ended yet. Your first story is still unfolding.</p> : game.archivedLives.map(entry => <article className="archived-life" key={entry.id}><span className="eyebrow">{formatYear(entry.birthYear)} — {formatYear(entry.year)}</span><h3>{entry.endingTitle}</h3><p>{yearsLived(entry.age)}</p><div><button className="text-button" onClick={() => readArchived(entry)}>Read this life <Icon name="book" size={15} /></button><button className="text-button" onClick={() => downloadLife(entry.save, `alexandria-past-life-age-${entry.age}.json`)}>Download <Icon name="download" size={15} /></button></div></article>)}</div>
          <button className="secondary-button" onClick={() => importRef.current?.click()}><Icon name="book" size={18} /> Import a saved life</button>
        </> : panel === "sources" ? <>
          <p className="eyebrow">HISTORY, FICTION &amp; CHANCE</p><h2 id="dialog-title">Behind this world.</h2>
          <p>Historical dates and context come from the sources below. {game.hasRevealedStats ? characterName : "The player character"}, his personal story, choices and stat effects are authored fiction. A source for a practice does not establish how likely a particular person was to experience it.</p>
          <section className="mortality-source-note"><h3>How a life can end</h3><p>{world.mortality?.description ?? "Mortality parameters are simulation assumptions, not measured Alexandrian death rates."}</p><SourceLinks ids={world.mortality?.sourceIds} />{world.character && <p>{world.character.deathCauseDescription}</p>}</section>
          <div className="evidence-key"><span>Documented history</span><span>Historical context · fictional story</span><span>Fictional personal story</span></div>
          <div className="sources-list">{world.sources?.map(source => <article key={source.id} id={`source-${source.id}`}><span className="eyebrow">{source.kind} · {source.publisher}</span><h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3><p className="source-period">{source.period} · {source.geography}</p><p>{source.summary}</p><p className="source-limits"><strong>Scope:</strong> {source.limitations}</p></article>)}</div>
        </> : panel === "world" ? <>
          <p className="eyebrow">THE ANCIENT MEDITERRANEAN</p><h2 id="dialog-title">Alexandria, Egypt.</h2><img className="dialog-scene" src="/assets/alexandria-harbor.webp" alt="Imagined Alexandria harbor" />
          <p>Your life begins in Alexandria in 66 BCE. If you live long enough, the city and the government around it will change as your own life unfolds.</p><p>You can work at the harbor, learn a trade or study writing. Choose a job, meet a partner and decide whether to have children.</p>
          <dl className="world-facts"><div><dt>BIRTHPLACE</dt><dd>Alexandria, Egypt</dd></div><div><dt>BIRTH YEAR</dt><dd>{formatYear(world.startYear)}</dd></div><div><dt>YOUR BEGINNING</dt><dd>At birth</dd></div><div><dt>YOUR ENDING</dt><dd>A completed life</dd></div></dl>
          <p className="fine-print">The setting has documented historical anchors; the individual life is fiction. The illustration is evocative rather than an archaeological reconstruction. Evidence from other periods and places is identified under Sources.</p><button className="secondary-button" onClick={() => setPanel("sources")}>Read the sources <Icon name="book" size={17} /></button>
        </> : <>
          <p className="eyebrow">HISTORICAL LIVES</p><h2 id="dialog-title">One life. Another age.</h2>
          <p>Begin as a newborn, live through childhood and adulthood if you survive, and reach the end of one person’s life. The clock starts when you begin and runs between decisions. Time waits while you choose, then continues automatically unless you have paused it. You can change the speed or skip quiet years to the next turning point.</p><p>Early deaths are possible. The demographic model is an exploratory comparison, not a precise reconstruction of a boy born in Ptolemaic Alexandria. The model and each event’s historical basis can be inspected under Sources.</p><p>Your life saves in this browser when storage is available. Completed lives are kept in a local archive of up to ten, and JSON saves can be downloaded or imported.</p>
          <div className="dialog-actions"><button className="secondary-button" onClick={() => importRef.current?.click()}>Import a saved life <Icon name="book" size={17} /></button><button className="primary-button" onClick={closeDialog}>Return to your life <Icon name="arrow" /></button></div><p className="fine-print">The title and art direction remain provisional. Original scene artwork created with OpenAI image generation.</p>
        </>}
      </div>
    </dialog>
  </>;
}

export default App;
