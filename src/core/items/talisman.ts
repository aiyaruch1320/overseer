// The ancient talismans in the hands of NPCs (docs/systems/items/20-npc-talisman.md, ported from scripts/sim/sim-items.mjs `talisman`): 24 pieces,
// one each in the world, held by a buyer of one of six kinds, in omen or possession now and then, and gone to the ruin, a new buyer or peace by
// the exits of §5. A year runs in the world step (ten of them). Nothing here changes the events of the world (§1 rule 3); the log carries the stories.
import type { Ctx } from '../game';
import { write } from '../log';
import type { Rng } from '../rng';
import { RANK } from './data';
import { catalog } from './data';
import { worldOf, type TalismanWorld } from './world';
import type { Rarity } from '../data/types-items';

/** The cap of §2: ancient talismans in omen or possession at the same time (the next one waits in a collector's cabinet). */
export const CAP = 10;
/** The exit letters in the order of the data `exitOrder`: ก ขับไล่ · ข ปรองดอง · ค ยอมรับ · ง ขายต่อ · จ ทิ้งหรือฝัง. */
const EXITS = ['ก', 'ข', 'ค', 'ง', 'จ'];

/** The ids of the ancient talismans in the order the sim runs them: by tier (U, R, E, L), then by id. */
export function ancients(ctx: Ctx): { id: string; tier: Rarity }[] {
  return catalog(ctx)
    .itemList.filter((i) => i.cat === 'talisman')
    .map((i) => ({ id: i.id, tier: i.tier }))
    .sort((a, b) => RANK[a.tier] - RANK[b.tier] || a.id.localeCompare(b.id));
}

function data(ctx: Ctx) {
  return catalog(ctx).itemData.talisman;
}

function pickBuyer(ctx: Ctx, rng: Rng): number {
  return rng.weighted(data(ctx).npc.buyers.map((b) => b.weight));
}

/** At the beginning of the world: six pieces in NPC hands (§11 "เริ่มที่ 6 ชิ้น"), the rest in the ground. */
export function initTalismans(ctx: Ctx, rng: Rng = ctx.rng('items.talisman')): void {
  const t = worldOf(ctx).talisman;
  if (t.made) return;
  t.made = true;
  const list = ancients(ctx);
  const start = data(ctx).npc.sim.start;
  const chosen = new Set<number>();
  while (chosen.size < Math.min(start, list.length)) chosen.add(rng.int(0, list.length - 1));
  list.forEach((x, i) => {
    t.held[x.id] = chosen.has(i) ? { buyer: pickBuyer(ctx, rng), stage: 0, quiet: false } : 'ruin';
  });
}

export const activeCount = (t: TalismanWorld): number => Object.values(t.held).filter((h) => h !== 'ruin' && h.stage > 0).length;

/** One world year of the ancient talismans. `cap` is the ceiling of pieces in omen or possession (Infinity runs the sim of the document as it is). */
export function talismanYear(ctx: Ctx, rng: Rng = ctx.rng('items.talisman'), cap = CAP, log = true): void {
  const w = worldOf(ctx);
  const t = w.talisman;
  const d = data(ctx);
  const s = d.npc.sim;
  const buyers = d.npc.buyers;
  const list = ancients(ctx);
  const ruins = list.filter((x) => t.held[x.id] === 'ruin').length;
  let active = activeCount(t);
  for (const x of list) {
    const h = t.held[x.id];
    if (h === 'ruin') {
      if (rng.next() < (s.findPerYear * s.countries) / Math.max(1, ruins)) {
        t.held[x.id] = { buyer: pickBuyer(ctx, rng), stage: 0, quiet: false };
        t.found += 1;
        if (log) write(ctx.state, { sys: 'items', kind: 'talisman', id: x.id, data: { what: 'found', buyer: buyers[(t.held[x.id] as { buyer: number }).buyer].id }, level: 0 });
      }
      continue;
    }
    if (!h) continue;
    if (rng.next() < s.holderDeathPerYear) {
      // the holder dies: half the time the piece is sold on, half the time an heir keeps it from the start
      if (h.stage > 0) active -= 1;
      if (rng.next() < 0.5) {
        t.held[x.id] = { buyer: pickBuyer(ctx, rng), stage: 0, quiet: false };
        t.sold += 1;
      } else {
        h.stage = 0;
        h.quiet = false;
      }
      continue;
    }
    if (h.quiet) continue;
    const m = buyers[h.buyer].mult;
    const odds = d.odds.find((o) => o.tier === x.tier)!;
    if (h.stage === 0 && active < cap && rng.next() < odds.omen * m) {
      h.stage = 1;
      active += 1;
    } else if (h.stage === 1 && rng.next() < odds.possess * m) {
      h.stage = 2;
    } else if (h.stage === 2) {
      const order = d.npc.exitOrder.map((o) => o[0]);
      const wts = d.npc.exitWeights[buyers[h.buyer].id];
      const e = EXITS[rng.weighted(order.map((l) => wts[l]))];
      active -= 1;
      h.stage = 0;
      if (e === 'ก') {
        // exorcism: the spirit leaves the piece for a month and the piece goes back to the market (it keeps its holder here, as the document's sim does)
      } else if (e === 'ข') {
        h.quiet = true;
      } else if (e === 'ค') {
        h.quiet = true;
        t.accepted += 1;
      } else if (e === 'ง') {
        t.held[x.id] = { buyer: pickBuyer(ctx, rng), stage: 0, quiet: false };
        t.sold += 1;
      } else {
        t.held[x.id] = 'ruin';
        t.buried += 1;
      }
      if (log && e !== 'ก' && e !== 'ข') write(ctx.state, { sys: 'items', kind: 'talisman', id: x.id, data: { what: e === 'ค' ? 'accepted' : e === 'ง' ? 'sold' : 'buried' }, level: 0 });
    }
  }
  t.years += 1;
  t.active = activeCount(t);
}

/** The world step: ten years. */
export function talismanStep(ctx: Ctx, years = 10): void {
  const rng = ctx.rng('items.talisman');
  for (let i = 0; i < years; i++) talismanYear(ctx, rng);
}
