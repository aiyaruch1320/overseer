// Paired items (docs/systems/bonds/06-paired-items.md): two halves for two people, a small effect alone and the full effect when the bond
// is level 3 or more, both holders live and they share a continent. The halves are items of the life (`pr_*` ids of items.json); this file keeps
// the state of each pair (`full` `single` `memorial`).
import type { Ctx } from '../game';
import { write } from '../log';
import type { LifeState } from '../types';
import { bondsIndex } from './data';
import { extOf, isLive, levelOf, type BondsExt, type Tie } from './state';

/** The character is given a half of a pair for a tie, if the pair is not held already and the tie has no pair yet. */
export function grantPair(ctx: Ctx, life: LifeState, t: Tie, code: string): boolean {
  const e = extOf(life);
  const pair = bondsIndex(ctx).pairs.get(code);
  if (!pair || !isLive(t)) return false;
  if (e.pairs.some((p) => p.code === code || p.tie === t.id)) return false;
  const mine = pair.halves[0];
  if (!life.items.includes(mine)) life.items.push(mine);
  e.pairs.push({ code, tie: t.id, mine, status: statusOf(ctx, life, t) });
  write(ctx.state, { sys: 'bonds', kind: 'pair', id: code, data: { name: t.name, line: t.line, item: mine, other: pair.halves[1], status: statusOf(ctx, life, t) }, level: 1 });
  return true;
}

/** The state of the pair now (06 §1 rules 2 to 4). */
export function statusOf(ctx: Ctx, life: LifeState, t: Tie): 'full' | 'single' | 'memorial' {
  if (t.state === 'dead') return 'memorial';
  if (!isLive(t)) return 'single';
  const full = bondsIndex(ctx).data.paired.full;
  if (levelOf(ctx, t) < full.minLevel) return 'single';
  if (full.sameContinent && t.country.slice(0, 2) !== life.country.slice(0, 2)) return 'single';
  return 'full';
}

/** Once a year: the pairs are looked at again, and a memorial heals the heart a little (PR-10 gives +1 a year; 06 §4). */
export function pairsYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  for (const p of e.pairs) {
    const t = e.ties[p.tie];
    if (!t) continue;
    const was = p.status;
    p.status = statusOf(ctx, life, t);
    if (was !== p.status) write(ctx.state, { sys: 'bonds', kind: 'pair', id: p.code, data: { name: t.name, line: t.line, item: p.mine, status: p.status, from: was }, level: p.status === 'memorial' ? 1 : 0 });
    if (p.status === 'memorial' && p.code === 'PR-10') e.mind = Math.min(10, e.mind + 1);
  }
}

/** A pair of this code that is whole now (for the rules of other systems: combat, trade, the oath feather). */
export function fullPair(e: BondsExt, code: string): Tie | undefined {
  const p = e.pairs.find((x) => x.code === code && x.status === 'full');
  return p ? e.ties[p.tie] : undefined;
}
