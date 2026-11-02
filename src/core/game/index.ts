// The loop (code-plan §6.3). Systems plug in as hooks; the loop owns the clocks and the order of calls.
// Beat = a quarter of a life year · life year = four beats · world step = ten world years.
import { beat, worldDecade, worldYearsPerLifeYear, BEATS_PER_LIFE_YEAR } from '../clock';
import { write } from '../log';
import { stream, type Rng } from '../rng';
import type { GameState, LogEntry } from '../types';

/** Generated data, loaded by the caller (node tools read data/gen/, the browser imports it). Keyed by file name without `.json`. */
export type GameData = Record<string, { version: string; items: unknown }>;

export interface Ctx {
  state: GameState;
  data: GameData;
  /** A named seed stream bound to this state (code-plan §6.2). */
  rng(name: string): Rng;
}

/** One system's hooks. Every hook is optional; order inside a phase follows SYSTEM_ORDER. */
export interface System {
  name: string;
  /** World creation (before any life). */
  init?(ctx: Ctx): void;
  /** One world step of ten years (code-plan §6.3 last row). */
  worldStep?(ctx: Ctx): void;
  /** A new main character is born (state.life was just set by the character system). */
  birth?(ctx: Ctx): void;
  /** One quarter of a life year. */
  beat?(ctx: Ctx): void;
  /** End of one life year. */
  lifeYear?(ctx: Ctx): void;
  /** The main character died (state.life.dead is set). */
  death?(ctx: Ctx): void;
}

/** The order systems run inside each phase; systems not listed run after, by name. */
export const SYSTEM_ORDER = ['world', 'npc', 'character', 'economy', 'bonds', 'travel', 'bondage', 'story', 'combat', 'items', 'god', 'attention', 'ending', 'lineage', 'text', 'llm'];

export function sortSystems(list: System[]): System[] {
  const rank = (s: System) => {
    const i = SYSTEM_ORDER.indexOf(s.name);
    return i < 0 ? SYSTEM_ORDER.length : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function makeCtx(state: GameState, data: GameData): Ctx {
  return { state, data, rng: (name) => stream(state.rng, state.seed, name) };
}

export function versions(data: GameData): GameState['data'] {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [`${k}.json`, v.version]));
}

function run(systems: System[], hook: Exclude<keyof System, 'name'>, ctx: Ctx) {
  for (const s of systems) (s[hook] as ((c: Ctx) => void) | undefined)?.call(s, ctx);
}

export class Game {
  readonly systems: System[];
  readonly ctx: Ctx;
  constructor(state: GameState, data: GameData, systems: System[]) {
    this.systems = sortSystems(systems);
    this.ctx = makeCtx(state, data);
  }
  get state() {
    return this.ctx.state;
  }

  init() {
    run(this.systems, 'init', this.ctx);
  }

  /** Advance the world without a character, n world steps. */
  worldSteps(n: number) {
    for (let i = 0; i < n; i++) {
      worldDecade(this.state.clock);
      run(this.systems, 'worldStep', this.ctx);
    }
  }

  /** Call after the character system has placed state.life. */
  born() {
    run(this.systems, 'birth', this.ctx);
  }

  /** One beat of the living character. Returns the entries written. */
  beat(): LogEntry[] {
    const st = this.state;
    const life = st.life;
    if (!life || life.dead) return [];
    const mark = st.logN;
    run(this.systems, 'beat', this.ctx);
    if (life.dead) return this.died(mark);
    const perBeat = worldYearsPerLifeYear(life.lifespan, life.race) / BEATS_PER_LIFE_YEAR;
    const r = beat(st.clock, perBeat);
    for (let i = 0; i < r.worldSteps; i++) run(this.systems, 'worldStep', this.ctx);
    if (r.lifeYearDone) {
      life.hAge += 1;
      run(this.systems, 'lifeYear', this.ctx);
    }
    if (life.dead) return this.died(mark);
    return st.log.filter((e) => e.n >= mark);
  }

  private died(mark: number): LogEntry[] {
    const st = this.state;
    write(st, { sys: 'game', kind: 'death', data: { cause: st.life!.dead!.cause, hAge: st.life!.dead!.hAge }, level: 3 });
    run(this.systems, 'death', this.ctx);
    return st.log.filter((e) => e.n >= mark);
  }

  /** Beats until the character dies or `max` beats pass. */
  runLife(max = 4 * 400): void {
    for (let i = 0; i < max && this.state.life && !this.state.life.dead; i++) this.beat();
  }
}

/** The `items` of one generated file, typed by the caller (`src/core/data/types-<group>.ts`). Throws when the file was not loaded. */
export function dataOf<T>(ctx: Ctx, name: string): T {
  const f = ctx.data[name];
  if (!f) throw new Error(`data/gen/${name}.json is not loaded`);
  return f.items as T;
}
