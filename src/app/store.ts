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

export type Phase = 'loading' | 'start' | 'watch' | 'stop' | 'death';

export interface NewLife extends SessionOpts {}

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

  private session: Session | null = null;
  private data: GameData | null = null;
  private frame = 0;
  private last = 0;
  private carry = 0;

  /** The cards of the screen now (07-attention.md §2: two at most), read again after every change. */
  readonly cards = computed(() => (this.rev.value, this.session ? liveCards(this.session.game.state) : []));

  setData(data: GameData): void {
    this.data = data;
    if (this.phase.value === 'loading') this.phase.value = 'start';
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
    } else if (stop) {
      this.running.value = false;
      this.phase.value = 'stop';
      this.stopCall.value = stop;
    }
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

  saveLocal(): boolean {
    if (!this.state) return false;
    try {
      localStorage.setItem(SAVE_KEY, save(this.state));
      return true;
    } catch {
      return false;
    }
  }

  /** Loads the save of the browser; returns the data files whose version moved since (the replay may differ), or null when there is none. */
  loadLocal(): string[] | null {
    if (!this.data) return null;
    let text: string | null = null;
    try {
      text = localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
    if (!text) return null;
    const { state, stale } = load(text, versions(this.data));
    this.session = resumeSession(this.data, state, { seed: state.seed });
    this.stopCall.value = null;
    this.phase.value = state.life?.dead ? 'death' : 'watch';
    this.running.value = false;
    this.bump();
    return stale;
  }

  private bump(): void {
    this.rev.value++;
  }
}

/** The store of the page. */
export const store = new GameStore();
