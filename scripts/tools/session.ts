// Builds and drives one game for the test tools (`npm run life`, `npm run play`, the debug page, the tool tests).
// Pure TypeScript: the caller loads the data (scripts/tools/node-data.ts in node, Vite imports in the browser).
//
// Systems come from `allSystems()` (src/core/systems.ts, filled by the lead as branches merge). The npc and text systems are
// added when the list does not hold them yet. If no `character` system is in the list, a toy life stands in (toy-character.ts).
// The life is made by `birth()` of the character system (src/core/character), or by `opts.birther`.
import { birth as characterBirth } from '../../src/core/character';
import { Game, versions, type Ctx, type GameData, type System } from '../../src/core/game';
import { newGame } from '../../src/core/state';
import { chooseStart, type StartPoint } from '../../src/core/start';
import { allSystems } from '../../src/core/systems';
import { npcSystem } from '../../src/core/npc';
import { textSystem } from '../../src/core/text';
import type { GameState, LifeState, LogEntry } from '../../src/core/types';
import { policyName, policyStep } from '../../src/core/god';
import type { ToolNote } from './report';
import { bearToy, resolveRace, toyDeath, type BirthRequest } from './toy-character';

/** The policies of docs/systems/god/06-implementation.md §4 (the same names as scripts/sim/sim-god.mjs; `ตีหมุด` is its ninth, the god who strikes the seals). */
export const POLICIES = ['เงียบ', 'เมตตา', 'ลงโทษ', 'ปั้นนิสัย', 'ให้ของ', 'เก็บพลัง', 'สุ่ม', 'เร่งจบ', 'ตีหมุด'] as const;
export type Policy = (typeof POLICIES)[number];

/** World year the world is run to before the first life is born (ศ.ม. 10,400 + this). The middle of the first era's end. */
export const DEFAULT_START_YEAR = 450;

export interface SessionOpts {
  seed: number;
  race?: string;
  country?: string;
  startYear?: number;
  policy?: Policy;
  persona?: string;
  /** The character system's way to make a life; defaults to the one found on the system, then the toy. */
  birther?: Birther;
}

export type Birther = (ctx: Ctx, req: BirthRequest) => LifeState | void;

export interface Session {
  game: Game;
  data: GameData;
  /** Notes for the reader of a report: which parts are stand-ins or have no effect yet. */
  notes: string[];
  opts: SessionOpts;
}

/** The policy of a session: the option, or the one a saved state kept. */
export function policyOf(s: Session): string | undefined {
  return s.opts.policy ?? (s.game.state.god.ext.policy as string | undefined);
}

/**
 * Lets the god system act under the policy of the session (a call after every beat). `policyStep` of the god system plays each life year once,
 * with the parts the acts registered (prayers, whispers); without a policy this does nothing, so a life without `--policy` is exactly the life of the
 * systems alone. Returns 1 when the policy was asked, else 0.
 */
export function afterBeat(s: Session): number {
  const policy = policyOf(s);
  if (!policy || !policyName(policy) || !s.game.state.life || s.game.state.life.dead) return 0;
  policyStep(s.game.ctx, policy);
  return 1;
}

function withSystem(list: System[], s: System): System[] {
  return list.some((x) => x.name === s.name) ? list : [...list, s];
}

/** The systems the tools run: the core list plus the parts this branch brings. */
export function toolSystems(): { systems: System[]; toy: boolean } {
  let list = withSystem(withSystem(allSystems(), npcSystem), textSystem);
  const toy = !list.some((s) => s.name === 'character');
  if (toy) list = withSystem(list, toyDeath);
  return { systems: list, toy };
}

/** The life maker of the character system; undefined when the list holds no character system (the toy stands in). */
export function findBirther(systems: System[]): Birther | undefined {
  if (!systems.some((s) => s.name === 'character')) return undefined;
  return (ctx, req) => {
    // the tools name a race by its story prefix (`hu`) or its id (`human`); the character system takes the id
    const race = req.race ? resolveRace(ctx, req.race).id : undefined;
    return characterBirth(ctx, { race, country: req.country });
  };
}

export function createSession(data: GameData, opts: SessionOpts): Session {
  const { systems, toy } = toolSystems();
  const notes: string[] = [];
  if (toy) notes.push('ยังไม่มีระบบตัวละคร: ใช้ตัวละครทดสอบแบบง่าย (เกิดแล้วแก่ตาย)');
  if (!systems.some((s) => s.name === 'world')) notes.push('ยังไม่มีระบบโลก: ไม่มีเหตุการณ์โลก NPC ที่ผูกเหตุการณ์จึงเปิดตามอายุเท่านั้น');
  if (!systems.some((s) => s.name === 'story')) notes.push('ยังไม่มีระบบเส้นเรื่อง: ชีวิตไม่เดินผ่านโหนด');
  const state = newGame(opts.seed, versions(data));
  const game = new Game(state, data, systems);
  if (opts.policy) {
    state.god.ext.policy = opts.policy;
    if (!systems.some((s) => s.name === 'god')) notes.push(`นโยบายพระเจ้า "${opts.policy}" บันทึกไว้แล้วแต่ยังไม่มีผล (ยังไม่มีระบบพระเจ้า)`);
  }
  if (opts.persona) state.god.ext.persona = opts.persona;
  game.init();
  let year = opts.startYear;
  const world = systems.find((x) => x.name === 'world');
  if (year === undefined && world && !toy) {
    // the start rule of world-time.md §8.1 needs the race first: draw it as the real birth would, on a scratch state
    const race = opts.race ? resolveRace(game.ctx, opts.race).id : scratchRace(data, opts.seed, systems);
    opts = { ...opts, race };
    const r = (data.races.items as { races?: RaceRow[] } | RaceRow[]);
    const row = (Array.isArray(r) ? r : r.races ?? []).find((x) => x.id === race);
    if (row) {
      const start: StartPoint = chooseStart(data, opts.seed, { adultAge: row.adultAge, elderAge: row.elderAge }, world);
      year = start.worldYear;
      state.god.ext.start = start as unknown as Record<string, unknown>;
    }
  }
  game.worldSteps(Math.round((year ?? DEFAULT_START_YEAR) / 10));
  return { game, data, notes, opts };
}

interface RaceRow {
  id: string;
  adultAge: number;
  elderAge: number;
}

function scratchRace(data: GameData, seed: number, systems: System[]): string {
  const g = new Game(newGame(seed, versions(data)), data, systems.filter((x) => x.name === 'character'));
  return characterBirth(g.ctx, {}).race;
}

/** Restores a saved state into a running game (play keeps the state in a file between commands). */
export function resumeSession(data: GameData, state: GameState, opts: SessionOpts): Session {
  const { systems } = toolSystems();
  return { game: new Game(state, data, systems), data, notes: [], opts };
}

/** Makes the main character (the real system's birth function, or the toy) and runs the birth hooks. */
export function startLife(s: Session): LifeState {
  const g = s.game;
  const req: BirthRequest = { race: s.opts.race, country: s.opts.country };
  const birther = s.opts.birther ?? findBirther(g.systems);
  if (birther) {
    const made = birther(g.ctx, req);
    if (made && typeof made === 'object' && 'hAge' in made) g.state.life = made;
  }
  if (!g.state.life) {
    if (birther) s.notes.push('ฟังก์ชันเกิดของระบบตัวละครไม่ได้วางชีวิต: ใช้ตัวละครทดสอบ');
    bearToy(g.ctx, req);
  }
  g.born();
  return g.state.life!;
}

/** The notes the tools took of the game (kept in `god.ext` so a saved `play` keeps them). */
export function toolNotes(state: GameState): ToolNote[] {
  return (state.god.ext.toolNotes as ToolNote[] | undefined) ?? [];
}

/** One beat of the game (the character system logs a change of class itself since the M1 review fixes). */
export function stepBeat(g: Game): LogEntry[] {
  return g.beat();
}

/** Beats until the character dies or `max` pass; returns the number of beats run. `after` runs after each beat (the policy of the god). */
export function runToDeath(g: Game, max = 4 * 400, after?: () => void): number {
  let n = 0;
  while (g.state.life && !g.state.life.dead && n < max) {
    stepBeat(g);
    after?.();
    n++;
  }
  return n;
}

/** Does this entry stop `play`? With the attention system, its `call` entries; without it, any entry of level 3 (the old rule). */
export function isCall(g: Game, e: LogEntry): boolean {
  return g.systems.some((s) => s.name === 'attention') ? e.sys === 'attention' && e.kind === 'call' : e.level >= 3;
}

/**
 * Beats until the game calls the player (see `isCall`), the life ends, or `max` beats pass; returns the number of beats run
 * and the entry that called.
 */
export function runToCall(g: Game, max = 4 * 400, after?: () => void): { beats: number; stoppedBy: 'call' | 'death' | 'limit'; call?: LogEntry } {
  let beats = 0;
  while (beats < max) {
    if (!g.state.life || g.state.life.dead) return { beats, stoppedBy: 'death' };
    const mark = g.state.logN;
    stepBeat(g);
    after?.();
    beats++;
    const call = g.state.log.find((e) => e.n >= mark && isCall(g, e));
    if (call) return { beats, stoppedBy: g.state.life?.dead ? 'death' : 'call', call };
  }
  return { beats, stoppedBy: 'limit' };
}
