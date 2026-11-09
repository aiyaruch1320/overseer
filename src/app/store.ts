// The bridge between the core and the screens (docs/guide/code-plan.md §2 "ชั้นเชื่อม"): it holds the game, runs the clock in real seconds,
// sends the god's commands, and tells the screens what changed through Preact signals. Screens read the state through `view.ts`
// and never touch `src/core` directly; the core never imports from here.
//
// Time: one beat is SEC_PER_BEAT real seconds at the speed `normal` (×SPEED_MUL at `fast`). The attention system decides when the game
// calls the player: a call of kind `stop` pauses the clock (phase `stop`), a card goes on the screen while time runs (it stays in
// `liveCards` until answered or late). The death stops the clock (phase `death`); `nextLife` goes on with the lineage.
import { computed, signal } from '@preact/signals';
import { callsOf, isStop, liveCards } from '../core/attention';
import { command } from '../core/command';
import type { GameData } from '../core/game';
import { nextLife, type NextOpts } from '../core/lineage';
import { load, save } from '../core/save';
import type { Command, CommandResult, GameState, LogEntry, Settings } from '../core/types';
import { createSession, resumeSession, startLife, type Session, type SessionOpts } from '../../scripts/tools/session';
import { MAX_BEATS_PER_FRAME, SAVE_KEY, SEC_PER_BEAT, SPEED_MUL } from './tuning';
import { versions } from '../core/game';
import type { Llm } from '../core/llm';
import { summarizeDeath } from '../core/llm/summary-input';
import { askAhead } from '../core/story';
import { pack, unpack } from './save-text';
import { SAVE_WORDS } from './save-words';
import { clockOf } from './view';

export type Phase = 'loading' | 'start' | 'watch' | 'stop' | 'death';

export interface NewLife extends SessionOpts {}

/** What a save brought: the text for the player, and whether it worked. */
export type SaveOutcome = { ok: true; text: string; bytes: number } | { ok: false; text: string };

/** What a load brought. `stale` lists the data files that moved since the save was made (it opens, but a replay may differ). */
export type LoadOutcome = { ok: true; stale: string[] } | { ok: false; reason: string };

/** The key of the small note beside the save (when, and at what age): the start screen reads it without unpacking the save. */
const META_KEY = `${SAVE_KEY}.meta`;

export interface SaveMeta {
  at: string;
  age: number | null;
}

/** The one game of the page. */
export class GameStore {
  /** What the screen shows now. */
  readonly phase = signal<Phase>('loading');
  /** Grows on every change of the state: a screen that reads `rev.value` renders again after each beat or command. */
  readonly rev = signal(0);
  /** The clock runs (the player can pause it; a stop and the death pause it too). */
  readonly running = signal(false);
  /** The call that stopped the clock (`attention/call` with call `stop`), until the player goes on. */
  readonly stopCall = signal<LogEntry | null>(null);
  /** The last result of a command (a preview to confirm, or why it was refused). */
  readonly lastResult = signal<CommandResult | null>(null);
  /** A line the page shows over every screen until the player takes it in (the data moved since a save that was loaded). */
  readonly notice = signal<string | null>(null);

  private session: Session | null = null;
  private data: GameData | null = null;
  /** The LLM of the page's server (src/app/llm.ts), when it has one on. */
  private llm: Llm | undefined;
  private frame = 0;
  private last = 0;
  private carry = 0;

  /** The cards of the screen now (07-attention.md §2: two at most), read again after every change. */
  readonly cards = computed(() => (this.rev.value, this.session ? liveCards(this.session.game.state) : []));

  setData(data: GameData): void {
    this.data = data;
    if (this.phase.value === 'loading') this.phase.value = 'start';
  }

  setLlm(llm: Llm | undefined): void {
    this.llm = llm;
    // a save loaded at the death before the server answered still gets its summary
    if (this.phase.value === 'death') void this.summarize();
  }

  /**
   * At the death: the end summary of the LLM (llm/04-story.md §2) replaces the template's in the card when it comes. The game does not wait: the card shows the template
   * at once, and the screen reads the card again when the answer lands. A card that already holds an LLM text, or the player's switch off, asks nothing.
   */
  private async summarize(): Promise<void> {
    const data = this.data;
    const state = this.state;
    if (!this.llm || !data || !state) return;
    const s = await summarizeDeath(this.llm, data, state).catch(() => undefined);
    if (s?.source === 'llm' && this.state === state) this.bump();
  }

  get game() {
    return this.session?.game ?? null;
  }

  get state(): GameState | null {
    return this.session?.game.state ?? null;
  }

  get gameData(): GameData | null {
    return this.data;
  }

  /** A new world and its first life (the start screen hands the options of the wish and the start mode here). */
  newLife(opts: NewLife): void {
    if (!this.data) throw new Error('data not loaded');
    this.session = createSession(this.data, opts);
    startLife(this.session);
    this.stopCall.value = null;
    this.notice.value = null;
    this.phase.value = 'watch';
    this.bump();
    this.play();
  }

  /** After the death: the heir (or a newcomer when asked) goes on in the same world. */
  nextLife(opts: NextOpts = {}): ReturnType<typeof nextLife> | null {
    const g = this.game;
    if (!g) return null;
    const r = nextLife(g, opts);
    if (r.ok) {
      this.stopCall.value = null;
      this.phase.value = 'watch';
      this.play();
    }
    this.bump();
    return r;
  }

  // ---------- the clock ----------

  play(): void {
    if (!this.session || this.phase.value === 'death') return;
    if (this.state?.settings.speed === 'pause') this.setSettings({ speed: 'normal' });
    this.running.value = true;
    this.last = 0;
    if (!this.frame && typeof requestAnimationFrame !== 'undefined') this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  pause(): void {
    this.running.value = false;
  }

  /** The player goes on after a stop. */
  resume(): void {
    this.stopCall.value = null;
    if (this.phase.value === 'stop') this.phase.value = 'watch';
    this.play();
  }

  /** One beat now (the dev screens and the tests drive the clock by hand). Returns the calls it brought. */
  step(): LogEntry[] {
    const g = this.game;
    if (!g || !g.state.life || g.state.life.dead) return [];
    const mark = g.state.logN;
    g.beat();
    const calls = callsOf(g.state.log.filter((e) => e.n >= mark));
    const stop = calls.find(isStop);
    if (g.state.life?.dead) {
      this.running.value = false;
      this.phase.value = 'death';
      this.stopCall.value = stop ?? null;
      void this.summarize();
    } else if (stop) {
      this.running.value = false;
      this.phase.value = 'stop';
      this.stopCall.value = stop;
    }
    // the LLM director is asked ahead about the key points of the next life year; the clock does not wait for the answers (llm/04-story.md §3.4)
    if (this.llm && !g.state.life?.dead) void askAhead(g.ctx, this.llm.client).catch(() => undefined);
    this.bump();
    return calls;
  }

  private loop(t: number): void {
    this.frame = 0;
    if (!this.running.value) return;
    const speed = this.state?.settings.speed ?? 'normal';
    if (speed !== 'pause') {
      if (this.last) this.carry += ((t - this.last) / 1000) * SPEED_MUL[speed];
      let n = 0;
      while (this.carry >= SEC_PER_BEAT && n < MAX_BEATS_PER_FRAME && this.running.value) {
        this.carry -= SEC_PER_BEAT;
        this.step();
        n++;
      }
      if (n === MAX_BEATS_PER_FRAME) this.carry = 0;
    }
    this.last = t;
    if (this.running.value) this.frame = requestAnimationFrame((x) => this.loop(x));
  }

  // ---------- commands ----------

  /** A god command: `confirm: false` asks for the preview (no random roll, nothing changes), `confirm: true` runs it. */
  god(action: string, args: Record<string, unknown>, confirm: boolean): CommandResult {
    return this.send({ type: 'god', action: action as Extract<Command, { type: 'god' }>['action'], args, confirm });
  }

  setSettings(patch: Partial<Settings>): CommandResult {
    return this.send({ type: 'settings', patch });
  }

  private send(cmd: Exclude<Command, { type: 'advance' }>): CommandResult {
    const g = this.game;
    if (!g) return { ok: false, reason: 'ยังไม่มีเกม' };
    const r = command(g.ctx, cmd);
    this.lastResult.value = r;
    this.bump();
    return r;
  }

  // ---------- save ----------

  /** The state to the storage of the browser, packed (src/app/save-text.ts). A full storage or a refusing browser says so; the old save stays then. */
  async saveLocal(): Promise<SaveOutcome> {
    const st = this.state;
    if (!st) return { ok: false, text: `${SAVE_WORDS.failed}: ${SAVE_WORDS.nothing}` };
    const age = clockOf(st).age;
    let stored: string;
    try {
      stored = await pack(save(st));
    } catch {
      return { ok: false, text: SAVE_WORDS.failed };
    }
    try {
      localStorage.setItem(SAVE_KEY, stored);
    } catch (e) {
      const full = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
      return { ok: false, text: `${SAVE_WORDS.failed}: ${full ? SAVE_WORDS.full : SAVE_WORDS.blocked}` };
    }
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ at: new Date().toISOString(), age } satisfies SaveMeta));
    } catch {
      // the note is a convenience; the save itself is stored
    }
    return { ok: true, text: SAVE_WORDS.saved(age), bytes: stored.length };
  }

  /** When the browser has a save: the note beside it (null: no save). A save without a note answers with empty fields. */
  localSave(): SaveMeta | null {
    try {
      if (localStorage.getItem(SAVE_KEY) === null) return null;
      const raw = localStorage.getItem(META_KEY);
      const m = raw ? (JSON.parse(raw) as Partial<SaveMeta>) : {};
      return { at: typeof m.at === 'string' ? m.at : '', age: typeof m.age === 'number' ? m.age : null };
    } catch {
      return null;
    }
  }

  /**
   * Loads the save of the browser (packed or an older plain one). On success the game goes on from it, paused; `stale` lists the data files
   * whose version moved since (code-plan §5.3: the save opens, the screen warns that a replay may differ).
   */
  async loadLocal(): Promise<LoadOutcome> {
    if (!this.data) return { ok: false, reason: SAVE_WORDS.unreadable };
    let stored: string | null;
    try {
      stored = localStorage.getItem(SAVE_KEY);
    } catch {
      return { ok: false, reason: SAVE_WORDS.blocked };
    }
    if (!stored) return { ok: false, reason: SAVE_WORDS.unreadable };
    let text: string;
    try {
      text = await unpack(stored);
    } catch {
      return { ok: false, reason: SAVE_WORDS.noUnpack };
    }
    try {
      const { state, stale } = load(text, versions(this.data));
      this.session = resumeSession(this.data, state, { seed: state.seed });
      this.stopCall.value = null;
      this.phase.value = state.life?.dead ? 'death' : 'watch';
      this.running.value = false;
      this.notice.value = stale.length ? SAVE_WORDS.stale(stale) : null;
      this.bump();
      if (state.life?.dead) void this.summarize();
      return { ok: true, stale };
    } catch {
      return { ok: false, reason: SAVE_WORDS.unreadable };
    }
  }

  private bump(): void {
    this.rev.value++;
  }
}

/** The store of the page. */
export const store = new GameStore();
