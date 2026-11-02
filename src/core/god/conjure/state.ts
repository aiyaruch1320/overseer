// What the conjuring keeps in the state (god/07-conjure.md): `god.ext.conjure` (plain JSON, saved with the state). The wait between two conjurings and the wait on a country are world-year
// cooldowns in `god.cooldowns` (`conjure` and `conjure.country.<id>`), like the waits of the miracles; the caps of the life are counted here and start again with each life.
import type { Ctx } from '../../game';
import type { GameState, LifeState } from '../../types';
import { lifeKey } from '../acts/state';

export interface PendingConjure {
  n: number;
  /** `<verb>.<core>.<scale>` */
  mix: string;
  args: Record<string, unknown>;
  /** Beats until the day. */
  left: number;
  quarters: number;
  paid: { faith: number; dread: number };
  year: number;
  /** The name the world will give it (chosen when paid, so a name is not taken twice while the omen waits). */
  name: string;
}

export interface ConjureLife {
  key: string;
  /** Conjurings that used the quota (the listed miracles do not). */
  used: number;
  continent: number;
  /** Mixes done in this life (`<verb>.<core>.<scale>`): the same one is not done twice. */
  mixes: string[];
}

export interface ConjureExt {
  v: 1;
  n: number;
  life: ConjureLife;
  pending: PendingConjure[];
  /** The next dream of the character is free (wake · shadow, "ฝันร่วม": "ตัวละครที่อยู่ได้ความฝันฟรีหนึ่งครั้ง"). The dream price reads it. */
  freeDream?: boolean;
}

export const fresh = (): ConjureExt => ({ v: 1, n: 0, life: { key: '', used: 0, continent: 0, mixes: [] }, pending: [] });

export function conjOf(state: GameState): ConjureExt {
  let e = state.god.ext.conjure as ConjureExt | undefined;
  if (!e) {
    e = fresh();
    state.god.ext.conjure = e;
  }
  return e;
}

/** The extension for a check or a preview, which must not change the state. */
export const viewConj = (state: GameState): ConjureExt => (state.god.ext.conjure as ConjureExt | undefined) ?? fresh();

/** The counters of the living life (they start again with each life). For a check or a preview nothing is stored. */
export function peekLife(ctx: Ctx): ConjureLife {
  const l = ctx.state.life;
  const e = viewConj(ctx.state).life;
  return l && e.key === lifeKey(l) ? e : { key: '', used: 0, continent: 0, mixes: [] };
}

export function lifeCount(ctx: Ctx, l: LifeState | null = ctx.state.life): ConjureLife {
  const e = conjOf(ctx.state);
  const key = l ? lifeKey(l) : '';
  if (e.life.key !== key) e.life = { key, used: 0, continent: 0, mixes: [] };
  return e.life;
}
