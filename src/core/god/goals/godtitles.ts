// The titles of the god (01-power.md §7 "ฉายาของพระเจ้า"): six names the world gives the player, judged when a life ends from what the god did in that life. They belong to
// the player, not to the character (the titles of a life are titles.ts), and they are kept in `meta.godTitles` of the lineage for the collection (ending/collection.ts).
// The numbers of the table are the params of the data (`data.god.epithets`): they are read from there, not written twice.
import type { Ctx } from '../../game';
import type { LifeState } from '../../types';
import { tablesOf } from '../../world';
import { actsOf } from '../acts/state';
import { lifeChronicle } from '../stats';
import { godData, count } from '../state';
import type { Facts } from './facts';

/** Large and greater miracles of the destroying line (04-miracles.md §2 "ใหญ่" and §3: MR-17 meteor, MR-18 the land that swallows, MR-19 flood, MR-22 wrath). */
export const BIG_DESTROYERS: readonly string[] = ['MR-17', 'MR-18', 'MR-19', 'MR-22'];

type Params = Record<string, number>;
const paramsOf = (ctx: Ctx, title: string): Params => godData(ctx).epithets.find((e) => e.title === title)?.params ?? {};

/** Fates of the life on an event of mark ⭐ that came true: a speed-up (×>1) whose event happened after it was set, or a slow-down (×<1) whose event has not happened since. */
function starFates(ctx: Ctx): number {
  const fates = actsOf(ctx.state).fates;
  let n = 0;
  const tb = tablesOf(ctx);
  for (const e of lifeChronicle(ctx)) {
    if (e.kind !== 'miracle' || e.id !== 'MR-25' || !e.target) continue;
    const id = e.target.replace(/^event:/, '');
    if (tb.info.get(id)?.mark !== '⭐') continue;
    const f = fates[id];
    if (!f) continue;
    const happened = ctx.state.world.happened[id];
    if (f.mul > 1 ? happened !== undefined && happened >= f.year : happened === undefined || happened < f.year) n++;
  }
  return n;
}

/** The tests of the six, by the title. `f` holds the facts of the life at death (belief, age). */
const TEST: Record<string, (ctx: Ctx, f: Facts, p: Params) => boolean> = {
  ผู้ให้แสง: (ctx, f, p) => {
    const faith = count(ctx, 'l.spent.faith');
    return faith > 0 && faith >= p.ratio * count(ctx, 'l.spent.dread') && f.belief >= p.belief;
  },
  // the document says "ตัวละครอยู่ถึงวัยผู้เฒ่า": the elder age of the vows (GV-01)
  ผู้คุ้มครองเงียบ: (ctx, f, p) => count(ctx, 'l.spent.faith') + count(ctx, 'l.spent.dread') < p.maxSpent && f.elder,
  ผู้พิพากษา: (ctx, f, p) => {
    const dread = count(ctx, 'l.spent.dread');
    return dread > 0 && dread >= count(ctx, 'l.spent.faith') && f.belief >= p.beliefMin;
  },
  ผู้ทำลาย: (ctx, _f, p) => lifeChronicle(ctx).filter((e) => e.kind === 'miracle' && BIG_DESTROYERS.includes(e.id)).length >= p.bigDestroys,
  ผู้ถูกชิงชัง: (_ctx, f, p) => f.belief <= p.belief,
  ผู้ลิขิต: (ctx, _f, p) => starFates(ctx) >= p.starFates,
};

/** The titles of the god this life earned, in the order of the table. */
export function godTitlesOf(ctx: Ctx, _life: LifeState, f: Facts): string[] {
  return godData(ctx)
    .epithets.filter((e) => TEST[e.title]?.(ctx, f, e.params))
    .map((e) => e.title);
}
