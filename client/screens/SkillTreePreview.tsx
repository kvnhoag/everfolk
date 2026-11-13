"use client";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createEngine } from "../../src/engine.ts";
import type { WorldPack } from "../../src/types.ts";
import current from "../../worlds/demo/alexandria-lives-10.json" with { type: "json" };
import CapabilityTree from "../components/CapabilityTree.tsx";
import FigurePaths from "../components/FigurePaths.tsx";
import EverfolkBrand from "../components/EverfolkBrand.tsx";
import "../styles/skill-tree-preview.css";

type ReferenceTab = "skills" | "figures";
const tabs: readonly { id: ReferenceTab; label: string }[] = [{ id: "skills", label: "Skill tree" }, { id: "figures", label: "Historical Figures" }];

/** Public, read-only atlas: each reference has its own directly accessible tab. */
export default function SkillTreePreview({ initialTab = "skills" }: { initialTab?: ReferenceTab } = {}) {
  const world = current as unknown as WorldPack;
  const engine = useMemo(() => createEngine(world), [world]);
  const life = useMemo(() => engine.start("everfolk-skill-atlas"), [engine]);
  const activities = useMemo(() => engine.getActivities(life), [engine, life]);
  const [tab, setTab] = useState<ReferenceTab>(initialTab);
  const instanceId = useId();
  const tabRefs = useRef<Partial<Record<ReferenceTab, HTMLButtonElement | null>>>({});
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  }
  return <main className="skill-tree-preview">
    <header className="skill-tree-preview-header"><a className="skill-tree-preview-brand" href="/" aria-label="Everfolk home"><EverfolkBrand /></a><a href="/">Play a life →</a></header>
    <div className="skill-tree-preview-tabs" role="tablist" aria-label="Reference sections">{tabs.map((item, index) => <button key={item.id} ref={element => { tabRefs.current[item.id] = element; }} type="button" role="tab" id={`${instanceId}-tab-${item.id}`} aria-controls={`${instanceId}-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => navigateTabs(event, index)}>{item.label}</button>)}</div>
    <section className="skill-tree-preview-section" role="tabpanel" id={`${instanceId}-panel-skills`} aria-labelledby={`${instanceId}-tab-skills`} tabIndex={0} hidden={tab !== "skills"}>{tab === "skills" && <>
      <div className="skill-tree-preview-intro"><h1>Paths of a life</h1><p>Four branches. Ten depths. A livelihood shaped by what you practice and what you do.</p><p>Choose a node to see its prerequisites, proof and practical reward. In a new life, open <strong>Skill tree</strong> to work toward it. Earlier saves keep their original world and show this map as a reference.</p></div>
      <CapabilityTree world={world} life={life} activities={activities} onActivity={() => {}} readOnly />
    </>}</section>
    <section className="skill-tree-preview-section" role="tabpanel" id={`${instanceId}-panel-figures`} aria-labelledby={`${instanceId}-tab-figures`} tabIndex={0} hidden={tab !== "figures"}>{tab === "figures" && <>
      <div className="skill-tree-preview-intro"><h1>Historical Figures</h1><p>Explore eleven figures, inspect their cards and compare the work behind their contribution titles and defining achievements.</p><p>This is a reference preview. Follow these development paths in a life to earn their titles.</p></div>
      <FigurePaths world={world} life={life} activities={activities} onActivity={() => {}} readOnly />
    </>}</section>
  </main>;
}
