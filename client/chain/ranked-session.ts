import { commandsHash } from "../../chain/hash.ts";
import { RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import { activationCommand, applyCommand } from "../../chain/validate-ranked.ts";
import { ObligationTracker, rankedObligations, stepCommand, type Obligation } from "../../chain/ranked-rules.ts";
import { createEngine } from "../../src/index.ts";
import type { Choice, Command, LifeEngine, LifeState, SaveFile, WorldPack } from "../../src/types.ts";
import type { Draw, LifeView, LivesContract, MintResult, SignedEvidence } from "./types.ts";


export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RankedSessionOptions {
  contract: LivesContract;
  /** Account id of the lives contract; it is the `source.contractId` of every influence. */
  contractId: string;
  verifyUrl: string;
  world: WorldPack;
  storage?: SessionStorage;
  /** Practice ledger only: check and sign the finished life in the browser instead of on the server. */
  verifyLocally?: (life: LifeView, save: SaveFile) => Promise<SignedEvidence>;
}

/** A ranked life: every step is saved, key decisions draw on chain, and there is no way to rewind. */
export interface RankedSession {
  readonly life: LifeView;
  readonly state: LifeState;
  readonly pendingDraw: boolean;
  readonly lastDraw: Draw | null;
  choices(): readonly Choice[];
  save(): string;
  /** Engine step, then the 5-year checkpoint and any key-decision draw. Influences only come from the chain. */
  dispatch(command: Command): Promise<void>;
  /**
   * Adopts a state produced by the ordinary game loop from this session's state: its new commands are replayed one by
   * one through `dispatch`, so each key decision draws on chain first. Replay stops at the first command the drawn
   * influences made impossible; the returned state (this session's) is what the player continues from.
   */
  sync(next: LifeState): Promise<LifeState>;
  finish(fetcher?: typeof fetch): Promise<SignedEvidence>;
  mint(signed: SignedEvidence, npcActionId: string): Promise<MintResult>;
  abandon(): Promise<void>;
}

export const rankedSaveKey = (lifeId: string) => `everfolk.ranked.${lifeId}`;

function browserStorage(): SessionStorage {
  if (typeof localStorage === "undefined") throw new Error("Ranked lives need browser storage to keep their progress.");
  return localStorage;
}

/** A chain action (draw or checkpoint) the life still owes; the life cannot move on until it lands. Retrying is safe. */
export class ChainActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainActionError";
  }
}

const CHAIN_RETRY = "The NEAR network didn't confirm in time. Your life is safe; try that again.";

class Session implements RankedSession {
  life: LifeView;
  state: LifeState;
  pendingDraw = false;
  lastDraw: Draw | null = null;
  private readonly engine: LifeEngine;
  private readonly options: RankedSessionOptions;
  private readonly storage: SessionStorage;
  private tracker: ObligationTracker;
  /** Draws and checkpoints owed at the end of the command log, oldest first. */
  private owed: Obligation[] = [];

  constructor(options: RankedSessionOptions, life: LifeView, state: LifeState, tracker = new ObligationTracker(), owed: Obligation[] = []) {
    this.options = options;
    this.storage = options.storage ?? browserStorage();
    this.engine = createEngine(options.world);
    this.life = life;
    this.state = state;
    this.tracker = tracker;
    this.owed = owed;
  }

  static engineFor(world: WorldPack): LifeEngine {
    return createEngine(world);
  }

  choices(): readonly Choice[] {
    return this.engine.getChoices(this.state);
  }

  save(): string {
    return this.engine.save(this.state);
  }

  private commands(): Command[] {
    return (JSON.parse(this.save()) as SaveFile).commands;
  }

  private persist(): void {
    this.storage.setItem(rankedSaveKey(this.life.life_id), this.save());
  }

  async applyFigures(): Promise<void> {
    for (const pick of this.life.figure_picks) this.state = this.engine.influence(this.state, activationCommand(pick, this.options.contractId));
    this.persist();
    this.owed.push(...this.tracker.at(this.state, this.commands().length));
    await this.settle();
  }

  async dispatch(command: Command): Promise<void> {
    if (command.type === "influence") throw new Error("Influences only come from the chain.");
    if (this.state.phase === "ended") throw new Error("This life has ended.");
    await this.settle(); // Anything still owed reaches the chain before the life moves on.
    const ageBefore = this.state.age;
    this.state = stepCommand(this.engine, this.state, command);
    this.persist();
    const step = this.commands().length;
    this.owed.push(...this.tracker.after(command, ageBefore, this.state, step), ...this.tracker.at(this.state, step));
    await this.settle();
  }

  async sync(next: LifeState): Promise<LifeState> {
    const mine = this.commands();
    const theirs = (JSON.parse(this.engine.save(next)) as SaveFile).commands;
    const continues = next.seed === this.state.seed && theirs.length >= mine.length &&
      mine.every((command, index) => JSON.stringify(command) === JSON.stringify(theirs[index]));
    if (!continues) throw new Error("This state does not continue this ranked life.");
    for (const command of theirs.slice(mine.length)) {
      if (this.state.phase === "ended") break;
      try {
        await this.dispatch(command);
      } catch (error) {
        if (error instanceof ChainActionError) throw error;
        break; // An on-chain influence changed what this command could do; the player continues from here.
      }
    }
    return this.state;
  }

  /** Pays every owed draw and checkpoint in order. After a failure, the chain is re-read: an action that landed counts. */
  private async settle(): Promise<void> {
    while (this.owed.length > 0) {
      const obligation = this.owed[0];
      try {
        await this.fulfil(obligation);
      } catch {
        if (!(await this.reconcile(obligation))) throw new ChainActionError(CHAIN_RETRY);
      }
      this.owed.shift();
    }
  }

  private async fulfil(obligation: Obligation): Promise<void> {
    const commands = this.commands();
    const hash = await commandsHash(commands, obligation.step);
    if (obligation.kind === "checkpoint") {
      await this.options.contract.checkpoint(this.life.life_id, obligation.step, hash);
      if (!this.life.checkpoints.some(c => c.step === obligation.step)) {
        this.life = { ...this.life, checkpoints: [...this.life.checkpoints, { step: obligation.step, commands_hash: hash }] };
      }
      return;
    }
    this.pendingDraw = true;
    try {
      this.adoptDraw(await this.options.contract.drawNpc(this.life.life_id, obligation.step, obligation.category, hash));
    } finally {
      this.pendingDraw = false;
    }
  }

  private async reconcile(obligation: Obligation): Promise<boolean> {
    let onChain: LifeView | null;
    try { onChain = await this.options.contract.getLife(this.life.life_id); } catch { return false; }
    if (!onChain) return false;
    if (obligation.kind === "checkpoint") {
      const landed = onChain.checkpoints.some(c => c.step === obligation.step);
      if (landed) this.life = { ...this.life, checkpoints: onChain.checkpoints };
      return landed;
    }
    const draw = onChain.draws.find(d => d.step === obligation.step);
    if (draw) this.adoptDraw(draw);
    return Boolean(draw);
  }

  private adoptDraw(draw: Draw): void {
    this.lastDraw = draw;
    if (!this.life.draws.some(d => d.step === draw.step)) this.life = { ...this.life, draws: [...this.life.draws, draw] };
    if (draw.token_id) {
      this.state = this.engine.influence(this.state, applyCommand(draw, this.options.contractId));
      this.persist();
    }
  }

  async finish(fetcher: typeof fetch = fetch): Promise<SignedEvidence> {
    if (this.state.phase !== "ended") throw new Error("This life has not ended yet.");
    await this.settle();
    if (this.options.verifyLocally) return this.options.verifyLocally(this.life, JSON.parse(this.save()) as SaveFile);
    const response = await fetcher(this.options.verifyUrl, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ life_id: this.life.life_id, save: this.save() }),
    });
    const body = (await response.json().catch(() => ({}))) as SignedEvidence & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "The life could not be verified. Please try again.");
    return body;
  }

  async mint(signed: SignedEvidence, npcActionId: string): Promise<MintResult> {
    let result: MintResult;
    try {
      result = await this.options.contract.mintLife(this.life.life_id, signed, npcActionId);
    } catch (error) {
      // The wallet or RPC may fail after the mint landed: if so, find the token instead of asking for a second mint.
      const minted = await this.findMinted().catch(() => null);
      if (!minted) throw error;
      result = minted;
    }
    this.storage.removeItem(rankedSaveKey(this.life.life_id));
    return result;
  }

  private async findMinted(): Promise<MintResult | null> {
    const life = await this.options.contract.getLife(this.life.life_id);
    if (life?.status !== "minted") return null;
    const token = (await this.options.contract.tokensOf(this.life.account_id)).find(t => t.extra.life_id === this.life.life_id);
    if (!token) return null;
    const { kind, figure_id, rarity, affection } = token.extra;
    return { token_id: token.token_id, kind, figure_id, rarity, affection };
  }

  async abandon(): Promise<void> {
    await this.options.contract.abandonLife(this.life.life_id);
    this.storage.removeItem(rankedSaveKey(this.life.life_id));
  }
}

/** Starts a ranked life: the contract chooses the seed and the figures that shape this world. */
export async function startRankedSession(options: RankedSessionOptions): Promise<RankedSession> {
  return beginRankedSession(options, await options.contract.startLife(RANKED_WORLD_VERSION));
}

/**
 * Plays a life that is already open on chain: resumes this device's save, or begins it if nothing has been recorded yet.
 * A life with on-chain draws or checkpoints but no local save cannot continue here (it would not match its record).
 */
export async function beginRankedSession(options: RankedSessionOptions, life: LifeView): Promise<RankedSession> {
  const saved = (options.storage ?? browserStorage()).getItem(rankedSaveKey(life.life_id));
  if (saved) return resumeRankedSession(options, life.life_id);
  if (life.draws.length > 0 || life.checkpoints.length > 0) {
    throw new Error("This device has no saved progress for this ranked life. Give it up here to start a new one.");
  }
  const session = new Session(options, life, Session.engineFor(options.world).start(life.seed));
  await session.applyFigures();
  return session;
}

/** Reloads the saved progress of a ranked life that is still alive on chain, reconciling it with the chain first. */
export async function resumeRankedSession(options: RankedSessionOptions, lifeId: string): Promise<RankedSession> {
  const life = await options.contract.getLife(lifeId);
  if (!life || life.status !== "alive") throw new Error("This ranked life is no longer in progress.");
  const saved = (options.storage ?? browserStorage()).getItem(rankedSaveKey(lifeId));
  if (!saved) throw new Error("This device has no saved progress for this ranked life.");
  const engine = Session.engineFor(options.world);
  const save = JSON.parse(saved) as SaveFile;
  if (save.seed !== life.seed) throw new Error("The saved progress belongs to a different life.");
  const { state, required, tracker } = rankedObligations(engine, life.figure_picks.length, save);
  const tip = save.commands.length;
  const met = (o: Obligation) => o.kind === "draw" ? life.draws.some(d => d.step === o.step) : life.checkpoints.some(c => c.step === o.step);
  const unmet = required.filter(o => !met(o));
  if (unmet.some(o => o.step < tip)) {
    throw new Error("This life's on-chain record is incomplete, so it can't be minted. Give it up here to start a new one.");
  }
  // Everything owed at the tip is settled again: the contract returns a landed draw or checkpoint unchanged for the same
  // step and hash, so a draw that landed before this device saved its effect is applied now, never drawn twice.
  const owed = required.filter(o => o.step === tip);
  const known = { ...life, draws: life.draws.filter(d => d.step < tip), checkpoints: life.checkpoints.filter(c => c.step < tip) };
  return new Session(options, known, state, tracker, owed);
}
