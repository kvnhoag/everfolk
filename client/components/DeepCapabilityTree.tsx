import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import type { CapabilityProgress, CapabilityRule } from "../../src/deep-capabilities/types.ts";
import { evaluateCapabilities } from "../../src/deep-capabilities/evaluate.ts";
import { CAPABILITY_OPERATIONS } from "../../src/deep-capabilities/operations.ts";
import { displayProse } from "../models/display-prose.ts";
import "../styles/deep-capability-tree.css";

const FAMILIES = ["Farming", "Artisan", "Philosophy", "Trade"] as const;
const LANES = ["Cultivation", "Resilience", "Clothing", "Ceramics", "Sculpture", "Research", "Civic practice", "Commercial planning"];
const FUTURE_PATHS = [
  { title: "Military", text: "A deeper service and command path is not available in this revision. Existing soldier work keeps its own rules." },
  { title: "Seafaring", text: "Navigation and expedition capabilities are planned for a later revision." },
  { title: "Music and performance", text: "A deeper performance path is planned for a later revision." },
  { title: "Court and rulership", text: "Dedicated court-service and rulership capabilities are planned for a later revision." },
];
const CARD_WIDTH = 156, CARD_HEIGHT = 82, COLUMN_STEP = 184, ROW_STEP = 112, LEFT = 96, TOP = 65;
const number = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

function laneOf(rule: CapabilityRule): number {
  if (rule.id === "F3S") return 0;
  if (rule.id === "F3W") return 1;
  if (rule.specialization) { const lane = LANES.indexOf(rule.specialization); if (lane >= 0) return lane; }
  return rule.branch === "Farming" ? 0.5 : rule.branch === "Artisan" ? 3 : rule.branch === "Philosophy" ? 5.5 : 7;
}
function point(rule: CapabilityRule) { return { x: LEFT + (rule.depth - 1) * COLUMN_STEP, y: TOP + laneOf(rule) * ROW_STEP }; }
function primarySkill(rule: CapabilityRule): string | undefined { return Object.keys(rule.minimumProficiency)[0]; }
function proofActions(value: unknown, found = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) { for (const item of value) proofActions(item, found); return found; }
  for (const [key, item] of Object.entries(value)) {
    if (key === "actions" && Array.isArray(item)) {
      for (const action of item) if (typeof action === "string") found.add(action);
    } else proofActions(item, found);
  }
  return found;
}
function relevantWork(rule: CapabilityRule, world: WorldPack, activities: readonly ActivityAvailability[]): ActivityAvailability[] {
  const direct = proofActions(rule.proof), primary = primarySkill(rule);
  const score = (activity: ActivityAvailability): number => {
    let found = direct.has(activity.id) ? 3 : 0;
    for (const outcome of activity.outcomes) for (const effect of outcome.effects) {
      if (effect.type === "vocation") {
        if (direct.has(effect.action)) found = Math.max(found, 3);
        const action = world.vocations?.actions[effect.action];
        if (action?.kind === "capability") {
          const operation = CAPABILITY_OPERATIONS[action.operation];
          if (operation && direct.has(operation.action)) found = Math.max(found, 3);
          if (operation?.primary === primary) found = Math.max(found, 2);
        }
        if (action?.kind === "work" && action.primary === primary) found = Math.max(found, 2);
        if (action?.kind === "make" && world.vocations?.recipes[action.recipe]?.primary === primary) found = Math.max(found, 2);
      }
      if (effect.type === "skill" && effect.skill === primary && effect.delta > 0) found = Math.max(found, 1);
    }
    return found;
  };
  return activities.filter(activity => activity.available && score(activity) > 0).sort((a, b) => score(b) - score(a));
}

export interface CapabilityTreeProps {
  world: WorldPack;
  life: LifeState;
  activities: readonly ActivityAvailability[];
  onActivity: (id: string) => void;
  readOnly?: boolean;
}

/** Full learned-capability graph; numeric proficiencies stay in the node details. */
export default function CapabilityTree({ world, life, activities, onActivity, readOnly = false }: CapabilityTreeProps) {
  const rules = world.deepCapabilities?.rules ?? [];
  const recorded = life.deepCapabilities ?? { learned: {}, evidence: [] };
  const evaluation = useMemo(() => evaluateCapabilities({ skills: life.character?.skills ?? {}, stats: life.stats,
    reputation: life.demo?.reputation, year: life.year, state: recorded, rules }), [life, rules]);
  const [family, setFamily] = useState<string>("All");
  const [selectedId, setSelectedId] = useState(rules[0]?.id ?? "");
  const id = useId(), byId = new Map(rules.map(rule => [rule.id, rule]));
  const selected = byId.get(selectedId) ?? rules[0];
  const learned = (node: string) => Object.prototype.hasOwnProperty.call(recorded.learned, node);
  const stateFor = (rule: CapabilityRule): "learned" | "ready" | "locked" => learned(rule.id) ? "learned"
    : rule.prerequisites.all.every(learned) && evaluation.progress[rule.id]?.eligible ? "ready" : "locked";
  const learnedCount = rules.filter(rule => learned(rule.id)).length;
  const masteredCount = rules.filter(rule => rule.depth === 10 && learned(rule.id)).length;
  const width = LEFT + 9 * COLUMN_STEP + CARD_WIDTH + 28, height = TOP + 7 * ROW_STEP + CARD_HEIGHT + 28;
  if (!selected) return <p className="deep-capability-empty">This world has no deep capability tree.</p>;
  const progress: CapabilityProgress | undefined = evaluation.progress[selected.id];
  const work = relevantWork(selected, world, activities);
  const active = stateFor(selected);
  const select = (rule: CapabilityRule) => { setSelectedId(rule.id); setFamily(rule.branch); };
  return <section className="deep-capability-tree" aria-labelledby={`${id}-heading`}>
    <header className="deep-capability-heading">
      <div><span className="deep-capability-eyebrow">{readOnly ? "Reference" : "Learning through work"}</span><h3 id={`${id}-heading`}>Your capability paths</h3>
        <p>Practice builds proficiency. Completed work and evidence earn the next capability.</p></div>
      <p className="deep-capability-tally"><strong>{learnedCount} / {rules.length}</strong> learned{masteredCount > 0 && <span> · {masteredCount} specializations mastered</span>}</p>
    </header>
    <div className="deep-capability-toolbar" role="group" aria-label="Highlight a skill family">
      {["All", ...FAMILIES].map(item => <button type="button" key={item} aria-pressed={family === item} onClick={() => {
        setFamily(item); if (item !== "All" && selected.branch !== item) setSelectedId(rules.find(rule => rule.branch === item)?.id ?? selected.id);
      }}>{item === "All" ? "All paths" : item}</button>)}
      <span className="deep-capability-legend"><span>✓ Learned</span><span>○ Ready</span><span>Locked</span></span>
    </div>
    <p className="deep-capability-map-help" id={`${id}-help`}>The complete tree stays visible. Highlight a family, scroll across ten depths, and choose a capability to inspect every requirement.</p>
    <div className="deep-capability-layout">
      <div className="deep-capability-scroll" role="region" aria-label="Deep skill tree, ten prerequisite depths" aria-describedby={`${id}-help`} tabIndex={0}>
        <div className="deep-capability-board" style={{ width, height }}>
          {Array.from({ length: 10 }, (_, depth) => <span key={depth} className="deep-capability-depth" style={{ left: LEFT + depth * COLUMN_STEP, width: CARD_WIDTH }}>Depth {depth + 1}</span>)}
          {LANES.map((lane, index) => <span key={lane} className="deep-capability-lane" style={{ top: TOP + index * ROW_STEP }}>{lane}</span>)}
          <svg className="deep-capability-links" width={width} height={height} aria-hidden="true">
            {rules.flatMap(rule => rule.prerequisites.all.map(parentId => {
              const parent = byId.get(parentId); if (!parent) return null;
              const a = point(parent), b = point(rule), startX = a.x + CARD_WIDTH, startY = a.y + CARD_HEIGHT / 2, endY = b.y + CARD_HEIGHT / 2;
              const dim = family !== "All" && rule.branch !== family;
              return <path key={`${parentId}-${rule.id}`} className={`${learned(parentId) ? "is-earned" : ""}${dim ? " is-dim" : ""}`} d={`M ${startX} ${startY} C ${startX + 14} ${startY}, ${b.x - 14} ${endY}, ${b.x} ${endY}`} />;
            }))}
          </svg>
          {rules.map(rule => {
            const position = point(rule), status = stateFor(rule), dim = family !== "All" && rule.branch !== family;
            return <button type="button" key={rule.id} className={`deep-capability-node is-${status}${dim ? " is-dim" : ""}${selected.id === rule.id ? " is-selected" : ""}`}
              data-deep-capability-id={rule.id} data-depth={rule.depth} style={{ left: position.x, top: position.y, width: CARD_WIDTH, height: CARD_HEIGHT } as CSSProperties}
              aria-label={`${rule.title}, depth ${rule.depth}, ${status}`} aria-pressed={selected.id === rule.id} aria-controls={`${id}-details`} onClick={() => select(rule)}>
              <span className="deep-capability-node-code">{rule.id}<span>{status === "learned" ? "✓ Learned" : status === "ready" ? "○ Ready" : "Locked"}</span></span>
              <strong>{rule.title}</strong><span className="deep-capability-node-family">{rule.specialization ?? `${rule.branch} foundation`}</span>
            </button>;
          })}
        </div>
      </div>
      <aside className={`deep-capability-details is-${active}`} id={`${id}-details`} aria-label={`${selected.title} requirements`}>
        <p className="deep-capability-eyebrow">{selected.branch} · Depth {selected.depth}</p><h4>{selected.title}</h4><p className="deep-capability-detail-status">{active === "learned" ? "Learned through recorded work" : active === "ready" ? "Requirements met" : "Requirements to work toward"}</p>
        <h5>Required capabilities</h5>
        {selected.prerequisites.all.length ? <ul className="deep-capability-requirements">{selected.prerequisites.all.map(parentId => <li key={parentId} className={learned(parentId) ? "is-met" : "is-missing"}>
          <span aria-hidden="true">{learned(parentId) ? "✓" : "○"}</span><button type="button" onClick={() => { const parent = byId.get(parentId); if (parent) select(parent); }}>{byId.get(parentId)?.title ?? parentId}</button><span>{learned(parentId) ? "Learned" : "Required"}</span>
        </li>)}</ul> : <p className="deep-capability-small">A foundation: no earlier capability is required.</p>}
        <h5>Proficiency</h5><ul className="deep-capability-requirements">{Object.entries(selected.minimumProficiency).map(([skillId, minimum]) => {
          const current = life.character?.skills[skillId] ?? 0, met = current >= minimum;
          return <li key={skillId} className={met ? "is-met" : "is-missing"}><span aria-hidden="true">{met ? "✓" : "○"}</span><span>{world.character?.skills[skillId]?.label ?? skillId}</span><strong>{number(current)} / {minimum}</strong></li>;
        })}</ul>
        {selected.anyProficiency && <p className="deep-capability-small">Alternative proficiency routes: {selected.anyProficiency.map(option => Object.entries(option).map(([key, minimum]) => `${world.character?.skills[key]?.label ?? key} ${minimum}`).join(" + ")).join(" OR ")}.</p>}
        <h5>Demonstrated work</h5><p>{selected.proofDescription}</p><p className="deep-capability-proof-status">{learned(selected.id) ? `${recorded.learned[selected.id].evidenceIds.length} linked evidence records.` : progress?.proofSatisfied ? "Relevant evidence is recorded; check the remaining requirements." : "Complete the required work and keep its recorded result."}</p>
        <h5>What this unlocks</h5><p>{selected.rewardDescription}</p>
        <h5>{readOnly ? "Relevant work" : "Available work and practice"}</h5>
        {work.length ? <div className="deep-capability-work">{work.map(activity => <div key={activity.id}><p>{displayProse(activity.text)}</p><button type="button" disabled={readOnly} onClick={() => { if (!readOnly && activity.available) onActivity(activity.id); }}>{readOnly ? "Reference only" : "Choose this work"}</button></div>)}</div> : <p className="deep-capability-small">No matching work is available now. Inspect an earlier capability, check age and resources, or return after the next year.</p>}
      </aside>
    </div>
    <section className="deep-capability-future" aria-label="Future skill families"><h4>Other paths</h4><p>These extensions are unavailable. They do not block the supported paths above.</p><div>{FUTURE_PATHS.map(path => <details key={path.title}><summary>{path.title}<span>Unavailable</span></summary><p>{path.text}</p></details>)}</div></section>
  </section>;
}
