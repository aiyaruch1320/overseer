// The bestowal chest (docs/systems/god/02-bestow.md, G1): up to six things the god may give the main character, drawn from what fits the
// character now. The god picks one or none. Filters keep out what must not appear, a weighted draw picks the tier first and then the thing,
// the rarity compensator keeps a dry run from lasting, reroll and lock change the draw, the weapon is given once per life.
import { extOf as charExt, idx, tagsOf } from '../character';
import type { GiftLike } from '../character/data';
import type { Ctx } from '../game';
import { write } from '../log';
import type { Rng } from '../rng';
import { apply, test } from '../rules';
import type { Item, Weapon } from '../data/types-items';
import type { Aptitude, Gift, Skill } from '../data/types-character';
import type { Condition, Effect, LifeState } from '../types';
import { addBelief } from './belief';
import { canPay, isImmune, lightOf, dreadOf, notePunished, pay, priceOf, type Cost } from './power';
import { upcomingKeys, windowIds } from './story-view';
import { bump, count, godData, gx, inWindow, lifeOf, touch } from './state';
import { AMORPHOUS_TYPES, CHEST_ITEM_CATS, CHEST_WEAPON_GROUPS, CHILD_ITEM_CATS, COMP_MAX, CURSE_WARD, OPPOSITES, TIERS, tierIndex, type Tier } from './tuning';

export type SlotKind = 'bless' | 'curse' | 'skill' | 'item' | 'weapon';

export interface ChestSlot {
  slot: number;
  kind: SlotKind;
  id: string;
  name: string;
  tier: string;
  /** `skill`: the level the thing gives. */
  level?: number;
  /** `weapon`: holy (paid with faith) or cursed (paid with dread). */
  variant?: 'holy' | 'cursed';
  pay: 'faith' | 'dread';
  price: number;
  /** Change of belief the character shows when he gets it (before the halving for a character who does not know the god). */
  belief: number;
  /** Why it came up: `story` `job` `home` `event` `window` `comp` (for the screen and the tests). */
  why: string[];
}

export interface Chest {
  /** hAge the chest was opened at and whether it was a window. */
  age: number;
  window: boolean;
  slots: (ChestSlot | null)[];
  rerolls: number;
  /** Ids that were thrown away by a reroll: they do not come up again this life year. */
  discarded: string[];
  /** Slot kept by the last reroll. */
  locked?: number;
}

// ---------- caps ----------

/** How many chests the god may open this life year: one, and one more in a window or at an age stop (01-power.md §4). */
export function chestLimit(ctx: Ctx): number {
  const c = godData(ctx).caps;
  return c.chestPerYear + (inWindow(ctx) ? c.chestWindowBonus : 0);
}
export const chestsLeft = (ctx: Ctx): number => chestLimit(ctx) - count(ctx, 'y.chest');
export const currentChest = (ctx: Ctx): Chest | null => (ctx.state.god.chest as Chest | null) ?? null;

// ---------- candidates ----------

interface Cand {
  kind: SlotKind;
  id: string;
  name: string;
  tier: Tier;
  /** Relevance weight inside the tier (the "ตัวคูณตามสถานการณ์" that act on one thing). */
  w: number;
  why: string[];
  level?: number;
  variant?: 'holy' | 'cursed';
}

const giftTags = (g: GiftLike): string[] =>
  g.fx.filter((f: Effect) => f.k === 'grant' && f.kind === 'tag').map((f: Effect) => (f as Extract<Effect, { k: 'grant' }>).id.replace(/^#/, ''));

/** The raw rows of blessings.json and curses.json by id (jobs the gift eases and the events it names; race gifts have no row). */
const rawGifts = new WeakMap<object, Map<string, Gift>>();
function rawOf(ctx: Ctx): Map<string, Gift> {
  let m = rawGifts.get(ctx.data);
  if (!m) {
    m = new Map();
    for (const f of ['blessings', 'curses']) for (const g of (ctx.data[f]?.items as Gift[] | undefined) ?? []) m.set(g.id, g);
    rawGifts.set(ctx.data, m);
  }
  return m;
}

function leaves(c: Condition | undefined, out: Condition[] = []): Condition[] {
  if (!c) return out;
  if (c.k === 'and' || c.k === 'or') for (const x of c.of) leaves(x, out);
  else if (c.k === 'not') leaves(c.of, out);
  else out.push(c);
  return out;
}

/** Does the condition mention only a place or a race and hold now (a birthplace blessing for the place the character is from)? */
const placeHolds = (ctx: Ctx, c: Condition): boolean => (c.k === 'continent' || c.k === 'country' || c.k === 'race') && test(ctx, c);

function recentEvent(ctx: Ctx, c: Condition): boolean {
  if (c.k !== 'event' || !c.happened) return false;
  const y = ctx.state.world.happened[c.id];
  return y !== undefined && ctx.state.clock.worldYear - y <= 10;
}

interface Owned {
  blessings: Set<string>;
  curses: Set<string>;
  blessTags: Set<string>;
  curseTags: Set<string>;
}

function ownedOf(ctx: Ctx, life: LifeState): Owned {
  const ix = idx(ctx);
  const tags = (ids: string[]) => new Set(ids.flatMap((id) => (ix.gifts.get(id) ? giftTags(ix.gifts.get(id)!) : [])));
  return { blessings: new Set(life.blessings), curses: new Set(life.curses), blessTags: tags(life.blessings), curseTags: tags(life.curses) };
}

/** A blessing and a curse are opposite when a tag of one has an opposite among the tags of the other (02-bestow.md §2 "ขัดกัน"). */
function opposite(blessTags: Iterable<string>, curseTags: Set<string>): boolean {
  for (const t of blessTags) for (const o of OPPOSITES[t] ?? []) if (curseTags.has(o)) return true;
  return false;
}

function giftCands(ctx: Ctx, life: LifeState, curse: boolean, window: boolean, keys: Set<string>): Cand[] {
  const ix = idx(ctx);
  const race = ix.races.get(life.race);
  const second = charExt(life).second;
  const own = ownedOf(ctx, life);
  const myTags = tagsOf(ctx, life);
  const aptTags = new Set<string>();
  for (const a of Object.keys(life.aptitudes)) for (const t of ix.aptitudes.get(a)?.tags ?? []) aptTags.add(t);
  const clash = new Set(curse ? race?.curseClash : race?.blessClash);
  const out: Cand[] = [];
  for (const g of curse ? ix.curses : ix.blessings) {
    if ((curse ? own.curses : own.blessings).has(g.id)) continue;
    if (g.race && g.race !== life.race && g.race !== second) continue;
    if (clash.has(g.id)) continue;
    const t = g.tier as Tier;
    if (t === 'L' && !(window || (curse ? life.godFaith <= godData(ctx).chest.levelLGate.curse : life.godFaith >= godData(ctx).chest.levelLGate.bless))) continue;
    // the gift's own condition (where it is born, which event it comes from) must hold: a birthplace gift for another place never comes up
    if (g.fromCond.some((c) => !test(ctx, c))) continue;
    const tags = giftTags(g);
    if (curse ? opposite(own.blessTags, new Set(tags)) : opposite(tags, own.curseTags)) continue;
    // a kind of gift the character already has by its tag (two ways to fear the water)
    if (tags.length && tags.every((x) => myTags.has(x)) && !g.race) continue;
    const why: string[] = [];
    const raw = rawOf(ctx).get(g.id);
    let w = 1;
    if (keys.has(g.id) || tags.some((x) => keys.has(x))) (w *= 3), why.push('story');
    if ((life.job && raw?.jobs.includes(life.job)) || (life.secretJob && raw?.jobs.includes(life.secretJob)) || tags.some((x) => aptTags.has(x))) (w *= 2), why.push('job');
    if (g.race === life.race || g.fromCond.some((c) => leaves(c).some((l) => placeHolds(ctx, l)))) (w *= 1.5), why.push('home');
    if (g.fromCond.some((c) => leaves(c).some((l) => recentEvent(ctx, l))) || raw?.refs.events.some((e) => recentEvent(ctx, { k: 'event', id: e, happened: true }))) (w *= 2), why.push('event');
    out.push({ kind: curse ? 'curse' : 'bless', id: g.id, name: g.name, tier: t, w, why });
  }
  return out;
}

function skillCands(ctx: Ctx, life: LifeState, keys: Set<string>): Cand[] {
  const ix = idx(ctx);
  const job = life.job ? ix.jobs.get(life.job) : undefined;
  const jobApts = new Set(job?.apts ?? []);
  const e = charExt(life);
  const out: Cand[] = [];
  for (const a of ix.aptitudeList as Aptitude[]) {
    const cur = life.aptitudes[a.id] ?? 0;
    if (cur >= 3) continue;
    if (cur === 0 && !jobApts.has(a.id)) continue;
    const level = cur + 1;
    const id = `${a.id}_${level}`;
    const why: string[] = [];
    let w = 1;
    if (jobApts.has(a.id)) (w *= 2), why.push('job');
    if (keys.has(id) || keys.has(a.id)) (w *= 3), why.push('story');
    out.push({ kind: 'skill', id, name: ix.skills.get(id)?.name ?? id, tier: TIERS[level - 1], w, why, level });
  }
  for (const s of ix.skills.values() as Iterable<Skill>) {
    if (s.kind === 'new') {
      const cur = e.skillLevels[s.id] ?? (life.skills.includes(s.id) ? 1 : 0);
      const top = s.levels?.length ?? 3;
      if (cur >= top) continue;
      // a new skill grows from an aptitude the character has
      if (s.apt && (life.aptitudes[s.apt] ?? 0) < 1 && !jobApts.has(s.apt)) continue;
      const level = cur + 1;
      const why: string[] = [];
      let w = 1;
      if (s.apt && jobApts.has(s.apt)) (w *= 2), why.push('job');
      if (keys.has(s.id)) (w *= 3), why.push('story');
      out.push({ kind: 'skill', id: s.id, name: s.name, tier: TIERS[Math.min(2, level - 1)], w, why, level });
    } else if (s.kind === 'unique' && !life.skills.includes(s.id)) {
      out.push({ kind: 'skill', id: s.id, name: s.name, tier: 'E', w: keys.has(s.id) ? 3 : 1, why: keys.has(s.id) ? ['story'] : [], level: 4 });
    }
  }
  return out;
}

interface Catalog {
  weapons: Weapon[];
  items: Item[];
}
const catalogs = new WeakMap<object, Catalog>();
function catalog(ctx: Ctx): Catalog {
  const key = ctx.data;
  let c = catalogs.get(key);
  if (!c) {
    const w = (ctx.data.weapons?.items as { items?: Weapon[] } | undefined)?.items ?? [];
    const i = (ctx.data.items?.items as { items?: Item[] } | undefined)?.items ?? [];
    c = {
      weapons: w.filter((x) => CHEST_WEAPON_GROUPS.includes(x.group) && ['C', 'U', 'R', 'E'].includes(x.rarity)),
      items: i.filter((x) => CHEST_ITEM_CATS.includes(x.cat) && ['C', 'U', 'R', 'E'].includes(x.tier)),
    };
    catalogs.set(key, c);
  }
  return c;
}

const countryOfWeapon = (id: string): string | undefined => {
  const m = id.match(/^wc_([a-z]{2})(\d{2})$/);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : undefined;
};

function weaponCands(ctx: Ctx, life: LifeState, keys: Set<string>): Cand[] {
  const ix = idx(ctx);
  const amorphous = (ix.races.get(life.race)?.tags ?? []).includes('amorphous');
  const w = godData(ctx).chest.weaponMult;
  const out: Cand[] = [];
  for (const x of catalog(ctx).weapons) {
    if (life.items.includes(x.id)) continue;
    if (amorphous && !AMORPHOUS_TYPES.includes(x.type)) continue;
    let m = 1;
    const why: string[] = [];
    if (x.job && (x.job === life.job || x.job === life.secretJob)) (m *= w.job), why.push('job');
    else if ((life.aptitudes[x.apt] ?? 0) > 0) (m *= 2), why.push('job');
    const c = countryOfWeapon(x.id);
    if (c && (c === life.country || c === life.home)) (m *= w.country), why.push('home');
    if (keys.has(x.id)) (m *= 3), why.push('story');
    out.push({ kind: 'weapon', id: x.id, name: x.name, tier: x.rarity as Tier, w: m, why });
  }
  return out;
}

function itemCands(ctx: Ctx, life: LifeState, child: boolean, keys: Set<string>): Cand[] {
  const ix = idx(ctx);
  const amorphous = (ix.races.get(life.race)?.tags ?? []).includes('amorphous');
  const job = life.job ? ix.jobs.get(life.job) : undefined;
  const out: Cand[] = [];
  for (const x of catalog(ctx).items) {
    if (child && !CHILD_ITEM_CATS.includes(x.cat)) continue;
    if (amorphous && (x.cat === 'armor' || x.cat === 'accessory')) continue;
    if (life.items.includes(x.id)) continue;
    let m = 1;
    const why: string[] = [];
    if (x.apt && ((life.aptitudes[x.apt] ?? 0) > 0 || job?.apts.includes(x.apt))) (m *= 2), why.push('job');
    if (x.where && (x.where.includes(life.country) || x.where.includes(life.home))) (m *= 1.5), why.push('home');
    if (keys.has(x.id)) (m *= 3), why.push('story');
    out.push({ kind: 'item', id: x.id, name: x.name, tier: x.tier as Tier, w: m, why });
  }
  return out;
}

// ---------- the draw ----------

/** The rarity compensator's current value in points (02-bestow.md §3): −5 after a chest with an R, +2 for each chest without one. */
export function compOf(ctx: Ctx): number {
  return ctx.state.god.counters.comp ?? godData(ctx).chest.compensator.start;
}

/**
 * Chance of each tier for a slot (02-bestow.md §3): the base weights of the tiers that have something to give, the multipliers that act on a
 * tier (late eras for E and L, belief for R and above), then the compensator moves points of the R chance, taken from the lowest tier.
 */
export function tierChances(ctx: Ctx, present: readonly Tier[], opts: { comp?: number; curse?: boolean }): Record<string, number> {
  const g = godData(ctx).chest;
  const life = lifeOf(ctx);
  const belief = life?.godFaith ?? 0;
  const late = ctx.state.world.era >= g.lateTierFrom;
  const w: Record<string, number> = {};
  let total = 0;
  for (const t of present) {
    let x = g.tierWeights[t];
    if (late && (t === 'E' || t === 'L')) x *= g.multipliers.find((m) => m.id === 'lateTier')?.mult ?? 1.5;
    const boost = opts.curse ? belief <= godData(ctx).chest.levelLGate.curse : belief >= godData(ctx).chest.levelLGate.bless;
    if (boost && tierIndex(t) >= 2) x *= g.multipliers.find((m) => m.id === 'belief')?.mult ?? 1.3;
    w[t] = x;
    total += x;
  }
  const p: Record<string, number> = {};
  for (const t of present) p[t] = w[t] / total;
  if (opts.comp && present.includes('R')) {
    const to = Math.max(0, Math.min(1, p.R + opts.comp / 100));
    let diff = to - p.R;
    p.R = to;
    // the points come from the lowest tiers first, or go to them
    for (const t of present) {
      if (t === 'R' || diff === 0) continue;
      const take = diff > 0 ? Math.min(p[t], diff) : diff;
      p[t] -= take;
      diff -= take;
      if (diff <= 1e-12 && diff >= -1e-12) break;
    }
  }
  return p;
}

function drawFrom(ctx: Ctx, rng: Rng, cands: Cand[], opts: { comp?: number; curse?: boolean }): Cand | null {
  if (!cands.length) return null;
  const byTier = new Map<Tier, Cand[]>();
  for (const c of cands) byTier.set(c.tier, [...(byTier.get(c.tier) ?? []), c]);
  const present = TIERS.filter((t) => byTier.has(t));
  const p = tierChances(ctx, present, opts);
  const ti = rng.weighted(present.map((t) => p[t]));
  if (ti < 0) return null;
  const list = byTier.get(present[ti])!;
  return list[Math.max(0, rng.weighted(list.map((c) => c.w)))];
}

const beliefOf = (c: { kind: SlotKind; tier: string; variant?: 'holy' | 'cursed' }, ctx: Ctx): number => {
  const b = godData(ctx).belief;
  if (c.kind === 'weapon') return c.variant === 'holy' ? b.holyWeapon : b.cursedWeapon;
  const ti = tierIndex(c.tier);
  return c.kind === 'curse' ? b.curse.base + b.curse.perTier * ti : b.bestow.base + b.bestow.perTier * ti;
};

const priceAction = (c: { kind: SlotKind; variant?: 'holy' | 'cursed' }): 'bless' | 'curse' | 'skill' | 'item' | 'holyWeapon' | 'cursedWeapon' =>
  c.kind === 'weapon' ? (c.variant === 'holy' ? 'holyWeapon' : 'cursedWeapon') : c.kind;

function toSlot(ctx: Ctx, n: number, c: Cand, window: boolean): ChestSlot {
  const a = priceAction(c);
  const price = priceOf(ctx, a, { tier: c.tier, window })!;
  const line = price.faith !== undefined ? 'faith' : 'dread';
  return {
    slot: n,
    kind: c.kind,
    id: c.id,
    name: c.name,
    tier: c.tier,
    ...(c.level !== undefined ? { level: c.level } : {}),
    ...(c.variant ? { variant: c.variant } : {}),
    pay: a === 'curse' || a === 'cursedWeapon' ? 'dread' : line,
    price: (a === 'curse' || a === 'cursedWeapon' ? price.dread : price.faith) ?? 0,
    belief: beliefOf(c, ctx),
    why: c.why,
  };
}

/** The price a slot costs now (a window may have come or gone since the chest was drawn). */
export function slotPrice(ctx: Ctx, s: ChestSlot, window?: boolean): { cost: Cost; price: number } {
  const p = priceOf(ctx, priceAction(s), { tier: s.tier, window })!;
  const cost: Cost = s.pay === 'faith' ? { faith: p.faith } : { dread: p.dread };
  return { cost, price: (s.pay === 'faith' ? p.faith : p.dread) ?? 0 };
}

/** Blessings and curses a window row names (`b_courage`): one slot of that kind is that one for sure (02-bestow.md §3 last paragraph). */
function forced(ctx: Ctx, pool: Cand[], curse: boolean): Cand | undefined {
  const ids = windowIds(ctx);
  return pool.find((c) => ids.has(c.id) && (c.kind === 'curse') === curse);
}

/**
 * Draws the slots of a chest. `keep` slots stay as they are (a locked slot); `exclude` ids never come up (thrown away, or already in the chest).
 * Writes nothing; the only state it touches is the random stream `god.chest`.
 */
function draw(ctx: Ctx, keep: Map<number, ChestSlot>, exclude: Set<string>, window: boolean): (ChestSlot | null)[] {
  const life = lifeOf(ctx)!;
  const rng = ctx.rng('god.chest');
  const keys = upcomingKeys(ctx);
  const comp = compOf(ctx);
  const used = new Set<string>(exclude);
  for (const s of keep.values()) used.add(s.id);
  const free = (cs: Cand[]) => cs.filter((c) => !used.has(c.id));
  const blessings = giftCands(ctx, life, false, window, keys);
  const curses = giftCands(ctx, life, true, window, keys);
  const out: (ChestSlot | null)[] = [];

  const put = (n: number, c: Cand | null) => {
    if (c) used.add(c.id);
    out.push(c ? toSlot(ctx, n, c, window) : null);
  };
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const kept = keep.get(n);
    if (kept) {
      out.push(kept);
      continue;
    }
    if (n <= 2) {
      const pool = free(blessings);
      const f = n === 1 ? forced(ctx, pool, false) : undefined;
      put(n, f ?? drawFrom(ctx, rng, pool, { comp }));
    } else if (n <= 4) {
      const pool = free(curses);
      const f = n === 3 ? forced(ctx, pool, true) : undefined;
      put(n, f ?? drawFrom(ctx, rng, pool, { curse: true }));
    } else if (n === 5) {
      // a skill; when there is none to give, another blessing (02-bestow.md §1 slot 5)
      const s = drawFrom(ctx, rng, free(skillCands(ctx, life, keys)), { comp });
      put(n, s ?? drawFrom(ctx, rng, free(blessings), { comp }));
    } else {
      const minAge = godData(ctx).chest.minAgeForWeapon;
      const g = godData(ctx).caps;
      if (count(ctx, 'l.weapon') < g.giftedWeapon && life.hAge >= minAge) {
        const c = drawFrom(ctx, rng, free(weaponCands(ctx, life, keys)), { comp });
        if (c) {
          // holy or cursed by the ratio of light to dread the god holds now (02-bestow.md §5)
          const l = lightOf(ctx);
          const d = dreadOf(ctx);
          c.variant = l + d <= 0 || rng.chance(l / (l + d)) ? 'holy' : 'cursed';
        }
        put(n, c);
      } else if (count(ctx, 'l.items') < g.giftedItems) {
        put(n, drawFrom(ctx, rng, free(itemCands(ctx, life, life.hAge < minAge, keys)), { comp }));
      } else put(n, null);
    }
  }
  return out;
}

/** Updates the compensator after a draw: back to the start after a chest with an R or better, else up by the step. */
function settleComp(ctx: Ctx, slots: (ChestSlot | null)[]): void {
  const c = godData(ctx).chest.compensator;
  const hit = slots.some((s) => s && s.kind !== 'curse' && tierIndex(s.tier) >= 2);
  const now = compOf(ctx);
  ctx.state.god.counters.comp = hit ? c.start : Math.min(COMP_MAX, now + c.step);
}

// ---------- actions ----------

/** Why the god cannot open a chest now, or null. Does not roll. */
export function checkOpen(ctx: Ctx): string | null {
  if (!lifeOf(ctx)) return 'ไม่มีตัวละครที่ยังมีชีวิต';
  if (currentChest(ctx)) return 'หีบเปิดอยู่แล้ว';
  if (chestsLeft(ctx) <= 0) return 'เปิดหีบครบตามเพดานของปีนี้แล้ว';
  if (isImmune(ctx)) return 'ผู้ถืออาวุธนี้ไม่รับการแทรกแซง';
  return null;
}

/** Opens a chest: draws the slots and keeps them in `god.chest`. */
export function openChest(ctx: Ctx): Chest {
  const life = lifeOf(ctx)!;
  const window = inWindow(ctx);
  const slots = draw(ctx, new Map(), new Set(), window);
  settleComp(ctx, slots);
  const chest: Chest = { age: life.hAge, window, slots, rerolls: 0, discarded: [] };
  ctx.state.god.chest = chest;
  bump(ctx, 'y.chest');
  bump(ctx, 'l.chest');
  tallyL(ctx, slots);
  write(ctx.state, { sys: 'god', kind: 'chest', id: 'open', data: { window, slots: slots.filter(Boolean).length, ids: slots.map((s) => s?.id ?? '-').join(' ') }, level: 1 });
  return chest;
}

/** L things the chests showed in this life (the balance test counts them). */
function tallyL(ctx: Ctx, slots: (ChestSlot | null)[]): void {
  for (const s of slots) if (s && s.tier === 'L' && s.kind === 'bless') bump(ctx, 'l.lSeen');
}

export function checkReroll(ctx: Ctx, lock?: number): string | null {
  const ch = currentChest(ctx);
  if (!ch) return 'ไม่มีหีบที่เปิดอยู่';
  const c = godData(ctx).prices.reroll;
  if (ch.rerolls >= c.length) return 'ทอยหีบใหม่ครบสามครั้งแล้ว';
  if (lock !== undefined && !ch.slots[lock - 1]) return 'ล็อกช่องที่ว่างไม่ได้';
  const p = priceOf(ctx, 'reroll', { n: ch.rerolls, lock: lock !== undefined })!;
  return canPay(ctx, p) ? null : 'แสงศรัทธาไม่พอ';
}

/** Rerolls the chest (all six slots, or the five that are not locked). */
export function rerollChest(ctx: Ctx, lock?: number): Chest {
  const ch = currentChest(ctx)!;
  const p = priceOf(ctx, 'reroll', { n: ch.rerolls, lock: lock !== undefined })!;
  pay(ctx, p, 'chest.reroll');
  const keep = new Map<number, ChestSlot>();
  if (lock !== undefined && ch.slots[lock - 1]) keep.set(lock, ch.slots[lock - 1]!);
  for (const s of ch.slots) if (s && !keep.has(s.slot)) ch.discarded.push(s.id);
  const slots = draw(ctx, keep, new Set(ch.discarded), ch.window);
  settleComp(ctx, slots);
  ch.slots = slots;
  ch.rerolls += 1;
  if (lock !== undefined) ch.locked = lock;
  else delete ch.locked;
  tallyL(ctx, slots);
  bump(ctx, 'l.reroll');
  write(ctx.state, { sys: 'god', kind: 'chest', id: 'reroll', data: { n: ch.rerolls, lock: lock ?? 0, ids: slots.map((s) => s?.id ?? '-').join(' ') }, level: 1 });
  return ch;
}

export function skipChest(ctx: Ctx): void {
  ctx.state.god.chest = null;
  bump(ctx, 'l.skip');
  record(ctx, 'chest.skip', '-', 'skip');
  write(ctx.state, { sys: 'god', kind: 'chest', id: 'skip', level: 1 });
}

export function checkPick(ctx: Ctx, slot: number): string | null {
  const ch = currentChest(ctx);
  if (!ch) return 'ไม่มีหีบที่เปิดอยู่';
  const s = ch.slots[slot - 1];
  if (!s) return 'ช่องนี้ว่าง';
  if (isImmune(ctx)) return 'ผู้ถืออาวุธนี้ไม่รับการแทรกแซง';
  if (!canPay(ctx, slotPrice(ctx, s).cost)) return s.pay === 'faith' ? 'แสงศรัทธาไม่พอ' : 'ความหวาดกลัวไม่พอ';
  return null;
}

function record(ctx: Ctx, kind: string, id: string, result: string): void {
  const life = ctx.state.life;
  ctx.state.god.chronicle.push({ worldYear: ctx.state.clock.worldYear, ...(life ? { hAge: life.hAge, target: life.id } : {}), kind, id, result });
}

/** What the thing does to the character, as effects of the shared grammar (the character system applies them). */
export function effectsOf(s: ChestSlot, mercyDrop = -10): Effect[] {
  switch (s.kind) {
    case 'bless':
      return [{ k: 'grant', kind: 'blessing', id: s.id }];
    case 'curse':
      return [{ k: 'grant', kind: 'curse', id: s.id }];
    case 'skill':
      return [{ k: 'grant', kind: 'skill', id: s.id, ...(s.level && s.level <= 3 && !/_[1-3]$/.test(s.id) ? { level: s.level } : {}) }];
    case 'item':
      return [{ k: 'grant', kind: 'gear', id: s.id }];
    case 'weapon':
      return [
        { k: 'grant', kind: 'weapon', id: s.id },
        { k: 'grant', kind: 'tag', id: s.variant === 'holy' ? 'holy' : 'cursed_weapon' },
        ...(s.variant === 'cursed' ? [{ k: 'stat', stat: 'kind', delta: mercyDrop } as Effect] : []),
      ];
  }
}

/** Picks a slot: pays, gives the thing, changes the belief, closes the chest, writes the chronicle. */
export function pickSlot(ctx: Ctx, slot: number): ChestSlot {
  const ch = currentChest(ctx)!;
  const s = ch.slots[slot - 1]!;
  const life = lifeOf(ctx)!;
  pay(ctx, slotPrice(ctx, s).cost, `chest.pick:${s.id}`);
  let warded = false;
  if (s.kind === 'curse' && life.blessings.includes(CURSE_WARD.blessing)) {
    // the ward turns the curse back (02-bestow.md §4)
    warded = true;
    addBelief(ctx, CURSE_WARD.belief, 'curse-ward');
  } else {
    apply(ctx, effectsOf(s, godData(ctx).belief.cursedWeaponMercy), { sys: 'god', id: `chest.${s.id}`, stream: 'god.chest' });
    addBelief(ctx, s.belief, `chest.${s.kind}`, { gift: true });
  }
  if (s.kind === 'weapon') {
    bump(ctx, 'l.weapon');
    gx(ctx).weapon = { id: s.id, variant: s.variant! };
  } else if (s.kind === 'item') bump(ctx, 'l.items');
  if (s.kind === 'curse' || s.variant === 'cursed') notePunished(ctx);
  if (s.kind !== 'curse' && s.variant !== 'cursed') bump(ctx, 'l.gifts');
  if (s.tier === 'L' && s.kind === 'bless') bump(ctx, 'l.lTaken');
  bump(ctx, 'l.pick');
  bump(ctx, `l.pick.${s.kind}`);
  touch(ctx);
  ctx.state.god.chest = null;
  record(ctx, 'chest.pick', s.id, warded ? 'warded' : 'given');
  write(ctx.state, { sys: 'god', kind: 'chest', id: 'pick', data: { slot, thing: s.id, kind: s.kind, tier: s.tier, paid: s.price, warded }, level: 2 });
  return s;
}
