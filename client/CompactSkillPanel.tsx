import { useId, useMemo, useState } from "react";
import type { ActivityAvailability, Choice, LifeState, WorldPack } from "../src/types.ts";
import { compactSkillPreview, compactSkillView } from "./compact-skill.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import PixelIcon from "./PixelIcon.tsx";
import { formatSkillValue, skillGrowthProfile } from "./skill-growth.ts";
import "./skill-growth.css";
import "./compact-skill.css";

export default function CompactSkillPanel({ life, world, activities = [], choice, previewOnly = false, onOpenTree }: {
  life: LifeState; world: WorldPack; activities?: readonly ActivityAvailability[]; choice?: Choice | null;
  previewOnly?: boolean; onOpenTree?: () => void;
}) {
  // The sidebar shows observed proficiency without revealing a choice's growth modifiers.
  const model = useMemo(() => compactSkillPreview(world, life, undefined, activities), [world, life, activities]);
  const [selection, setSelection] = useState<{ lifeKey: string; branch: string } | null>(null);
  const selectorId = useId();
  const lifeKey = JSON.stringify([life.worldFingerprint, life.seed]);
  if (previewOnly) return choice ? <aside className="compact-skills is-preview is-single-branch" aria-label="Choice preview">
    <header><span className="eyebrow">CHOICE PREVIEW</span></header>
    <p className="compact-skill-preview-label">{choice.text}</p>
    <section className="choice-preview-effects" aria-label="Stat, skill and other effects"><ChoiceImpact choice={choice} life={life} world={world} showSkillChanges emptyText="No immediate change." /></section>
  </aside> : null;
  if (!model.nodes.length) return null;
  const { branch: activeBranch, nodes, branches } = compactSkillView(model, life, selection?.lifeKey === lifeKey ? selection.branch : undefined);
  return <aside className={`compact-skills${branches.length < 2 ? " is-single-branch" : ""}`} aria-label="Skill progress">
    <header><div><span className="eyebrow">YOUR PROGRESS</span><h3>Skill paths</h3></div>{onOpenTree && <button type="button" onClick={onOpenTree}>Full tree <span aria-hidden="true">↗</span></button>}</header>
    <div className="compact-branch-selector"><label htmlFor={selectorId}>Branch</label><select id={selectorId} value={activeBranch} onChange={event => setSelection({ lifeKey, branch: event.target.value })}>{model.branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></div>
    {!nodes.length ? <p className="compact-skill-empty">No skills to display.</p> : <div className="compact-skill-branches">{branches.map(branch => <section className="compact-skill-branch" key={branch}>
      <h4>{branch}</h4><div className="compact-skill-path">{nodes.filter(node => node.branch === branch).sort((a, b) => a.tier - b.tier).map(node => {
        const growth = skillGrowthProfile(world, life, node.id);
        return <div className={`compact-skill-node is-${node.state}`} key={node.id} title={`${node.label}: ${formatSkillValue(node.value, node.max)}/${node.max}. ${node.state}${node.requirements.length ? `. Requires ${node.requirements.map(item => `${item.label} ${item.required}`).join(", ")}` : ""}${growth && !growth.atCap ? `. Learning pace: ${growth.percent}%` : ""}`}>
          <span className="compact-skill-name"><PixelIcon name={node.id} size={16} /><span>{node.label}</span><strong>{formatSkillValue(node.value, node.max)}<small>/{node.max}</small></strong></span>
          <meter min={node.min} max={node.max} value={node.value} aria-label={`${node.label} proficiency`} />
          <span className="compact-skill-state"><span>{node.state}</span>{node.requirements.length > 0 && <span>{node.requirements.map(item => `${item.label} ${item.required}`).join(" · ")}</span>}</span>
          {growth && !growth.atCap && growth.multiplier < 0.5 && <small className="compact-skill-growth">Learning pace {growth.percent}%</small>}
        </div>;
      })}</div>
    </section>)}</div>}
    <p className="compact-skill-help">Practice and decisions develop these paths.</p>
  </aside>;
}
