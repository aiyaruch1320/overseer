// MR-25 ลิขิต (god/04-miracles.md §4): the god bends the weight of one world event that shows an omen. Slowing (×0.2 to ×0.9) is paid in
// light, speeding (×1.1 to ×3) in dread; the price is the table's × |1 − multiplier|, at least half. The multiplier holds ten world years.
// A dragon's fall can be slowed to ×0.5 at the most and sped to ×2 at the most. An ending cannot be bent, only the events it needs.
import type { Ctx } from '../../game';
import type { Mark } from '../../data/types-events';
import type { EventId } from '../../types';
import { TUNING, holdEvent, tablesOf, weightOf } from '../../world';
import { candidateId, chanceOf } from '../../world/events';
import { registerMiracle, type Handler } from './miracles';
import { continentOf, godOf, lifeCountry } from './geo';
import { actsOf, viewActs, yearOf } from './state';

export interface FateTarget {
  id: EventId;
  name: string;
  mark: Mark;
  /** The index of the dragon whose fall it is. */
  dragon?: number;
}

const BASE_KEY: Record<Mark, 'star' | 'major' | 'minor'> = { '⭐': 'star', '●': 'major', '○': 'minor' };

/** The events that show an omen now and may be bent: the falls of dragons near their end, and the ⭐ and ● events that could happen at the next roll (an ○ only on the continent of the character). */
export function fateTargets(ctx: Ctx): FateTarget[] {
  const t = tablesOf(ctx);
  const w = ctx.state.world;
  if (w.ended) return [];
  const out: FateTarget[] = [];
  const live = w.dragons.filter((d) => d.alive).length;
  w.dragons.forEach((d, i) => {
    const def = t.dragons[i];
    if (!d.alive || live <= 1 || w.era < def.minEra || d.mood >= TUNING.fallBelow || w.happened[def.fallEvent] !== undefined) return;
    const info = t.info.get(def.fallEvent);
    out.push({ id: def.fallEvent, name: info?.name ?? def.fallEvent, mark: info?.mark ?? '●', dragon: i });
  });
  const home = lifeCountry(ctx);
  for (const ev of t.rolled) {
    if (candidateId(ctx, ev) !== ev.id) continue;
    if (ev.mark === '○' && !(home && (ev.home.world || ev.home.continents.includes(continentOf(home) as never) || ev.home.countries.some((c) => continentOf(c) === continentOf(home))))) continue;
    out.push({ id: ev.id, name: ev.name, mark: ev.mark });
  }
  return out;
}

const targetOf = (ctx: Ctx, args: Record<string, unknown>): FateTarget | undefined => {
  const id = args.event !== undefined ? String(args.event) : args.dragon !== undefined ? tablesOf(ctx).dragons[Number(args.dragon)]?.fallEvent : undefined;
  return id ? fateTargets(ctx).find((x) => x.id === id) : undefined;
};

const mulOf = (args: Record<string, unknown>): number => Number(args.mul);

/** The price in the line the direction pays: the table's price × |1 − multiplier|, at least half the table's price. */
export function fateCost(ctx: Ctx, mark: Mark, mul: number): { faith?: number; dread?: number } {
  const f = godOf(ctx).miracles.fate;
  const base = godOf(ctx).miracles.list.find((m) => m.id === 'MR-25')!.cost.fate![BASE_KEY[mark]];
  const n = Math.max(Math.ceil(base * f.minCostShare - 1e-9), Math.ceil(base * Math.abs(1 - mul) - 1e-9));
  return mul < 1 ? { faith: n } : { dread: n };
}

/** Why this multiplier cannot be put on this target. */
function rangeReason(ctx: Ctx, t: FateTarget, mul: number): string | null {
  const f = godOf(ctx).miracles.fate;
  if (!Number.isFinite(mul) || mul === 1) return 'ต้องระบุตัวคูณ (mul) ที่ไม่ใช่ 1';
  const [lo, hi] = mul < 1 ? f.slowRange : f.fastRange;
  if (mul < lo - 1e-9 || mul > hi + 1e-9) return mul < 1 ? `ชะลอได้ ×${f.slowRange[0]} ถึง ×${f.slowRange[1]}` : `เร่งได้ ×${f.fastRange[0]} ถึง ×${f.fastRange[1]}`;
  if (t.dragon !== undefined) {
    if (mul < f.dragonFloor) return `การล้มของมังกรชะลอได้ไม่ต่ำกว่า ×${f.dragonFloor}`;
    if (mul > f.dragonCap) return `การล้มของมังกรเร่งได้ไม่เกิน ×${f.dragonCap}`;
  }
  return null;
}

const handler: Handler = {
  line: 'fate',
  noReaction: true,
  cost: (ctx, _m, args) => {
    const t = targetOf(ctx, args);
    return t ? fateCost(ctx, t.mark, mulOf(args)) : {};
  },
  check: (ctx, _m, args) => {
    const t = targetOf(ctx, args);
    if (!t) return 'เหตุการณ์นั้นไม่มีลาง หรือเป็นฉากจบ ลิขิตไม่ได้';
    const bad = rangeReason(ctx, t, mulOf(args));
    if (bad) return bad;
    const f = viewActs(ctx.state).fates[t.id];
    if (f && f.until > yearOf(ctx)) return 'เหตุการณ์นั้นมีลิขิตอยู่แล้ว ซ้อนกันไม่ได้';
    return null;
  },
  preview: (ctx, _m, args) => {
    const t = targetOf(ctx, args)!;
    const mul = mulOf(args);
    const ev = tablesOf(ctx).byId.get(t.id);
    const now = ev && t.dragon === undefined ? chanceOf(ctx, ev) : undefined;
    return {
      target: t.id,
      targetName: t.name,
      mark: t.mark,
      mul,
      years: godOf(ctx).miracles.fate.maxYears,
      weight: weightOf(ctx, t.id),
      ...(now !== undefined ? { chance: { now, after: Math.min(1, now * mul) } } : {}),
    };
  },
  run: (ctx, _m, args) => {
    const t = targetOf(ctx, args)!;
    const mul = mulOf(args);
    const until = yearOf(ctx) + godOf(ctx).miracles.fate.maxYears;
    holdEvent(ctx, t.id, mul, until);
    actsOf(ctx.state).fates[t.id] = { mul, until, line: mul < 1 ? 'faith' : 'dread', year: yearOf(ctx) };
    return { target: `event:${t.id}`, result: `${t.name} ×${mul}` };
  },
};

registerMiracle('MR-25', handler);
