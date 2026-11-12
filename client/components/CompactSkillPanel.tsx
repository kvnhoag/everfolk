import { memo, useMemo } from "react";
import type { ActivityAvailability, Choice, LifeState, WorldPack } from "../../src/types.ts";
import { compactSkillPreview } from "../models/compact-skill.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import PixelIcon from "./PixelIcon.tsx";
import { formatSkillValue, skillGrowthProfile } from "../models/skill-growth.ts";
import { displayProse } from "../models/display-prose.ts";
import "../styles/skill-growth.css";
import "../styles/compact-skill.css";

/** Read-only effects without building the separate sidebar skill model. */
export const ChoicePreview = memo(function ChoicePreview({ life, world, choice }: { life: LifeState; world: WorldPack; choice: Choice }) {
  return <aside className="compact-skills is-preview is-single-branch" aria-label="Choice preview" tabIndex={0}>
    <header><span className="eyebrow">CHOICE PREVIEW</span></header>
    <p className="compact-skill-preview-label">{displayProse(choice.text)}</p>
    <section className="choice-preview-effects" aria-label="Stat, skill and other effects"><ChoiceImpact choice={choice} life={life} world={world} showSkillChanges emptyText="No immediate change." /></section>
  </aside>;
});

export default function CompactSkillPanel({ life, world, activities = [], choice, previewOnly = false, onOpenTree, onOpenWiki }: {
  life: LifeState; world: WorldPack; activities?: readonly ActivityAvailability[]; choice?: Choice | null;
  previewOnly?: boolean; onOpenTree?: () => void; onOpenWiki?: () => void;
}) {
  // The sidebar shows observed proficiency without revealing a choice's growth modifiers.
  const fullModel = useMemo(() => previewOnly ? null : compactSkillPreview(world, life, undefined, activities), [previewOnly, world, life, activities]);
  const model = useMemo(() => {
    if (!fullModel) return null;
    const nodes=fullModel.nodes.filter(node=>node.value>node.min);
    return {...fullModel,nodes,branches:fullModel.branches.filter(branch=>nodes.some(node=>node.branch===branch))};
  },[fullModel]);
  if (previewOnly) return choice ? <ChoicePreview world={world} life={life} choice={choice} /> : null;
  if (!model) return null;
  return <aside className={"compact-skills is-single-branch"} aria-label="Skill progress">
    <details className="compact-skill-disclosure"><summary><span><span className="eyebrow">YOUR PROGRESS</span><span className="skill-paths-title">Skill paths</span></span><span className="skill-disclosure-arrow" aria-hidden="true" /></summary>
    <div className="compact-your-skills"><h3>Your skills</h3>
    {!model.nodes.length ? <p className="compact-skill-empty">No skills learned in this life yet. Explore the Wiki for future paths.</p> : <div className="compact-skill-branches">{model.branches.map(branch => <section className="compact-skill-branch" key={branch}>
      <h4>{branch}</h4><div className="compact-skill-path">{model.nodes.filter(node => node.branch === branch).sort((a, b) => a.tier - b.tier).map(node => {
        const growth = skillGrowthProfile(world, life, node.id);
        return <div className={`compact-skill-node is-${node.state}${node.value <= node.min ? " is-unlearned" : ""}`} key={node.id} title={`${node.label}: ${formatSkillValue(node.value, node.max)}/${node.max}. ${node.state}${node.requirements.length ? `. Requires ${node.requirements.map(item => `${item.label} ${item.required}`).join(", ")}` : ""}${growth && !growth.atCap ? `. Learning pace: ${growth.percent}%` : ""}`}>
          <span className="compact-skill-name"><PixelIcon name={node.id} size={16} /><span>{node.label}</span><strong>{formatSkillValue(node.value, node.max)}<small>/{node.max}</small></strong></span>
          <meter min={node.min} max={node.max} value={node.value} aria-label={`${node.label} proficiency`} />
          <span className="compact-skill-state"><span>{node.value <= node.min ? "Not learned" : node.state}</span>{node.requirements.length > 0 && <span>{node.requirements.map(item => `${item.label} ${item.required}`).join(" · ")}</span>}</span>
          {growth && !growth.atCap && growth.multiplier < 0.5 && <small className="compact-skill-growth">Learning pace {growth.percent}%</small>}
        </div>;
      })}</div>
    </section>)}</div>}
    {model.nodes.length > 0 && <p className="compact-skill-help">Practice and decisions can improve your skills.</p>}
    </div></details>
    {(onOpenTree || onOpenWiki) && <button type="button" className="compact-skill-tree-open" aria-label="Open skill tree" aria-haspopup="dialog" onClick={onOpenTree ?? onOpenWiki}>Skill tree <span aria-hidden="true">↗</span></button>}
  </aside>;
}
