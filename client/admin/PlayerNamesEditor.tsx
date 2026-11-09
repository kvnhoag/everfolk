import { useEffect, useState } from "react";
import type { WorldPack } from "../../src/types.ts";
import { validateWorld } from "../../src/validate.ts";

export default function PlayerNamesEditor({ world, onChange }: {
  world: WorldPack; onChange(patch: Partial<WorldPack>): void;
}) {
  const saved = (world.character?.playerNames ?? ["Damon"]).join("\n");
  const [text, setText] = useState(saved);
  const [error, setError] = useState("");
  useEffect(() => { setText(saved); setError(""); }, [world.id, saved]);
  if (!world.character) return null;
  function apply() {
    try {
      const playerNames = text.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
      const character = { ...world.character!, playerNames };
      validateWorld({ ...world, character });
      onChange({ character });
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Check the name pool."); }
  }
  return <details className="admin-player-names">
    <summary>Player name pool · {world.character.playerNames?.length ?? 1} names</summary>
    <p>Each new life draws one name. Enter one name per line; existing lives keep their original name.</p>
    <label className="admin-field"><span>Player names</span><textarea aria-label="Player name pool" rows={7} value={text} onChange={event => { setText(event.target.value); setError(""); }} /></label>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <button type="button" className="admin-button admin-button-quiet" disabled={text === saved} onClick={apply}>Apply name pool</button>
    {world.character.requireIntroductions && <p>People enter the life through introduction events. Their relationship options stay hidden until they have been met.</p>}
  </details>;
}
