"use client";
import { useMemo } from "react";
import { createEngine } from "../../src/engine.ts";
import type { WorldPack } from "../../src/types.ts";
import current from "../../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import CapabilityTree from "../components/CapabilityTree.tsx";
import EverfolkWordmark from "../components/EverfolkWordmark.tsx";
import "../styles/skill-tree-preview.css";

/** Public, read-only atlas: teammates can inspect the real catalog before a birth. */
export default function SkillTreePreview() {
  const world = current as unknown as WorldPack;
  const engine = useMemo(() => createEngine(world), [world]);
  const life = useMemo(() => engine.start("everfolk-skill-atlas"), [engine]);
  return <main className="skill-tree-preview">
    <header className="skill-tree-preview-header"><a href="/" aria-label="Everfolk home"><EverfolkWordmark /></a><a href="/">Play a life →</a></header>
    <section className="skill-tree-preview-intro"><h1>Paths of a life</h1><p>Four branches. Ten depths. A livelihood shaped by what you practice and what you do.</p><p>Choose a node to see its prerequisites, proof and practical reward. In a new life, open <strong>Skill tree</strong> to work toward it. Earlier saves keep their original world and show this map as a reference.</p></section>
    <CapabilityTree world={world} life={life} activities={engine.getActivities(life)} onActivity={() => {}} readOnly />
  </main>;
}
