import type { SkillState } from "./skill-tree.ts";

/** Each state has its own shape, so state never depends on colour alone. */
export default function SkillStateGlyph({ state }: { state: SkillState }) {
  const shape = state === "locked" ? <><rect x="2" y="5" width="8" height="6" /><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" /></>
    : state === "ready" ? <path d="M6 1.5 10.5 6 6 10.5 1.5 6Z" fill="none" />
    : state === "learning" ? <><path d="M6 1.5 10.5 6 6 10.5 1.5 6Z" fill="none" /><path d="M1.5 6h9L6 10.5Z" stroke="none" /></>
    : <path d="M6 .8 7.3 4.7 11.2 6 7.3 7.3 6 11.2 4.7 7.3.8 6 4.7 4.7Z" stroke="none" />;
  return <svg className={`cr-state-icon skill-state-glyph is-${state}`} viewBox="0 0 12 12" fill="currentColor" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">{shape}</svg>;
}
