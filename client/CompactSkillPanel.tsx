import { memo, useId, useMemo, useState } from "react";
import type { ActivityAvailability, Choice, LifeState, WorldPack } from "../src/types.ts";
import { compactSkillPreview, compactSkillView } from "./compact-skill.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import PixelIcon from "./PixelIcon.tsx";
import { formatSkillValue, skillGrowthProfile } from "./skill-growth.ts";
import { displayProse } from "./display-prose.ts";
import SkillStateGlyph from "./SkillStateGlyph.tsx";
import "./skill-growth.css";
import "./creator-tokens.css";
import "./compact-skill.css";

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
  const model = useMemo(() => previewOnly ? null : compactSkillPreview(world, life, undefined, activities), [previewOnly, world, life, activities]);
  const [selection, setSelection] = useState<{ lifeKey: string; branch: string } | null>(null);
  const selectorId = useId();
  const lifeKey = JSON.stringify([life.worldFingerprint, life.seed]);
  if (previewOnly) return choice ? <ChoicePreview world={world} life={life} choice={choice} /> : null;
  if (!model || !model.nodes.length) return null;
  const { branch: activeBranch, nodes, branches, selectableBranches } = compactSkillView(model, life, selection?.lifeKey === lifeKey ? selection.branch : undefined);
  const openWiki = onOpenWiki ?? onOpenTree;
  return <aside className={`compact-skills${branches.length < 2 ? " is-single-branch" : ""}`} aria-label="Skill progress">
    <header><div><span className="eyebrow">YOUR PROGRESS</span><h3>Skill paths</h3></div>{openWiki && <button type="button" onClick={openWiki}>Skill wiki <span aria-hidden="true">↗</span></button>}</header>
    {nodes.length > 0 && <div className="compact-branch-selector"><label htmlFor={selectorId}>Branch</label><select id={selectorId} value={activeBranch} onChange={event => setSelection({ lifeKey, branch: event.target.value })}>{selectableBranches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></div>}
    {!nodes.length ? <p className="compact-skill-empty">No skills unlocked yet. Check the skill wiki for requirements.</p> : <div className="compact-skill-branches">{branches.map((branch, index) => <section className="compact-skill-branch" key={branch}>
      <h4><span className="cr-index" aria-hidden="true">{String((selectableBranches.indexOf(branch) + 1) || index + 1).padStart(2, "0")}</span><span>{branch}</span></h4><div className="compact-skill-path">{nodes.filter(node => node.branch === branch).sort((a, b) => a.tier - b.tier).map(node => {
        const growth = skillGrowthProfile(world, life, node.id);
        return <div className={`compact-skill-node is-${node.state}`} key={node.id} title={`${node.label}: ${formatSkillValue(node.value, node.max)}/${node.max}. ${node.state}${node.requirements.length ? `. Requires ${node.requirements.map(item => `${item.label} ${item.required}`).join(", ")}` : ""}${growth && !growth.atCap ? `. Learning pace: ${growth.percent}%` : ""}`}>
          <span className="compact-skill-name"><PixelIcon name={node.id} size={16} /><span>{node.label}</span><strong>{formatSkillValue(node.value, node.max)}<small>/{node.max}</small></strong></span>
          <meter min={node.min} max={node.max} value={node.value} aria-label={`${node.label} proficiency`} />
          <span className="compact-skill-state"><span><SkillStateGlyph state={node.state} />{node.state}</span>{node.requirements.length > 0 && <span>{node.requirements.map(item => `${item.label} ${item.required}`).join(" · ")}</span>}</span>
          {growth && !growth.atCap && growth.multiplier < 0.5 && <small className="compact-skill-growth">Learning pace {growth.percent}%</small>}
        </div>;
      })}</div>
    </section>)}</div>}
    {nodes.length > 0 && <p className="compact-skill-help">Practice and decisions can improve your skills.</p>}
  </aside>;
}
