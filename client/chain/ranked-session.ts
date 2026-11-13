import { commandsHash } from "../../chain/hash.ts";
import { contractWorldVersion } from "../../chain/worlds.ts";
import { activationCommand, applyCommand, rankedWorldVersion } from "../../chain/validate-ranked.ts";
import { ObligationTracker, rankedObligations, stepCommand, type Obligation } from "../../chain/ranked-rules.ts";
import { createEngine } from "../../src/index.ts";
import { canonicalJson } from "../../src/random.ts";
import type { Choice, Command, LifeEngine, LifeState, SaveFile, WorldPack } from "../../src/types.ts";
import { DEFAULT_CHAIN_CONFIG } from "./config.ts";
import { PRACTICE_CONTRACT_ID } from "./practice-verifier.ts";
import type { Draw, LifeView, LivesContract, MintResult, StageMintResult, SignedEvidence } from "./types.ts";


export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RankedSessionOptions {
  contract: LivesContract;
  /** Account id of the lives contract; it is the `source.contractId` of every influence. */
  contractId: string;
  /** NEAR network id (defaults to "testnet"). */
  networkId?: string;
  /** True for in-browser practice ledgers so their saves never collide with live contracts. */
  practice?: boolean;
  verifyUrl: string;
  world: WorldPack;
  storage?: SessionStorage;
  /** Practice ledger only: check and sign the finished life in the browser instead of on the server. */
  verifyLocally?: (life: LifeView, save: SaveFile) => Promise<SignedEvidence>;
}

export interface RankedSaveScope {
  networkId?: string;
  contractId?: string | null;
  practice?: boolean;
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
  mintStages(signed: SignedEvidence, npcActionId: string, expectedFee?: string): Promise<StageMintResult>;
  chooseMint(slot: number): Promise<MintResult>;
  /** Resumes a committed mint without asking the verifier or paying a second fee. */
  recoverMint(): Promise<MintResult>;
  abandon(): Promise<void>;
}

export const DEFAULT_RANKED_SAVE_SCOPE: RankedSaveScope = {
  networkId: DEFAULT_CHAIN_CONFIG.networkId,
  contractId: DEFAULT_CHAIN_CONFIG.contractId,
  practice: false,
};

export const legacyRankedSaveKey = (lifeId: string) => `everfolk.ranked.${lifeId}`;

export function sessionSaveScope(
  options: Pick<RankedSessionOptions, "networkId" | "contractId" | "practice" | "verifyLocally">,
): RankedSaveScope {
  return {
    networkId: options.networkId ?? DEFAULT_CHAIN_CONFIG.networkId,
    contractId: options.contractId,
    practice: options.practice ?? Boolean(options.verifyLocally),
  };
}

export function rankedSaveKey(lifeId: string, scope: RankedSaveScope = DEFAULT_RANKED_SAVE_SCOPE): string {
  const network = encodeURIComponent(scope.networkId?.trim() || DEFAULT_CHAIN_CONFIG.networkId);
  const practice = Boolean(scope.practice);
  const contract = encodeURIComponent(
    scope.contractId?.trim() || (practice ? PRACTICE_CONTRACT_ID : DEFAULT_CHAIN_CONFIG.contractId),
  );
  const ledger = practice ? `practice:${contract}` : contract;
  return `everfolk.ranked.${network}:${ledger}:${encodeURIComponent(lifeId)}`;
}

export function parseRankedSave(raw: string): SaveFile | null {
  try {
    const parsed = JSON.parse(raw) as SaveFile;
    return parsed && typeof parsed === "object" && typeof parsed.seed === "string" && Array.isArray(parsed.commands)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function matchesRankedLife(
  save: SaveFile,
  life: Pick<LifeView, "seed" | "world_version" | "figure_picks">,
  contractId?: string | null,
): boolean {
  if (save.seed !== life.seed) return false;
  if (rankedWorldVersion(save) !== life.world_version) return false;
  if (contractId) {
    const resolvedContract = contractId.trim();
    if (life.figure_picks.some((pick, index) => canonicalJson(save.commands[index]) !== canonicalJson(activationCommand(pick, resolvedContract)))) {
      return false;
    }
    for (const command of save.commands) {
      if (command && typeof command === "object" && (command as { type?: unknown }).type === "influence") {
        const sourceContract = (command as { source?: { contractId?: unknown } }).source?.contractId;
        if (sourceContract !== resolvedContract) return false;
      }
    }
  }
  return true;
}

export function readScopedRankedSave(
  storage: Pick<SessionStorage, "getItem">,
  life: Pick<LifeView, "life_id" | "seed" | "world_version" | "figure_picks">,
  scope: RankedSaveScope = DEFAULT_RANKED_SAVE_SCOPE,
): { raw: string; migratedFromLegacy: boolean } | null {
  const scoped = storage.getItem(rankedSaveKey(life.life_id, scope));
  if (scoped !== null) return { raw: scoped, migratedFromLegacy: false };
  const legacy = storage.getItem(legacyRankedSaveKey(life.life_id));
  if (legacy === null) return null;
  const parsed = parseRankedSave(legacy);
  if (!parsed || !matchesRankedLife(parsed, life, scope.contractId)) return null;
  return { raw: legacy, migratedFromLegacy: true };
}

export function removeRankedSave(
  storage: Pick<SessionStorage, "getItem" | "removeItem">,
  life: Pick<LifeView, "life_id" | "seed" | "world_version" | "figure_picks">,
  scope: RankedSaveScope = DEFAULT_RANKED_SAVE_SCOPE,
): void {
  storage.removeItem(rankedSaveKey(life.life_id, scope));
  const legacyKey = legacyRankedSaveKey(life.life_id);
  const legacyRaw = storage.getItem(legacyKey);
  if (legacyRaw === null) return;
  const parsed = parseRankedSave(legacyRaw);
  if (parsed && matchesRankedLife(parsed, life, scope.contractId)) {
    storage.removeItem(legacyKey);
  }
}

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
const CHAIN_CONFLICT = "This ranked life has different progress recorded on NEAR. Continue from the device with that progress; this history cannot continue.";

const sessionEngines = new WeakMap<WorldPack, LifeEngine>();

class Session implements RankedSession {
  life: LifeView;
  state: LifeState;
  pendingDraw = false;
  lastDraw: Draw | null = null;
  private readonly engine: LifeEngine;
  private readonly options: RankedSessionOptions;
  private readonly storage: SessionStorage;
  private readonly scope: RankedSaveScope;
  private tracker: ObligationTracker;
  /** Draws and checkpoints owed at the end of the command log, oldest first. */
  private owed: Obligation[] = [];

  constructor(options: RankedSessionOptions, life: LifeView, state: LifeState, tracker = new ObligationTracker(), owed: Obligation[] = []) {
    this.options = options;
    this.storage = options.storage ?? browserStorage();
    this.scope = sessionSaveScope(options);
    this.engine = Session.engineFor(options.world);
    this.life = life;
    this.state = state;
    this.tracker = tracker;
    this.owed = owed;
  }

  static engineFor(world: WorldPack): LifeEngine {
    let engine = sessionEngines.get(world);
    if (!engine) {
      engine = createEngine(world);
      sessionEngines.set(world, engine);
    }
    return engine;
  }

  choices(): readonly Choice[] {
    return this.engine.getChoices(this.state);
  }

  save(): string {
    return this.engine.save(this.state);
  }

  private commands(): Command[] {
    return [...this.state.commands];
  }

  private persist(): void {
    const saveFile: SaveFile = {
      schemaVersion: 1,
      worldId: this.state.worldId,
      worldVersion: this.state.worldVersion,
      worldFingerprint: this.state.worldFingerprint,
      seed: this.state.seed,
      commands: [...this.state.commands],
    };
    this.storage.setItem(rankedSaveKey(this.life.life_id, this.scope), JSON.stringify(saveFile));
  }

  async applyFigures(): Promise<void> {
    for (const pick of this.life.figure_picks) this.state = this.engine.influence(this.state, activationCommand(pick, this.options.contractId));
    this.persist();
    this.owed.push(...this.tracker.at(this.state, this.commands().length));
    await this.settle();
  }

  async dispatch(command: Command): Promise<void> {
    if (this.life.status !== "alive") throw new Error("This life's mint is already committed; its progress cannot change.");
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
    await this.settle();
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
      } catch (error) {
        if (error instanceof ChainActionError) throw error;
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
      const draw = await this.options.contract.drawNpc(this.life.life_id, obligation.step, obligation.category, hash);
      this.assertDraw(obligation, draw, hash);
      this.adoptDraw(draw);
    } finally {
      this.pendingDraw = false;
    }
  }

  private async reconcile(obligation: Obligation): Promise<boolean> {
    let onChain: LifeView | null;
    try { onChain = await this.options.contract.getLife(this.life.life_id); } catch { return false; }
    if (!onChain) return false;
    const hash = await commandsHash(this.commands(), obligation.step);
    if (obligation.kind === "checkpoint") {
      const checkpoint = onChain.checkpoints.find(c => c.step === obligation.step);
      if (!checkpoint) return false;
      if (checkpoint.commands_hash !== hash) throw new ChainActionError(CHAIN_CONFLICT);
      this.life = { ...this.life, checkpoints: onChain.checkpoints };
      return true;
    }
    const draw = onChain.draws.find(d => d.step === obligation.step);
    if (!draw) return false;
    this.assertDraw(obligation, draw, hash);
    this.adoptDraw(draw);
    return true;
  }

  private assertDraw(obligation: Extract<Obligation, { kind: "draw" }>, draw: Draw, hash: string): void {
    if (draw.step !== obligation.step || draw.commands_hash !== hash || draw.category !== obligation.category) {
      throw new ChainActionError(CHAIN_CONFLICT);
    }
  }

  private adoptDraw(draw: Draw): void {
    if (draw.token_id) {
      const command = applyCommand(draw, this.options.contractId);
      const existing = this.state.commands[draw.step];
      if (existing) {
        if (canonicalJson(existing) !== canonicalJson(command)) throw new ChainActionError(CHAIN_CONFLICT);
      } else {
        if (this.state.commands.length !== draw.step) throw new ChainActionError(CHAIN_CONFLICT);
        this.state = this.engine.influence(this.state, command);
      }
      this.persist();
    }
    this.lastDraw = draw;
    if (!this.life.draws.some(d => d.step === draw.step)) this.life = { ...this.life, draws: [...this.life.draws, draw] };
  }

  async finish(fetcher: typeof fetch = fetch): Promise<SignedEvidence> {
    if (this.life.status !== "alive") throw new Error("This life's mint is already committed. Complete the mint instead of verifying it again.");
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
    return this.completeMint(result);
  }

  async mintStages(signed: SignedEvidence, npcActionId: string, expectedFee?: string): Promise<StageMintResult> {
    const result = await this.options.contract.mintStageFigures(this.life.life_id, signed, npcActionId, expectedFee);
    this.completeMint(result.tokens[0]);
    return result;
  }

  private async findMinted(): Promise<MintResult | null> {
    const life = await this.options.contract.getLife(this.life.life_id);
    if (life) this.life = life;
    return this.options.contract.mintResult(this.life.life_id);
  }

  private completeMint(result: MintResult): MintResult {
    this.life = { ...this.life, status: "minted" };
    removeRankedSave(this.storage, this.life, this.scope);
    return result;
  }

  async recoverMint(): Promise<MintResult> {
    if (this.state.phase !== "ended") throw new Error("This life has not ended yet.");
    const completed = await this.findMinted();
    if (completed) return this.completeMint(completed);
    if (this.life.status !== "minting") throw new Error("This life has no committed mint to complete.");
    try {
      return this.completeMint(await this.options.contract.retryMint(this.life.life_id));
    } catch (error) {
      const landed = await this.findMinted().catch(() => null);
      if (landed) return this.completeMint(landed);
      throw error;
    }
  }

  async chooseMint(slot: number): Promise<MintResult> {
    let result: MintResult;
    try { result = await this.options.contract.chooseMintSlot(this.life.life_id, slot); }
    catch (error) {
      const landed = await this.findMinted().catch(() => null);
      if (!landed) throw error;
      result = landed;
    }
    removeRankedSave(this.storage, this.life, this.scope);
    this.life = { ...this.life, status: "minted" };
    return result;
  }

  async abandon(): Promise<void> {
    await this.options.contract.abandonLife(this.life.life_id);
    removeRankedSave(this.storage, this.life, this.scope);
  }
}

function readOrMigrateRankedSave(
  storage: SessionStorage,
  life: LifeView,
  world: WorldPack,
  scope: RankedSaveScope,
): string | null {
  const found = readScopedRankedSave(storage, life, scope);
  if (!found) return null;
  if (found.migratedFromLegacy) {
    try {
      const state = Session.engineFor(world).load(found.raw);
      if (state.seed !== life.seed) return null;
    } catch {
      return null;
    }
    storage.setItem(rankedSaveKey(life.life_id, scope), found.raw);
    storage.removeItem(legacyRankedSaveKey(life.life_id));
  }
  return found.raw;
}

/** Starts a ranked life: the contract chooses the seed and the figures that shape this world. */
export async function startRankedSession(options: RankedSessionOptions): Promise<RankedSession> {
  return beginRankedSession(options, await options.contract.startLife(contractWorldVersion(options.world)));
}

/**
 * Plays a life that is already open on chain: resumes this device's save, or begins it if nothing has been recorded yet.
 * A life with on-chain draws or checkpoints but no local save cannot continue here (it would not match its record).
 */
export async function beginRankedSession(options: RankedSessionOptions, life: LifeView): Promise<RankedSession> {
  const storage = options.storage ?? browserStorage();
  const saved = readOrMigrateRankedSave(storage, life, options.world, sessionSaveScope(options));
  if (saved) return resumeRankedSession(options, life.life_id);
  if (life.status !== "alive") throw new Error("This life has a committed mint. Complete it from the ranked entry screen.");
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
  if (!life || life.status === "abandoned") throw new Error("This ranked life is no longer in progress.");
  const storage = options.storage ?? browserStorage();
  const saved = readOrMigrateRankedSave(storage, life, options.world, sessionSaveScope(options));
  if (!saved) throw new Error("This device has no saved progress for this ranked life.");
  const engine = Session.engineFor(options.world);
  const save = JSON.parse(saved) as SaveFile;
  if (save.seed !== life.seed) throw new Error("The saved progress belongs to a different life.");
  if (life.status !== "alive") {
    const state = engine.load(saved);
    if (state.phase !== "ended") throw new Error("This device has no finished save for the committed mint. Complete it from the ranked entry screen.");
    return new Session(options, life, state);
  }
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
