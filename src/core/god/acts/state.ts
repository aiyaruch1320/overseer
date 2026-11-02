// What the acts of the god keep in the state. The contract (`GameState.god`) gives `light` `dread` `counters` `cooldowns` `prayers`
// `chronicle`; everything else lives in `god.ext.acts` (plain JSON, saved with the state). Cooldowns are world years at which the
// act can be used again: `state.god.cooldowns['MR-01']`.
import type { Ctx } from '../../game';
import type { GameState, LifeState } from '../../types';

export interface PrayerCard {
  /** Running number, the id the screen answers with. */
  n: number;
  kind: string;
  /** Tick (life year × 4 + quarter) it appeared and the tick it lapses. */
  tick: number;
  exp: number;
  /** The NPC who prays (`kin_sick`) or whom the prayer names (`vengeance`). */
  npc?: string;
  /** The player chose to stay silent (`นิ่ง`): the card stays until it lapses. */
  silent?: boolean;
  /** World year it appeared, for the chronicle. */
  year: number;
}

export interface ActiveWhisper {
  hint: string;
  /** Decisions left (ระวัง กล้าเถิด) or the battle count (จุดอ่อนของศัตรู). */
  left?: number;
  /** Life age it ends (จงไป จงอยู่ สางเรื่อง). */
  until?: number;
  target?: string;
  /** Life age it was sent. */
  at: number;
}

export interface Pending {
  n: number;
  id: string;
  args: Record<string, unknown>;
  /** Beats until the day. */
  left: number;
  /** What was paid, for the refund of a cancelled omen. */
  paid: { faith: number; dread: number };
  year: number;
}

export interface Fate {
  mul: number;
  /** World year the multiplier ends. */
  until: number;
  /** Which line paid. */
  line: 'faith' | 'dread';
  year: number;
}

/** A change the economy and the combat systems of M3 read (`modsOf`). */
export interface Mod {
  id: string;
  /** `food` `medicine` `wood` `sea` `mercenary` `defense` `war-risk` `W` `C` */
  subject: string;
  country?: string;
  continent?: string;
  /** Multiplier of the price or amount, or an addition (`add`). */
  mul?: number;
  add?: number;
  from: number;
  /** World year it ends, absent for good. */
  until?: number;
  src: string;
}

export interface FlagTimer {
  country: string;
  flag: string;
  until: number;
}

export interface Deed {
  kind: string;
  id: string;
  country?: string;
  year: number;
  data?: Record<string, string | number | boolean | null>;
}

export interface ActsExt {
  v: 1;
  prayerN: number;
  pendingN: number;
  /** Tick a prayer kind was last raised. */
  recent: Record<string, number>;
  /** World year of the last prayer the god answered (given, refused or punished) and the world years prayers lapsed. */
  lastAnswer: number;
  lapsed: number[];
  /** hAge at which the god last punished someone (clarity, 03-dreams.md §3). */
  punishedAt?: number;
  /** Counters of the life the cap is counted for; a new life starts them again. */
  life: { key: string; mid: number; big: number; ruin: number; grand: number; switchLoss: number };
  /** The line paid last and the life year number (hAge) it was paid in (switching lines costs belief, 01-power.md §2). */
  lastLine?: { line: 'faith' | 'dread'; age: number };
  whisper: { age: number; used: string[]; sent: Record<string, number>; active: ActiveWhisper[]; free?: number };
  pending: Pending[];
  fates: Record<string, Fate>;
  mods: Mod[];
  timers: FlagTimer[];
  /** World year of the deed that opened GD-04 (MR-21). */
  gd04?: number;
  /** Things the miracles left in the world for the systems of M3 to find: guardians, hidden items, monsters, lesser ruins. */
  deeds: Deed[];
}

export const NEVER = -1e9;

export function fresh(): ActsExt {
  return {
    v: 1,
    prayerN: 0,
    pendingN: 0,
    recent: {},
    lastAnswer: NEVER,
    lapsed: [],
    life: { key: '', mid: 0, big: 0, ruin: 0, grand: 0, switchLoss: 0 },
    whisper: { age: -1, used: [], sent: {}, active: [] },
    pending: [],
    fates: {},
    mods: [],
    timers: [],
    deeds: [],
  };
}

export function actsOf(state: GameState): ActsExt {
  let e = state.god.ext.acts as ActsExt | undefined;
  if (!e) {
    e = fresh();
    state.god.ext.acts = e;
  }
  return e;
}

export const livingOf = (ctx: Ctx): LifeState | null => {
  const l = ctx.state.life;
  return l && !l.dead ? l : null;
};

export const lifeKey = (l: LifeState) => `${l.id}/${l.birthYear}`;

/** The counters of this life; they start again when the key of the life changes (a new life, an heir). */
export function lifeCounters(ctx: Ctx): ActsExt['life'] {
  const e = actsOf(ctx.state);
  const l = ctx.state.life;
  const key = l ? lifeKey(l) : '';
  if (e.life.key !== key) e.life = { key, mid: 0, big: 0, ruin: 0, grand: 0, switchLoss: 0 };
  return e.life;
}

/** The tick of the prayer clock: life year × 4 + quarter. */
export const tickOf = (ctx: Ctx): number => (ctx.state.life ? ctx.state.life.hAge * 4 + ctx.state.clock.quarter : 0);

export const yearOf = (ctx: Ctx): number => ctx.state.clock.worldYear;

/** Is the act free again (the world year of its cooldown reached)? */
export const ready = (ctx: Ctx, key: string): boolean => (ctx.state.god.cooldowns[key] ?? NEVER) <= yearOf(ctx);

export const startCooldown = (ctx: Ctx, key: string, years: number): void => {
  ctx.state.god.cooldowns[key] = yearOf(ctx) + years;
};
