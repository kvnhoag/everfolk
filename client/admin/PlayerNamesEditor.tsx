import { useEffect, useState } from "react";
import type { WorldPack } from "../../src/types.ts";
import { applyNamePoolEdits } from "./name-pools.ts";

export default function PlayerNamesEditor({ world, onChange }: {
  world: WorldPack; onChange(patch: Partial<WorldPack>): void;
}) {
  const saved = (world.character?.playerNames ?? ["Damon"]).join("\n");
  const savedMale = (world.character?.identity?.namePools.male ?? []).join("\n");
  const savedFemale = (world.character?.identity?.namePools.female ?? []).join("\n");
  const [text, setText] = useState(saved);
  const [maleText, setMaleText] = useState(savedMale);
  const [femaleText, setFemaleText] = useState(savedFemale);
  const [error, setError] = useState("");
  useEffect(() => { setText(saved); setMaleText(savedMale); setFemaleText(savedFemale); setError(""); }, [world.id, saved, savedMale, savedFemale]);
  if (!world.character) return null;
  const separate = Boolean(world.character.identity);
  function apply() {
    try {
      const character = applyNamePoolEdits(world, separate ? { male: maleText, female: femaleText } : { player: text });
      onChange({ character });
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Check the name pool."); }
  }
  return <details className="admin-player-names">
    <summary>{separate ? `Male and female name pools · ${world.character.identity!.namePools.male.length} male / ${world.character.identity!.namePools.female.length} female` : `Player name pool · ${world.character.playerNames?.length ?? 1} names`}</summary>
    <p>{separate ? "New lives draw player and encountered-person names from the pool matching their recorded sex. Enter one name per line; keep the pools distinct. Existing lives retain their original names and world rules." : "Each new life draws one name. Enter one name per line; existing lives keep their original name."}</p>
    {separate ? <>
      <label className="admin-field"><span>Male names</span><textarea aria-label="Male name pool" rows={7} value={maleText} onChange={event => { setMaleText(event.target.value); setError(""); }} /></label>
      <label className="admin-field"><span>Female names</span><textarea aria-label="Female name pool" rows={7} value={femaleText} onChange={event => { setFemaleText(event.target.value); setError(""); }} /></label>
    </> : <label className="admin-field"><span>Player names</span><textarea aria-label="Player name pool" rows={7} value={text} onChange={event => { setText(event.target.value); setError(""); }} /></label>}
    {error && <p className="admin-error" role="alert">{error}</p>}
    <button type="button" className="admin-button admin-button-quiet" disabled={separate ? maleText === savedMale && femaleText === savedFemale : text === saved} onClick={apply}>{separate ? "Apply name pools" : "Apply name pool"}</button>
    {world.character.requireIntroductions && <p>People enter the life through introduction events. Their relationship options stay hidden until they have been met.</p>}
  </details>;
}
