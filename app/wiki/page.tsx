import WikiLibrary from "../../client/components/WikiLibrary.tsx";
import { sourceSummary, sourceScope } from "../../client/models/source-copy.ts";
import { loadLifeWorld } from "../../client/chain/life-world.ts";
import { LIVES_WORLD_VERSION } from "../../src/vocations/ids.ts";

export const metadata = { title: "Wiki · Everfolk" };

export default async function WikiPage() {
  const world = await loadLifeWorld(LIVES_WORLD_VERSION);

  return <main className="page-shell">
    <a className="secondary-button" href="/">← Back to Everfolk</a>
    <header className="chapter-heading">
      <div><h1>Everfolk Wiki</h1><p className="chapter-subtitle">{world.title}</p></div>
    </header>
    <WikiLibrary world={world} />
    {Boolean(world.sources?.length) && <section className="sources-list" aria-labelledby="wiki-sources">
      <h2 id="wiki-sources">History &amp; sources</h2>
      {world.sources?.map(source => <article key={source.id} id={`source-${source.id}`}>
        <span className="eyebrow">{source.kind} · {source.publisher}</span>
        <h3><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></h3>
        <p>{source.period} · {source.geography}</p>
        <p>{sourceSummary(source.summary)}</p>
        <p><strong>Scope:</strong> {sourceScope(source.limitations)}</p>
      </article>)}
    </section>}
  </main>;
}
