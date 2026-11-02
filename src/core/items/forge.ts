// Forging a weapon as a story (docs/systems/items/10-forging.md): a need, the smith, the road, the smith's trial, the order, the wait and the roll.
// The chain runs on the life year and the beat: the need is rolled once a year; the road is the travel system's; every other step takes its time in beats.
// The numbers (prices, times, odds, trials, smiths) are in data/gen/forging.json; the tuning file holds what the documents leave open.
import type { Ctx } from '../game';
import { holds, idx, trustOf } from '../character';
import type { ForgingTrial, Rarity, Smith, TrialPath, Weapon } from '../data/types-items';
import { whisperBonus } from '../god/acts';
import { apply } from '../rules';
import { go, reachable, travelExt } from '../travel';
import { geo as travelGeo } from '../travel/data';
import { happened } from '../world/access';
import type { LifeState } from '../types';
import { catalog, RANK, TIERS } from './data';
import { fightApts } from './gain';
import { note } from './log';
import { extOf, type ForgeState, type WeaponMod } from './state';
import { FORGE_BEATS, FORGE_EVERY, FORGE_NEED_FIGHTER, FORGE_NEED_OTHER, FORGE_SAVE_YEARS } from './tuning';

const src = { sys: 'items', stream: 'life.items.forge' };
const beatOf = (ctx: Ctx, life: LifeState) => life.hAge * 4 + ctx.state.clock.quarter;
const STAT_OF: Record<string, string> = { sword: 'pow', axe: 'pow', spear: 'pow', hammer: 'pow', unarmed: 'pow', bow: 'spd', dagger: 'spd', whip: 'spd', sling: 'luk', magic: 'mag', shield: 'vit' };

// ---------- the need (§2) ----------

function fighter(ctx: Ctx, life: LifeState): boolean {
  const weapon = ['sword', 'axe', 'spear', 'bow', 'dagger', 'unarmed', 'hammer', 'whip', 'sling', 'mounted'];
  if (weapon.some((a) => (life.aptitudes[a] ?? 0) > 0)) return true;
  const job = life.job ? idx(ctx).jobs.get(life.job) : undefined;
  return job?.group === 'งานต่อสู้และเสี่ยงอันตราย' || ['soldier', 'knight', 'mercenary', 'hunter', 'royal_guard'].includes(life.job ?? '');
}

function materialsOf(ctx: Ctx, life: LifeState): string[] {
  const c = catalog(ctx);
  return [...new Set(life.items)].filter((id) => c.materials.has(id) || /^mt_/.test(id));
}

function tierOfWielded(ctx: Ctx, life: LifeState): number {
  const ex = extOf(life);
  const w = ex.wield ? catalog(ctx).weapons.get(ex.wield) : undefined;
  return w && life.items.includes(w.id) ? RANK[w.rarity] : 0;
}

/** The weapon wanted: a kind the character is trained in, at the tier asked, from the sets the smith of that tier can make. */
function chooseWeapon(ctx: Ctx, life: LifeState, tier: Rarity, material?: string): Weapon | undefined {
  const c = catalog(ctx);
  const rng = ctx.rng('life.items.forge');
  const apts = fightApts(ctx, life);
  const aptOk = (w: Weapon) => !apts.length || apts.some((a) => w.apt.split(/\s+/).includes(a));
  const have = new Set(life.items);
  let pool: Weapon[];
  if (tier === 'C') pool = (c.byGroup.get('standard') ?? []).filter((w) => w.rarity === 'C');
  else if (tier === 'U') pool = (c.byGroup.get('material') ?? []).filter((w) => w.rarity === 'U');
  else if (tier === 'R') pool = [...(c.byGroup.get('material') ?? []).filter((w) => w.rarity === 'R'), ...(c.byJob.get(life.job ?? '') ?? []).filter((w) => w.rarity === 'R')];
  else pool = (c.byGroup.get('forge') ?? []).filter((w) => w.rarity === 'E');
  if (material) {
    const m = pool.filter((w) => w.from?.material === material);
    if (m.length) pool = m;
  }
  pool = pool.filter((w) => !have.has(w.id));
  const fit = pool.filter(aptOk);
  const list = fit.length ? fit : pool;
  return list.length ? list[rng.int(0, list.length - 1)] : undefined;
}

/** What a smith of this kind is able to make, the skill bonus and the tier ceiling (10-forging.md §4). */
const SMITH: Record<ForgeState['kind'], { skill: number; max: number }> = {
  village: { skill: 2, max: RANK.U },
  city: { skill: 4, max: RANK.R },
  nation: { skill: 6, max: RANK.E },
  named: { skill: 7, max: RANK.E },
};

function priceFor(ctx: Ctx, life: LifeState, tier: string, kind: ForgeState['kind'], place: string, material: boolean): number {
  const base = catalog(ctx).forging.order.prices.find((p) => p.tier === tier)?.price ?? 50;
  const g = travelGeo(ctx).countries.get(place);
  let mul = 1;
  if (kind === 'village') mul *= 0.8;
  if (kind === 'named') mul *= 1.2;
  const flags = travelGeo(ctx).byContinent.get((g?.continent ?? 'AL') as never) ?? [];
  if (flags.some((x) => (ctx.state.world.countryFlags[x.id] ?? []).includes('war'))) mul *= 1.5;
  if (happened(ctx, 'DR-04') && place.startsWith('KD')) mul *= 2;
  if (happened(ctx, 'MC-04') && place.startsWith('MK')) mul *= 2;
  if (material) mul *= 0.7;
  const index = catalog(ctx).itemData.prices.priceIndexW[(g?.w ?? 3) - 1] ?? 1;
  return Math.round(base * Math.min(3, mul * index));
}

/** The smith who can make this weapon: the NPC that names it, or the forge of its nation, or a town smith for the lesser tiers. */
function findSmith(ctx: Ctx, life: LifeState, w: Weapon): { kind: ForgeState['kind']; id: string; name: string; place: string; smith?: Smith } | undefined {
  const f = catalog(ctx).forging;
  const g = travelGeo(ctx);
  const here = g.countries.get(life.country);
  const rank = RANK[w.rarity];
  if (rank <= RANK.U) return { kind: 'village', id: 'village', name: 'ช่างหมู่บ้าน', place: life.country };
  if (rank === RANK.R) {
    const named = f.smiths.find((s) => s.makes.includes(w.id));
    if (named) return { kind: 'named', id: named.npc, name: named.name, place: named.place, smith: named };
    if ((here?.scale ?? 1) >= 3) return { kind: 'city', id: 'city', name: 'ช่างเมือง', place: life.country };
    const towns = (g.byContinent.get(life.country.slice(0, 2) as never) ?? []).filter((c) => c.scale >= 3 && c.id !== life.country);
    const rng = ctx.rng('life.items.forge');
    for (let i = 0; i < 4 && towns.length; i++) {
      const t = towns.splice(rng.int(0, towns.length - 1), 1)[0];
      if (reachable(ctx, life, t.id)) return { kind: 'city', id: 'city', name: 'ช่างเมือง', place: t.id };
    }
    return undefined;
  }
  const named = f.smiths.find((s) => s.makes.includes(w.id));
  if (named) return { kind: 'named', id: named.npc, name: named.name, place: named.place, smith: named };
  const forge = f.forges.find((x) => x.key === w.forge);
  const place = forge?.country.split(/\s+/)[0];
  return place ? { kind: 'nation', id: forge!.key, name: forge!.name, place } : undefined;
}

/** Rolls the need once a year. */
export function forgeYear(ctx: Ctx, life: LifeState): void {
  const ex = extOf(life);
  if (ex.forge) {
    if (ex.forge.step === 'save') resumeSave(ctx, life, ex.forge);
    return;
  }
  if (life.hAge < 18 || life.hAge - ex.forgeLast < FORGE_EVERY) return;
  const rng = ctx.rng('life.items.forge');
  const fights = fighter(ctx, life);
  let p = fights ? FORGE_NEED_FIGHTER : FORGE_NEED_OTHER;
  if (life.traits.some((t) => ['ambitious', 'adventurer', 'proud'].includes(t))) p *= 1.5;
  if (life.traits.some((t) => ['thrifty', 'lazy'].includes(t)) || (!fights && life.traits.includes('kind'))) p *= 0.5;
  if (!rng.chance(p)) return;
  // the cause (the table's weights; a cause that cannot hold for this character is left out)
  const need = catalog(ctx).forging.need;
  const cur = tierOfWielded(ctx, life);
  const w = ex.wield ? catalog(ctx).weapons.get(ex.wield) : undefined;
  const mats = materialsOf(ctx, life).filter((id) => RANK[catalog(ctx).materials.get(id)?.rarity ?? 'C'] >= RANK.U);
  const eligible = [ex.dull.length > 0, (cur > 0 || fights) && (ex.setbacks ?? 0) > 0, mats.length > 0, !!w && w.group !== 'everyday' ? !!w && !w.apt.split(/\s+/).some((a) => (life.aptitudes[a] ?? 0) > 0) : fights, false];
  const k = rng.weighted(need.map((n, i) => (eligible[i] ? n.weight : 0)));
  if (k < 0) return;
  const material = k === 2 ? mats[0] : undefined;
  let rank = Math.max(RANK.C, Math.min(RANK.E, k === 0 && !rng.chance(0.4) ? cur : cur + 1));
  if (rank < RANK.C) rank = RANK.C;
  start(ctx, life, need[k].cause, rank, material);
}

/** Starts the chain for a weapon of at least this rank. Steps down while the purse (or a smith) says no. Returns whether a chain began. */
export function start(ctx: Ctx, life: LifeState, cause: string, rank: number, material?: string): boolean {
  const ex = extOf(life);
  const self = life.job === 'smith' && (life.aptitudes.smithing ?? 0) >= 3;
  for (let r = rank; r >= RANK.C; r--) {
    const tier = TIERS[r];
    const w = chooseWeapon(ctx, life, tier, material);
    if (!w) continue;
    if (r <= tierOfWielded(ctx, life) && cause !== 'อาวุธทื่อหรือหักในศึก') break;
    const s = self && r <= RANK.R ? { kind: 'named' as const, id: 'self', name: life.name, place: life.country } : findSmith(ctx, life, w);
    if (!s) continue;
    const price = self ? 0 : priceFor(ctx, life, tier, s.kind, s.place, !!material);
    // a purse that cannot pay half goes down a tier; the character can work for the rest (§6 way ค) or save up (way ง) when close
    if (!self && life.gold < price * 0.5) continue;
    ex.forge = {
      step: 'road', weapon: w.id, smith: s.id, smithName: s.name, place: s.place, tier, kind: s.kind, cause, until: beatOf(ctx, life), price, paid: 0, trust: 0, material, since: life.hAge, slow: 0,
      trial: s.smith?.trial,
    };
    ex.setbacks = 0;
    note(ctx, 'forge', w.id, { step: 'need', cause, tier, smith: s.name, place: s.place }, 1);
    if (self) {
      ex.forge.step = 'wait';
      ex.forge.until = beatOf(ctx, life) + FORGE_BEATS[tier] ;
      ex.forge.how = 'self';
    }
    return true;
  }
  return false;
}

// ---------- the steps ----------

function abort(ctx: Ctx, life: LifeState, f: ForgeState, why: string): void {
  const ex = extOf(life);
  ex.forge = undefined;
  ex.forgeLast = life.hAge;
  note(ctx, 'forge', f.weapon, { step: 'abort', why, smith: f.smithName }, 1);
}

function bonusLevel(ctx: Ctx, life: LifeState, id: string): number {
  return holds(ctx, life, 'skill', id) || holds(ctx, life, 'aptitude', id) || holds(ctx, life, 'blessing', id) ? 1 : 0;
}

function weightOfPath(ctx: Ctx, life: LifeState, p: TrialPath): number {
  if (p.weight === null) return 0;
  let w = p.weight;
  for (const m of p.weightMods) if (m.ids.some((id) => life.traits.includes(id) || holds(ctx, life, 'skill', id) || holds(ctx, life, 'blessing', id))) w *= m.mul;
  if (p.trustReq && trustOf(life, p.trustReq.toward) < p.trustReq.min) w = 0;
  return w;
}

/** The trial of a named smith (§5). Returns whether it was passed. */
function trial(ctx: Ctx, life: LifeState, f: ForgeState): boolean {
  const t: ForgingTrial | undefined = catalog(ctx).forging.trials.find((x) => x.id === f.trial);
  if (!t) return true;
  const rng = ctx.rng('life.items.forge');
  const paths = [t.a, t.b, t.c];
  const k = rng.weighted(paths.map((p) => weightOfPath(ctx, life, p)));
  if (k < 0) return true;
  const p = paths[k];
  let pass = !p.retreat;
  if (p.roll && pass) {
    const auto = p.roll.autoPass.some((id) => holds(ctx, life, 'skill', id) || holds(ctx, life, 'blessing', id) || (life.race === 'giant' && /ยักษ์/.test(p.text)));
    if (!auto) {
      const stat = p.roll.stat && p.roll.stat in life.stats ? life.stats[p.roll.stat as keyof LifeState['stats']] : life.stats.int;
      const bonus = p.roll.bonus.reduce((n, b) => n + (bonusLevel(ctx, life, b.id) ? b.delta : 0), 0);
      const roll = rng.int(1, 20);
      pass = roll === 20 || (roll !== 1 && roll + Math.floor((stat - 10) / 2) + bonus >= (p.roll.dc ?? 12));
    }
  }
  note(ctx, 'forge', f.weapon, { step: 'trial', trial: t.id, way: p.key, pass, smith: f.smithName }, 1);
  if (!pass) return false;
  f.trust += p.trust ?? 0;
  if (p.gold) apply(ctx, [{ k: 'stat', stat: 'gold', delta: p.gold }], src);
  for (const s of p.skills) apply(ctx, [{ k: 'stat', stat: s.id, delta: s.delta }], src);
  for (const g of p.grants) if (/^nb_|^b_/.test(g.id) && !g.when) apply(ctx, [{ k: 'grant', kind: 'blessing', id: g.id, chance: g.chance }], src);
  if (p.battle.length && !p.battleWorld) apply(ctx, [{ k: 'battle', enemies: p.battle }], src);
  return true;
}

/** The order (§6): which way to pay. */
function order(ctx: Ctx, life: LifeState, f: ForgeState): void {
  const rng = ctx.rng('life.items.forge');
  const has = (ids: string[]) => life.traits.some((t) => ids.includes(t)) || ids.some((id) => holds(ctx, life, 'skill', id) || holds(ctx, life, 'aptitude', id));
  const poor = life.gold < f.price;
  const w = [
    40,
    25 * (has(['charismatic', 'cunning', 'trade']) ? 2 : 1),
    20 * (has(['diligent', 'humble']) ? 2 : 1) * (poor ? 3 : 1),
    15 * (has(['thrifty', 'pessimist']) ? 2 : 1),
  ];
  if (poor) w[0] = 0;
  const way = 'กขคง'[rng.weighted(w)];
  if (way === 'ก') {
    f.how = 'ก';
    payTo(ctx, life, f, f.price);
  } else if (way === 'ข') {
    const roll = rng.int(1, 20) + (has(['trade', 'charm']) ? 2 : 0);
    if (roll >= 12) {
      f.price = Math.round(f.price * 0.8);
      f.how = 'ข+';
    } else {
      f.trust -= 1;
      f.how = 'ข-';
    }
    payTo(ctx, life, f, f.price);
  } else if (way === 'ค') {
    f.how = 'ค';
    f.price = Math.round(f.price * 0.5);
    f.slow += 1;
    payTo(ctx, life, f, f.price);
    if (!life.aptitudes.smithing) apply(ctx, [{ k: 'stat', stat: 'smithing', delta: 1 }], src);
  } else {
    f.step = 'save';
    f.since = life.hAge;
    note(ctx, 'forge', f.weapon, { step: 'save', price: f.price }, 1);
    return;
  }
  wait(ctx, life, f);
}

function payTo(ctx: Ctx, life: LifeState, f: ForgeState, n: number): void {
  const m = Math.min(life.gold, n);
  if (m > 0) apply(ctx, [{ k: 'stat', stat: 'gold', delta: -m }], src);
  f.paid = m;
}

function wait(ctx: Ctx, life: LifeState, f: ForgeState): void {
  f.step = 'wait';
  let beats = FORGE_BEATS[f.tier] ?? 1;
  const flags = travelGeo(ctx).byContinent.get(f.place.slice(0, 2) as never) ?? [];
  const war = flags.some((x) => (ctx.state.world.countryFlags[x.id] ?? []).includes('war'));
  if (war || (happened(ctx, 'DR-04') && f.place.startsWith('KD') && f.tier === 'E')) beats *= 2;
  f.until = beatOf(ctx, life) + beats;
  note(ctx, 'forge', f.weapon, { step: 'wait', tier: f.tier, price: f.price, how: f.how ?? '', beats }, 1);
}

function resumeSave(ctx: Ctx, life: LifeState, f: ForgeState): void {
  if (life.hAge - f.since > FORGE_SAVE_YEARS) return abort(ctx, life, f, 'saved too long');
  if (life.gold >= f.price) {
    f.how = 'ง';
    payTo(ctx, life, f, f.price);
    wait(ctx, life, f);
  }
}

/** §8: the outcome of a roll. A natural 20 is a masterpiece, and so is a 19 when the smith can make better than what was ordered; a 1 or a sum 5 under the difficulty fails; under it is flawed. */
export function forgeOutcome(d20: number, sum: number, diff: number, smithAbove: boolean): 'fail' | 'flawed' | 'ordered' | 'masterpiece' {
  if (d20 === 20 || (d20 === 19 && smithAbove)) return 'masterpiece';
  if (d20 === 1 || sum <= diff - 5) return 'fail';
  if (sum < diff) return 'flawed';
  return 'ordered';
}

/** What a smith of each kind adds to the roll and the best tier it can make (10-forging.md §4). */
export const SMITH_KIND = SMITH;

/** The roll of the result (§8) and what it gives. */
function result(ctx: Ctx, life: LifeState, f: ForgeState): void {
  const c = catalog(ctx);
  const ex = extOf(life);
  const rng = ctx.rng('life.items.forge');
  const roll = c.forging.roll;
  const w = c.weapons.get(f.weapon)!;
  const self = f.how === 'self';
  const skill = self ? (life.aptitudes.smithing ?? 0) * 2 : SMITH[f.kind].skill;
  const mat = f.material ? (RANK[c.materials.get(f.material)?.rarity ?? 'C'] > RANK[f.tier as Rarity] ? 2 : RANK[c.materials.get(f.material)?.rarity ?? 'C'] < RANK[f.tier as Rarity] ? -2 : 0) : 0;
  const trust = f.trust >= 4 ? 1 : 0;
  const god = whisperBonus(ctx, 'forge');
  const d20 = rng.int(1, 20);
  const diff = roll.difficulty[f.tier] ?? 9;
  const sum = d20 + skill + mat + trust + god;
  const outcome = forgeOutcome(d20, sum, diff, SMITH[f.kind].max > RANK[f.tier as Rarity]);
  ex.forge = undefined;
  ex.forgeLast = life.hAge;
  if (outcome === 'fail') {
    if (f.material) life.items.splice(life.items.indexOf(f.material), 1);
    if (f.paid) apply(ctx, [{ k: 'stat', stat: 'gold', delta: Math.floor(f.paid / 2) }], src);
    note(ctx, 'forge', f.weapon, { step: 'result', outcome, sum, diff, smith: f.smithName }, 2);
    return;
  }
  let id = f.weapon;
  const mod: WeaponMod = { name: `${w.name}ของ${f.smithName}`, by: f.smithName, year: ctx.state.clock.worldYear };
  if (f.material && life.items.includes(f.material)) life.items.splice(life.items.indexOf(f.material), 1);
  if (outcome === 'flawed') {
    const stat = rng.pick(['pow', 'spd', 'vit']);
    mod.stat = { [stat]: -1 };
    mod.flaw = stat;
  } else if (outcome === 'masterpiece') {
    // 25% a tier up for C to R (E never becomes L)
    if (RANK[w.rarity] < RANK.E && rng.chance(roll.masterpieceUpgradeChance)) {
      const up = [...(c.byGroup.get(w.group) ?? [])].find((x) => RANK[x.rarity] === RANK[w.rarity] + 1 && x.apt === w.apt && !life.items.includes(x.id));
      if (up) id = up.id;
    }
    const r = rng.int(1, 6);
    const apt = w.apt.split(/\s+/)[0];
    if (r === 1) mod.unbreakable = true;
    else if (r === 2) mod.engrave = true;
    else if (r === 3) mod.stat = { [STAT_OF[apt] ?? 'pow']: 1 };
    else if (r === 4) mod.stance = 1;
    else if (r === 5) mod.parry = true;
    else {
      const el = c.materials.get(f.material ?? '')?.tags?.[0];
      if (el) mod.tags = [el];
      else mod.stat = { luk: 1 };
    }
  }
  apply(ctx, [{ k: 'grant', kind: 'weapon', id }], src);
  ex.mods[id] = mod;
  ex.stats.forged += 1;
  note(ctx, 'forge', id, { step: 'result', outcome, sum, diff, smith: f.smithName, name: mod.name ?? '' }, 2);
}

/** One beat: moves the chain along when its time is up. */
export function forgeBeat(ctx: Ctx, life: LifeState): void {
  const ex = extOf(life);
  const f = ex.forge;
  if (!f) return;
  const now = beatOf(ctx, life);
  if (f.step === 'road') {
    // a smith in another country: the travel system takes the character there and brings it back (it is away, `cause: forge`)
    if (f.place !== life.country) {
      const t = travelExt(life);
      const r = go(ctx, f.place, 'forge', { smuggle: false });
      if (!r.legs) return abort(ctx, life, f, 'road');
      t.away = { cause: 'forge', to: life.country, until: now + 1 + r.delay + Math.ceil(r.days / 90) + 2, settle: false };
      f.slow += r.delay;
    }
    f.step = f.trial ? 'trial' : 'order';
  }
  if (f.step === 'trial') {
    if (!trial(ctx, life, f)) return abort(ctx, life, f, 'trial');
    f.step = 'order';
  }
  if (f.step === 'order') {
    order(ctx, life, f);
    return;
  }
  if (f.step === 'wait' && now >= f.until) result(ctx, life, f);
}

