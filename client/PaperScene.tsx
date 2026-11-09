import type { LifeState } from "../src/types.ts";

const scenes = {
  birth: { file: "birth", title: "A small beginning.", caption: "Your first world is the people who care for you.", alt: "Layered paper illustration of a newborn in an Alexandrian household" },
  childhood: { file: "childhood", title: "The world grows with you.", caption: "Familiar doorways, small discoveries, and people to learn from.", alt: "Paper-cutout scene of a child exploring life near an ancient Alexandrian courtyard" },
  learning: { file: "learning", title: "One mark. A new possibility.", caption: "Learning takes shape through patience and the people around you.", alt: "Paper-cutout illustration of a young person learning letters on a wax tablet with a teacher" },
  work: { file: "work", title: "A place in the everyday.", caption: "Your work, your neighbors, and the small things that make a life.", alt: "Paper-cutout scene of an adult at work in an ancient Alexandrian workshop" },
  sea: { file: "sea", title: "Beyond familiar shores.", caption: "The harbor opens onto another stretch of your story.", alt: "Paper-cutout illustration of a young sailor and a merchant ship in Alexandria's harbor" },
  family: { file: "family", title: "A life held together.", caption: "Time shared, care given, and the people who become your world.", alt: "Paper-cutout illustration of an ancient household sharing time and company" },
  later: { file: "later-life", title: "The things that stay.", caption: "Familiar company, remembered places, and a slower rhythm.", alt: "Paper-cutout illustration of an older Alexandrian with visitors and familiar belongings" },
  memorial: { file: "memorial", title: "Every life leaves a trace.", caption: "A story remembered, however long or brief.", alt: "Quiet paper-cutout still life with a memorial marker, olive branch and lamp" },
};

export function paperSceneFor(life: LifeState) {
  if (life.phase === "ended") return scenes.memorial;
  if (life.age === 0) return scenes.birth;
  if (life.age < 5) return scenes.childhood;
  const recent = life.journal.filter(entry => entry.age === life.age && entry.type === "event").map(entry => entry.id).join(" ");
  const context = `${life.pendingEventId ?? ""} ${recent}`;
  if (life.age >= 60) return scenes.later;
  if (/letters|reading|copyist|learn|written|study|reckon/.test(context)) return scenes.learning;
  if (life.age >= 18 && /household|family|generations|partner|child|company/.test(context)) return scenes.family;
  if (life.age >= 18 && life.flags.sailed && !life.flags.retired) return scenes.sea;
  if (life.age >= 18) return scenes.work;
  return life.age >= 12 ? scenes.learning : scenes.childhood;
}

export default function PaperScene({ life, compact }: { life: LifeState; compact: boolean }) {
  const scene = paperSceneFor(life);
  return <figure className={`scene-image paper-scene ${compact ? "paper-in-play" : ""} ${life.phase === "ended" ? "paper-memorial" : ""}`}>
    <div className="paper-scene-copy"><span className="paper-scene-kicker">{life.phase === "ended" ? "A LIFE REMEMBERED" : "THE SCENE OF YOUR LIFE"}</span><h2>{scene.title}</h2><p>{scene.caption}</p></div>
    <img key={scene.file} src={`/assets/paper/${scene.file}.webp`} alt={scene.alt} fetchPriority="high" />
    <figcaption>Alexandria · One life, another age.</figcaption>
  </figure>;
}
