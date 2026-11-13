import type { WorldPack } from "../../src/types.ts";
import { displayProse } from "../models/display-prose.ts";

/** Static reference only: browsing cannot award progress or perform actions. */
export default function WikiLibrary({world,onSkills}:{world:WorldPack;onSkills?():void}) {
 return <section className="wiki-library"><h3>Game reference</h3><p>Browse all possibilities here. Your life panels show progress earned in the current run.</p>
 {onSkills ? <button className="secondary-button" type="button" onClick={onSkills}>All skills &amp; requirements ↗</button> : <a className="secondary-button" href="/skills">All skills &amp; requirements ↗</a>}
 <details><summary>Occupations · {world.character?.jobs.length ?? 0}</summary>{world.character?.jobs.map(job=><article key={job.id}><h4>{job.title}</h4><p>{displayProse(job.description)}</p><p>Age {job.minAge}+{Object.entries(job.requirements??{}).map(([id,value])=>` · ${world.character?.skills[id]?.label??id} ${value}`).join("")}</p></article>)}</details>
 <details><summary>Accomplishments &amp; titles · {world.legacy?.achievements.length??0}</summary>{world.legacy?.achievements.map(item=><article key={item.id}><h4>{item.title}</h4><p>{displayProse(item.description)}</p><small>{item.kind}</small></article>)}</details>
 <details><summary>Activities &amp; training · {world.character?.activities.length??0}</summary>{world.character?.activities.map(item=><article key={item.id}><h4>{displayProse(item.text)}</h4><p>{item.category}{item.minAge!==undefined?` · Age ${item.minAge}+`:""}</p></article>)}</details>
 <details><summary>Backgrounds · {world.origins.length}</summary>{world.origins.map(item=><article key={item.id}><h4>{item.title}</h4><p>{displayProse(item.text)}</p></article>)}</details>
 <details><summary>Events &amp; decisions · {world.events.length}</summary>{world.events.map(item=><details key={item.id}><summary>{item.title}</summary><article><p>{displayProse(item.text)}</p>{item.choices.map(choice=><details key={choice.id}><summary>{displayProse(choice.text)}</summary>{choice.outcomes.map(outcome=><p key={outcome.id}>{displayProse(outcome.text)}</p>)}</details>)}</article></details>)}</details>
 <details><summary>Endings · {world.endings.length}</summary>{world.endings.map(item=><article key={item.id}><h4>{item.title}</h4><p>{displayProse(item.text)}</p></article>)}</details>
 <details><summary>Health reference · {world.health?.conditions.length??0}</summary>{world.health?.conditions.map(item=><article key={item.id}><h4>{item.title}</h4><p>{item.kind}</p></article>)}</details>
 </section>;
}
