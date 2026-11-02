// How things come to the character and go (docs/systems/items/README.md §4 "ทางที่ได้อาวุธ", §5 wear, 11-item-system.md §7): the weapon a job starts with,
// the shop, wear and repair, and noticing what other systems give (a chest, a story, a drop go through the `grant` effect into `life.items`).
// Legendary weapons are one each in the world (08-legendary.md): the registry is in world.ts.
import type { Ctx } from '../game';
import { holds, idx } from '../character';
import type { Item, Rarity, Weapon } from '../data/types-items';
import { apply } from '../rules';
import type { LifeState } from '../types';
import { geo as travelGeo } from '../travel/data';
import { catalog, lookup, RANK } from './data';
import { note } from './log';
import { priceOf } from './price';
import { extOf } from './state';
import { armorScore, charmScore, defenseOf, describe, equip, isShield, nearAtHand, weaponScore } from './wield';
import { paybackYears, wantedTool, wearTools } from './tools';
import { ADULT_FROM, ARMOR_LOSSES_PER_POINT, DULL_AFTER, DULL_CHANCE, JOB_GROWTH, JOB_GROWTH_FROM, REPAIR_ARMOR, REPAIR_WEAPON, SHOP_ARMOR, SHOP_BUDGET, SHOP_CHARM, SHOP_E_W, SHOP_GAIN, SHOP_MAX, SHOP_TOOL, SHOP_WEAPON, TOOL_PAYBACK_MAX } from './tuning';
import { worldOf } from './world';

const src = { sys: 'items', stream: 'life.items' };

// ---------- noticing what came and what went ----------

/** Looks at `life.items` against what was seen the last time: logs the new, takes the legend into the registry, sets key flags, then picks what to wear. */
export function scan(ctx: Ctx, life: LifeState): void {
  const ex = extOf(life);
  const have: Record<string, number> = {};
  for (const id of life.items) have[id] = (have[id] ?? 0) + 1;
  let changed = false;
  const gone: string[] = [];
  for (const id of Object.keys(have)) {
    const more = have[id] - (ex.seen[id] ?? 0);
    for (let k = 0; k < more; k++) {
      changed = true;
      if (!gain(ctx, life, id)) gone.push(id);
    }
  }
  for (const id of Object.keys(ex.seen)) if ((have[id] ?? 0) < ex.seen[id]) changed = true;
  if (gone.length) life.items = life.items.filter((x) => !gone.includes(x));
  const next: Record<string, number> = {};
  for (const id of life.items) next[id] = (next[id] ?? 0) + 1;
  ex.seen = next;
  // a weapon that is not held any more cannot be what the character holds
  if (changed || (ex.wield && !life.items.includes(ex.wield))) equip(ctx, life);
}

/** One new piece. Returns false when it cannot stay (a legend that is held by another life, or one that broke for good). */
function gain(ctx: Ctx, life: LifeState, id: string): boolean {
  const e = lookup(ctx, id);
  const ex = extOf(life);
  if (!e) {
    note(ctx, 'unknown', id, {}, 0);
    return true;
  }
  if (e.kind === 'weapon' && e.w.group === 'legend') {
    const reg = worldOf(ctx).legend;
    const who = reg[id];
    const me = `${life.id}:${life.birthYear}`;
    if (who === 'broken' || (who && who !== 'free' && who !== me)) {
      note(ctx, 'vanish', id, { name: e.w.name, why: who === 'broken' ? 'broken' : 'held' }, 1);
      return false;
    }
    reg[id] = me;
    note(ctx, 'legend', id, { name: e.w.name }, 2);
    return true;
  }
  if (e.kind === 'item') {
    const i = e.i;
    if (i.cat === 'key') for (const f of i.flags ?? []) if (!life.flags.includes(f)) life.flags.push(f);
    if (i.cat === 'tool') ex.since[id] ??= life.hAge;
    const rank = RANK[i.tier];
    note(ctx, 'get', id, { name: i.name, tier: i.tier, cat: i.cat }, rank >= RANK.R ? 1 : 0);
    return true;
  }
  const tier = e.kind === 'weapon' ? e.w.rarity : e.m.rarity;
  const name = e.kind === 'weapon' ? e.w.name : e.m.name;
  note(ctx, 'get', id, { name, tier, cat: e.kind }, RANK[tier] >= RANK.R ? 1 : 0);
  return true;
}

// ---------- the weapon a job gives ----------

/** The first weapon of the first tier wanted that the list holds; of the weapons of that tier, one of a kind the character is trained in comes first. */
const tierPick = (list: Weapon[], want: Rarity[], trained?: (w: Weapon) => boolean): Weapon | undefined =>
  want.map((r) => list.find((w) => w.rarity === r && (!trained || trained(w))) ?? list.find((w) => w.rarity === r)).find((w) => !!w);

/** Gives the first weapon of the job when the job begins (C for a common job, U for a secret or a special one), and the next one now and then. */
export function jobWeapons(ctx: Ctx, life: LifeState): void {
  const c = catalog(ctx);
  const ex = extOf(life);
  const rng = ctx.rng('life.items');
  for (const job of [life.job, life.secretJob]) {
    if (!job) continue;
    const set = (c.byJob.get(job) ?? []).slice().sort((a, b) => RANK[a.rarity] - RANK[b.rarity]);
    if (!set.length) continue;
    if (!ex.given.includes(job)) {
      ex.given.push(job);
      const w = tierPick(set, ['C', 'U', 'R', 'E'], (x) => x.apt.split(/\s+/).some((a) => (life.aptitudes[a] ?? 0) > 0));
      if (w) apply(ctx, [{ k: 'grant', kind: 'weapon', id: w.id }], src);
      continue;
    }
    // "งานของอาชีพ": after some years in the job its next weapon may come
    const since = (life.ext.character as { jobSince?: number } | undefined)?.jobSince ?? 0;
    if (life.hAge - since >= JOB_GROWTH_FROM && rng.chance(JOB_GROWTH)) {
      const next = set.find((w) => !life.items.includes(w.id) && RANK[w.rarity] > Math.max(0, ...set.filter((x) => life.items.includes(x.id)).map((x) => RANK[x.rarity])) && w.rarity !== 'L');
      if (next) apply(ctx, [{ k: 'grant', kind: 'weapon', id: next.id }], src);
    }
  }
}

// ---------- the shop ----------

/** The highest tier a shop of this country sells (data `shopTiers`: by the size of the town, E in a big city of wealth W4 or more). */
export function shopMax(scale: number, w: number): Rarity {
  const m = SHOP_MAX[Math.max(1, Math.min(5, scale))] ?? 'C';
  return scale === 4 && w >= SHOP_E_W ? 'E' : m;
}

function pay(ctx: Ctx, life: LifeState, n: number): void {
  apply(ctx, [{ k: 'stat', stat: 'gold', delta: -Math.min(life.gold, n) }], src);
}

function buy(ctx: Ctx, life: LifeState, id: string, price: number, why: string): void {
  pay(ctx, life, price);
  apply(ctx, [{ k: 'grant', kind: id.startsWith('w') ? 'weapon' : 'gear', id }], src);
  const ex = extOf(life);
  ex.stats.bought += 1;
  ex.stats.spent += price;
  note(ctx, 'buy', id, { price, why, country: life.country }, 0);
}

/** The aptitudes the character fights with, the highest first (a bow, a sword); the job's own when it has no weapon aptitude. */
export function fightApts(ctx: Ctx, life: LifeState): string[] {
  const weapon = ['sword', 'axe', 'spear', 'bow', 'dagger', 'unarmed', 'shield', 'hammer', 'whip', 'sling', 'mounted'];
  const mine = Object.entries(life.aptitudes).filter(([a, l]) => l > 0 && weapon.includes(a)).sort((a, b) => b[1] - a[1]).map(([a]) => a);
  if (mine.length) return mine.slice(0, 2);
  const job = life.job ? idx(ctx).jobs.get(life.job) : undefined;
  return (job?.apts ?? []).filter((a) => weapon.includes(a)).slice(0, 1);
}

/** The standard weapons and the material variants a shop could have, of an aptitude. */
function shopWeapons(ctx: Ctx, apt: string, max: Rarity): Weapon[] {
  const c = catalog(ctx);
  return [...(c.byGroup.get('standard') ?? []), ...(c.byGroup.get('material') ?? [])].filter((w) => RANK[w.rarity] <= RANK[max] && w.rarity !== 'R' && w.apt.split(/\s+/).includes(apt));
}

/** A year of shopping for an adult: a weapon, armour, a tool of the job, a charm or an ornament, each with its own chance and the purse's limit. */
export function shop(ctx: Ctx, life: LifeState): void {
  if (life.hAge < ADULT_FROM + 3 || life.gold < 12) return;
  const g = travelGeo(ctx).countries.get(life.country);
  if (!g) return;
  const rng = ctx.rng('life.items.shop');
  const c = catalog(ctx);
  const ex = extOf(life);
  const max = shopMax(g.scale, g.w);
  const where = { country: life.country, w: g.w };
  const budget = () => life.gold * SHOP_BUDGET;
  const curW = c.weapons.get(ex.wield ?? '');
  const inHand = curW && life.items.includes(curW.id) ? curW : nearAtHand(ctx, life);
  const curScore = weaponScore(ctx, life, inHand, ex);
  const apts = fightApts(ctx, life);
  if (apts.length && rng.chance(SHOP_WEAPON)) {
    let best: { w: Weapon; s: number; p: number } | undefined;
    for (const apt of apts)
      for (const w of shopWeapons(ctx, apt, max)) {
        if (life.items.includes(w.id)) continue;
        const p = priceOf(ctx, w.id, where);
        if (p === null || p > budget()) continue;
        const s = weaponScore(ctx, life, w, ex);
        if (s >= curScore + SHOP_GAIN && (!best || s - p / 200 > best.s - best.p / 200)) best = { w, s, p };
      }
    if (best) buy(ctx, life, best.w.id, best.p, 'weapon');
  }
  if (rng.chance(SHOP_ARMOR)) {
    const cur = ex.armor ? c.items.get(ex.armor) : undefined;
    const curA = cur && life.items.includes(cur.id) ? armorScore(ctx, life, cur, ex) : 0;
    let best: { i: Item; s: number; p: number } | undefined;
    const twoHand = !!(curW && curW.abilities.some((a) => a.k === 'twohand'));
    for (const i of c.itemList) {
      if (i.cat !== 'armor' || RANK[i.tier] > RANK[max] || life.items.includes(i.id) || (twoHand && isShield(i))) continue;
      const p = priceOf(ctx, i.id, where);
      if (p === null || p > budget()) continue;
      const s = armorScore(ctx, life, i, ex);
      if (s >= curA + SHOP_GAIN && (!best || s - p / 200 > best.s - best.p / 200)) best = { i, s, p };
    }
    if (best) buy(ctx, life, best.i.id, best.p, 'armor');
  }
  if (life.job && rng.chance(SHOP_TOOL)) {
    const t = wantedTool(ctx, life, max, budget(), g.w, life.country);
    if (t) {
      const p = priceOf(ctx, t.id, where)!;
      const years = paybackYears(ctx, t.tier, g.w);
      if (years <= TOOL_PAYBACK_MAX && years <= 75 - life.hAge + 5) buy(ctx, life, t.id, p, 'tool');
    }
  }
  if (rng.chance(SHOP_CHARM)) {
    const held = new Set(life.items);
    const cand = c.itemList.filter((i) => (i.cat === 'folk' || i.cat === 'accessory') && !held.has(i.id) && RANK[i.tier] <= RANK[max] && i.tier !== 'E' && (priceOf(ctx, i.id, where) ?? Infinity) <= budget() / 2);
    if (cand.length) {
      const best = cand.slice().sort((a, b) => charmScore(ctx, life, b) - charmScore(ctx, life, a) || a.id.localeCompare(b.id))[0];
      if (charmScore(ctx, life, best) >= 2) buy(ctx, life, best.id, priceOf(ctx, best.id, where)!, 'charm');
    }
  }
}

// ---------- wear and repair ----------

/** Called by combat after a fight: the use of the weapon, dullness, wear of the armour, the names an engraved weapon keeps. */
export function afterBattle(ctx: Ctx, result: { won: boolean; kills?: string[] }): void {
  const life = ctx.state.life;
  if (!life || life.dead) return;
  const ex = extOf(life);
  const c = catalog(ctx);
  const wid = ex.wield;
  const w = wid ? c.weapons.get(wid) : undefined;
  if (w && life.items.includes(w.id)) {
    const d = describe(ctx, life, w, ex);
    ex.uses[w.id] = (ex.uses[w.id] ?? 0) + 1;
    if (result.won && d.engrave) {
      const k = (ex.engraved[w.id] ??= []);
      for (const e of result.kills ?? []) if (!k.includes(e)) k.push(e);
    }
    if (ex.uses[w.id] >= DULL_AFTER && !d.unbreakable && w.rarity !== 'L' && w.rarity !== 'ของใช้') {
      ex.uses[w.id] = 0;
      const own = w.abilities.find((a) => a.k === 'dull')?.n;
      const always = holds(ctx, life, 'curse', 'c_dull');
      if (!ex.dull.includes(w.id) && (always || ctx.rng('life.items').chance(own ?? DULL_CHANCE[w.rarity]))) {
        ex.dull.push(w.id);
        note(ctx, 'dull', w.id, { name: w.name }, 1);
      }
    }
  }
  if (!result.won && ex.armor) {
    const a = c.items.get(ex.armor);
    if (a && life.items.includes(a.id) && RANK[a.tier] < RANK.E) {
      const before = defenseOf(a, ex);
      ex.losses[a.id] = (ex.losses[a.id] ?? 0) + 1;
      if (defenseOf(a, ex) < before) note(ctx, 'wear', a.id, { name: a.name, defense: defenseOf(a, ex) }, 1);
    }
  }
}

/** A year of upkeep: tools wear out; a dull weapon and a worn armour are mended when the purse allows (and a smith is near for R and above). */
export function upkeep(ctx: Ctx, life: LifeState): void {
  wearTools(ctx, life);
  const c = catalog(ctx);
  const ex = extOf(life);
  const g = travelGeo(ctx).countries.get(life.country);
  const where = { country: life.country, w: g?.w ?? 3 };
  for (const id of [...ex.dull]) {
    const w = c.weapons.get(id);
    if (!w || !life.items.includes(id)) {
      ex.dull = ex.dull.filter((x) => x !== id);
      continue;
    }
    // an R or E weapon asks a smith (smith or rune carver): a town of size 3 or more, or the character's own trade
    const smithNear = (g?.scale ?? 1) >= 3 || life.job === 'smith' || life.job === 'rune_carver';
    if (RANK[w.rarity] >= RANK.R && !smithNear) continue;
    const cost = Math.max(1, Math.round((priceOf(ctx, id, where) ?? 15) * REPAIR_WEAPON));
    if (life.job === 'smith' || life.gold >= cost * 2) {
      if (life.job !== 'smith') pay(ctx, life, cost);
      ex.dull = ex.dull.filter((x) => x !== id);
      ex.stats.repaired += 1;
      note(ctx, 'repair', id, { cost: life.job === 'smith' ? 0 : cost }, 0);
    }
  }
  if (ex.armor) {
    const a = c.items.get(ex.armor);
    if (a && (ex.losses[a.id] ?? 0) >= ARMOR_LOSSES_PER_POINT) {
      const cost = Math.max(1, Math.round((priceOf(ctx, a.id, where) ?? 18) * REPAIR_ARMOR));
      if (life.gold >= cost * 2) {
        pay(ctx, life, cost);
        ex.losses[a.id] = 0;
        ex.stats.repaired += 1;
        note(ctx, 'repair', a.id, { cost }, 0);
      }
    }
  }
}

/** When the character dies: a legend weapon goes back to where it came from, or breaks for good (08-legendary.md "กลับสู่"). */
export function releaseLegends(ctx: Ctx, life: LifeState): void {
  const c = catalog(ctx);
  const reg = worldOf(ctx).legend;
  const me = `${life.id}:${life.birthYear}`;
  for (const id of new Set(life.items)) {
    const w = c.weapons.get(id);
    if (!w || w.group !== 'legend') continue;
    const breaks = /ไม่กลับ|แตก/.test(w.returnTo ?? '');
    if (reg[id] === me || reg[id] === undefined) reg[id] = breaks ? 'broken' : 'free';
    note(ctx, 'return', id, { name: w.name, to: breaks ? 'broken' : w.returnTo ?? '' }, 2);
  }
}

/** Can this piece be given to the character (a legend weapon held by another life or broken cannot)? Chests and stories ask before they grant. */
export function grantable(ctx: Ctx, id: string): boolean {
  const e = lookup(ctx, id);
  if (!e) return false;
  if (e.kind === 'weapon' && e.w.group === 'legend') {
    const who = worldOf(ctx).legend[id];
    return who === undefined || who === 'free';
  }
  return true;
}

