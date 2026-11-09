import { useId, useMemo, useState } from "react";
import type { ActivityAvailability, Choice, LifeState, WorldPack } from "../src/types.ts";
import { compactSkillPreview, compactSkillView } from "./compact-skill.ts";
import ImpactValue from "./ImpactValue.tsx";
import PixelIcon from "./PixelIcon.tsx";
import "./compact-skill.css";

export default function CompactSkillPanel({ life, world, activities = [], choice, previewOnly = false, onOpenTree }: {
  life: LifeState; world: WorldPack; activities?: readonly ActivityAvailability[]; choice?: Choice | null;
  previewOnly?: boolean; onOpenTree?: () => void;
}) {
  const model = useMemo(() => compactSkillPreview(world, life, choice, activities), [world, life, choice, activities]);
  const [selection, setSelection] = useState<{ lifeKey: string; branch: string } | null>(null);
  const selectorId = useId();
  const lifeKey = JSON.stringify([life.worldFingerprint, life.seed]);
  if (!model.nodes.length) return null;
  const { branch: activeBranch, nodes, branches } = compactSkillView(model, life, selection?.lifeKey === lifeKey ? selection.branch : undefined, previewOnly);
  return <aside className={`compact-skills${previewOnly ? " is-preview" : ""}${branches.length < 2 ? " is-single-branch" : ""}`} aria-label={previewOnly ? "Skill branch preview" : "Skill progress"}>
    <header><div><span className="eyebrow">{choice ? "CHOICE PREVIEW" : "YOUR PROGRESS"}</span><h3>{previewOnly ? "Affected skills" : "Skill paths"}</h3></div>{onOpenTree && <button type="button" onClick={onOpenTree}>Full tree <span aria-hidden="true">↗</span></button>}</header>
    {!previewOnly && !model.previewing && <div className="compact-branch-selector"><label htmlFor={selectorId}>Branch</label><select id={selectorId} value={activeBranch} onChange={event => setSelection({ lifeKey, branch: event.target.value })}>{model.branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></div>}
    {choice && <p className="compact-skill-preview-label">{choice.text}</p>}
    {!nodes.length ? <p className="compact-skill-empty">This option has no direct skill change. Read the option for its other effects.</p> : <div className="compact-skill-branches">{branches.map(branch => <section className={`compact-skill-branch${nodes.some(node => node.branch === branch && model.affected.has(node.id)) ? " is-affected" : ""}`} key={branch}>
      <h4>{branch}</h4><div className="compact-skill-path">{nodes.filter(node => node.branch === branch).sort((a, b) => a.tier - b.tier).map(node => {
        const change = model.changes.find(change => change.id === node.id);
        return <div className={`compact-skill-node is-${node.state}${change ? " is-highlighted" : ""}${choice && !model.context.has(node.id) ? " is-muted" : ""}`} key={node.id} title={`${node.label}: ${Number(node.value.toFixed(2))}/${node.max}. ${node.state}${node.requirements.length ? `. Requires ${node.requirements.map(item => `${item.label} ${item.required}`).join(", ")}` : ""}`}>
          <span className="compact-skill-name"><PixelIcon name={node.id} size={16} /><span>{node.label}</span><strong>{Number(node.value.toFixed(1))}<small>/{node.max}</small></strong></span>
          <meter min={node.min} max={node.max} value={node.value} aria-label={`${node.label} proficiency`} />
          <span className="compact-skill-state">{change ? <><span>Possible change</span><ImpactValue min={change.min} max={change.max} /></> : <><span>{node.state}</span>{node.requirements.length > 0 && <span>{node.requirements.map(item => `${item.label} ${item.required}`).join(" · ")}</span>}</>}</span>
        </div>;
      })}</div>
    </section>)}</div>}
    {!previewOnly && <p className="compact-skill-help">Practice and decisions develop these paths. Preview a choice to light up its branch.</p>}
  </aside>;
}
