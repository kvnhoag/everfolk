"use client";
import { useState } from "react";
import { useNpcSession } from "../hooks/useNpcSession.ts";
import type { NpcPerson } from "../../src/npc/types.ts";
import type { NpcSnapshot } from "../types/npc.ts";
import "../styles/npc-session.css";
import FreePlayBoosterModal from "../chain/FreePlayBoosterModal.tsx";
import npcWorld from "../../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import type { WorldPack } from "../../src/types.ts";
function NpcCard({
  npc,
  session,
  disabled,
  onSpeak,
  onLease,
}: {
  npc: NpcPerson;
  session: NpcSnapshot;
  disabled: boolean;
  onSpeak(message: string): void;
  onLease(revoke: boolean): void;
}) {
  const [message, setMessage] = useState("");
  const external = Boolean(session.externalControllers[npc.id]);
  const resources = npc.familyId
    ? {
        cash: session.life.economy!.cash,
        grain: session.life.demo!.household.grain,
        account: "Shared household",
      }
    : npc.role === "merchant"
      ? {
          cash: session.life.demo!.town.merchant.cash,
          grain: session.life.demo!.town.merchant.grain,
          account: "Shop",
        }
      : { cash: npc.cash, grain: npc.grain, account: "Personal" };
  return (
    <article className="npc-person">
      <header>
        <p>
          {npc.role.replaceAll("-", " ")} · {session.life.year - npc.born} years
        </p>
        <h2>{npc.introduced ? npc.name : "Not met yet"}</h2>
        <small>
          {npc.introduced
            ? external
              ? "External controller"
              : "Server controller"
            : "Will enter your life as you grow"}
        </small>
      </header>
      <p>{npc.goal}</p>
      <dl>
        <div>
          <dt>Health</dt>
          <dd>{npc.health}</dd>
        </div>
        <div>
          <dt>Knowledge</dt>
          <dd>{npc.skills.knowledge}</dd>
        </div>
        <div>
          <dt>Strength</dt>
          <dd>{npc.skills.strength}</dd>
        </div>
        <div>
          <dt>Endurance</dt>
          <dd>{npc.skills.endurance}</dd>
        </div>
        <div>
          <dt>{resources.account} cash</dt>
          <dd>{resources.cash} dr</dd>
        </div>
        <div>
          <dt>Grain</dt>
          <dd>{resources.grain}</dd>
        </div>
      </dl>
      {npc.introduced && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) {
                onSpeak(message);
                setMessage("");
              }
            }}
          >
            <label>
              Talk to {npc.name}
              <input
                value={message}
                maxLength={500}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about their concerns"
                disabled={disabled || external}
              />
            </label>
            <button disabled={disabled || external || !message.trim()}>
              Talk
            </button>
          </form>
          <details>
            <summary>Agent control</summary>
            <p>
              Attach one external agent for up to ten minutes. A missed turn
              uses a recorded fallback.
            </p>
            <button disabled={disabled} onClick={() => onLease(external)}>
              {external ? "Return to server control" : "Issue MCP access"}
            </button>
          </details>
        </>
      )}
    </article>
  );
}
export default function NpcSessionLab() {
  const { session, busy, error, start, act, download, lease } = useNpcSession();
  const [seed, setSeed] = useState("alexandria-five-people");
  const [booster, setBooster] = useState(false),
    [copied, setCopied] = useState("");
  return (
    <main className="npc-lab">
      <nav>
        <a href="/">← Everfolk</a>
        <span>Online NPC free play</span>
      </nav>
      <header className="npc-intro">
        <h1>Five people. One world.</h1>
        <p>
          Live alongside a core cast with their own needs, work and choices.
          This separate free-play session has no minting or on-chain actions.
        </p>
      </header>
      {!session ? (
        <form
          className="npc-start"
          onSubmit={(e) => {
            e.preventDefault();
            void start(seed);
          }}
        >
          <label>
            Starting seed
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              maxLength={256}
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Starting…" : "Begin an NPC life"}
          </button>
          <p>
            NPC actions are recorded for exact replay. Live model access is
            server-configured; rule-based characters work without it.
          </p>
        </form>
      ) : (
        <>
          <section className="npc-session-bar">
            <div>
              <h2>
                {session.life.character?.name} · Age {session.life.age}
              </h2>
              <p>
                Year {session.life.year} ·{" "}
                {session.life.phase === "ended"
                  ? "Life ended"
                  : session.npcProvider.status === "live"
                    ? `Live ${session.providerName} decisions`
                    : session.npcProvider.status === "waiting"
                      ? "Live provider not checked"
                      : "Rules active"}{" "}
                · {session.modelCalls}/{session.modelCallLimit} model calls
              </p>
              <p>
                Household: {session.life.economy?.cash} dr ·{" "}
                {session.life.demo?.household.grain} grain · Health{" "}
                {session.life.stats.health}
              </p>
            </div>
            <div className="npc-controls">
              <button
                disabled={
                  busy || session.npcTurnDone || session.life.phase !== "ready"
                }
                onClick={() => void act("turn")}
              >
                Let the NPCs decide
              </button>
              <button
                disabled={
                  busy || !session.npcTurnDone || session.life.phase !== "ready"
                }
                onClick={() =>
                  void act("step", { command: { type: "advance" } })
                }
              >
                Live another year
              </button>
              <button disabled={busy} onClick={() => void download()}>
                Export replay
              </button>
            </div>
          </section>
          <aside className="npc-provider-status" role="status">
            <p>
              {session.npcProvider.status === "live"
                ? "Live NPC provider connected. This NPC mode currently offers reward previews only."
                : "Live NPC provider unavailable or unverified. Rules keep your life playable; real NFT rewards and account credits are disabled."}
            </p>
            {session.providerName === "Laya" && (
              <p>
                Laya chooses actions and short authored responses. Free-form
                chat needs a generative provider.
              </p>
            )}
            <button disabled={busy} onClick={() => void act("check-provider")}>
              Check live connection
            </button>
          </aside>
          {session.life.phase === "choice" && (
            <section className="npc-choice">
              <h2>Your decision</h2>
              <p>
                {
                  session.life.journal.filter((e) => e.type === "event").at(-1)
                    ?.text
                }
              </p>
              {session.choices.map((c) => (
                <button
                  key={c.id}
                  disabled={busy}
                  onClick={() =>
                    void act("step", {
                      command: { type: "choose", choice: c.id },
                    })
                  }
                >
                  {c.text}
                </button>
              ))}
            </section>
          )}
          {session.life.phase === "ended" && (
            <section>
              <h2>A life remembered</h2>
              <p>
                Your NPCs do not mint NFTs. Open an offline preview of what this
                life could have earned.
              </p>
              <button onClick={() => setBooster(true)}>
                Open booster preview
              </button>
              <button
                disabled={busy}
                onClick={() => void start(crypto.randomUUID())}
              >
                Begin another NPC life
              </button>
              <FreePlayBoosterModal
                open={booster}
                life={session.life}
                world={npcWorld as unknown as WorldPack}
                onClose={() => setBooster(false)}
              />
            </section>
          )}
          <section className="npc-cast" aria-label="Core NPCs">
            {Object.values(session.slots).map((id) => (
              <NpcCard
                key={id}
                npc={session.people[id]}
                session={session}
                disabled={busy || session.life.phase === "ended"}
                onSpeak={(message) => void act("speak", { npcId: id, message })}
                onLease={(revoke) => void act("lease", { npcId: id, revoke })}
              />
            ))}
          </section>
          {lease && (
            <aside className="npc-access">
              <h2>One-time agent access</h2>
              <p>
                Use this session URL and the token as a Bearer authorization
                header in your MCP client. The token controls only the chosen
                NPC and expires in ten minutes.
              </p>
              <code>{`${typeof location !== "undefined" ? location.origin : ""}/api/npc/mcp?session=${session.id}`}</code>
              <button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(lease.token)
                    .then(() => setCopied("Token copied."))
                    .catch(() =>
                      setCopied(
                        "Clipboard access failed. Enable clipboard access in this browser and try again.",
                      ),
                    )
                }
              >
                Copy NPC token
              </button>
              <p role="status">{copied}</p>
            </aside>
          )}
          <section className="npc-offers">
            <h2>Offers for you</h2>
            {session.offers.length ? (
              session.offers.map((o) => (
                <article key={o.id}>
                  <p>
                    {session.people[o.npcId]?.name}:{" "}
                    {o.kind === "lesson"
                      ? "One literacy lesson"
                      : o.kind === "grain"
                        ? `${o.quantity} grain`
                        : `${o.quantity} dr of help`}{" "}
                    · {o.price} dr
                  </p>
                  <button
                    disabled={
                      busy ||
                      session.life.age < 12 ||
                      session.life.phase !== "ready"
                    }
                    onClick={() =>
                      void act("answer", { offerId: o.id, accept: true })
                    }
                  >
                    Accept
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act("answer", { offerId: o.id, accept: false })
                    }
                  >
                    Decline
                  </button>
                </article>
              ))
            ) : (
              <p>No open offers. People may make one when they act.</p>
            )}
          </section>
          <details className="npc-journal">
            <summary>Your life story</summary>
            {session.life.journal.slice(-12).map((e, i) => (
              <p key={`${e.id}-${i}`}>
                <small>Age {e.age}</small> · {e.text}
              </p>
            ))}
          </details>
          <section className="npc-record">
            <h2>Life together</h2>
            <ol>
              {session.events
                .slice(-20)
                .reverse()
                .map((e) => (
                  <li key={e.sequence}>
                    <small>
                      Age {e.age} · {e.kind}
                    </small>
                    <p>{e.text}</p>
                  </li>
                ))}
            </ol>
          </section>
          <details>
            <summary>Your work and training</summary>
            {session.activities.map((a) => (
              <button
                key={a.id}
                disabled={busy || session.life.phase !== "ready"}
                onClick={() =>
                  void act("step", { command: { type: "act", activity: a.id } })
                }
              >
                {a.text}
              </button>
            ))}
          </details>
        </>
      )}
      {busy && <p role="status">Resolving the session…</p>}
      {error && (
        <p role="alert" className="npc-error">
          {error}
        </p>
      )}
    </main>
  );
}
