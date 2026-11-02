// Holding and wearing (docs/systems/items/11-item-system.md §3 "การสวมอัตโนมัติ"): the character picks, for each slot, the piece with the best score,
// again when something comes or goes and once a year. The god does not pick (that comes last in the plan). What combat reads of it is here:
// `wielded(ctx)`, `armorOf(ctx)`, `gearStats(ctx)`, `gearTags(ctx)`.
import type { Ctx } from '../game';
import { extOf as charExt, tagsOf } from '../character';
import type { Ability, Item, Weapon } from '../data/types-items';
import type { LifeState, StatBlock } from '../types';
import { catalog, RANK } from './data';
import { extOf, type ItemsExt, type WeaponMod } from './state';
import { ADULT_FROM, ARMOR_LOSSES_PER_POINT, ARMOR_STEP, DAMAGE_FLOOR, DULL_POWER, ENGRAVE_BONUS, SCORE_DEFENCE, SCORE_SKILLED, SCORE_TIER, SCORE_UNSKILLED, SKEPTIC_REFUSE } from './tuning';
import { logGear } from './log';

const MAIN_STAT: Record<string, keyof StatBlock> = { sword: 'pow', axe: 'pow', spear: 'pow', hammer: 'pow', unarmed: 'pow', shield: 'vit', bow: 'spd', dagger: 'spd', whip: 'spd', sling: 'luk', magic: 'mag' };
/** The main stance of a kind of weapon (the "ท่าทีหลักของประเภท" of a masterpiece, combat/01-core.md §3). */
const MAIN_STANCE: Record<string, string> = { sword: 'ปะทะประชิด', axe: 'ปะทะประชิด', spear: 'ปะทะประชิด', hammer: 'ปะทะประชิด', unarmed: 'ปะทะประชิด', dagger: 'ปะทะประชิด', whip: 'ปะทะประชิด', bow: 'ยิงระยะไกล', sling: 'ยิงระยะไกล', shield: 'ตั้งรับ' };

const has = (list: readonly Ability[], k: Ability['k']) => list.some((a) => a.k === k);

/** What combat needs to know of the weapon in the hand. */
export interface Wielded {
  id: string;
  name: string;
  rarity: string;
  /** Power after dullness (−2) and a bound weapon in a stranger's hand (0). */
  power: number;
  type: string;
  /** The aptitude the type trains, and whether the character has it (no aptitude: −1 on the roll, README §2; everyday articles are exempt). */
  apt: string;
  skilled: boolean;
  unskilled: boolean;
  /** Attack tags and element tags, plus `#` tags and `poison` when the weapon poisons (README §3). */
  tags: string[];
  stats: Record<string, number>;
  everyday: boolean;
  reach: boolean;
  parry: boolean;
  twoHand: boolean;
  conceal: boolean;
  unbreakable: boolean;
  poison: boolean;
  intimidate: boolean;
  engrave: boolean;
  bound: boolean;
  dull: boolean;
  /** Stance name → bonus (`ท่าทีเจรจา +2`). */
  stances: Record<string, number>;
  /** Enemy codes and enemy-kind words the weapon drives off (`ไล่ X`: DC −2). */
  repel: { codes: string[]; words: string[] };
  /** Situational bonuses (`ในน้ำ +4`, `บนหลังสัตว์ +2`): the subject as written, the number, and whether it is a percentage as a fraction. */
  bonus: { subject: string; n: number; pct: boolean }[];
  /** Aptitudes the weapon serves as a tool for (+1 on the job roll). */
  tool: string[];
  /** Abilities the data keeps as prose (the director and the screens show them; combat may ignore them). */
  text: string[];
}

export interface Armor {
  id?: string;
  /** Points of defence after wear. */
  defense: number;
  /** The damage factor (1 − 0.04 N), 1 with none. */
  mult: number;
  shield: boolean;
  tags: string[];
}

export function isShield(i: Item): boolean {
  return i.cat === 'armor' && (/^ar_.*shield/.test(i.id) || i.name.includes('โล่') || i.kind === 'โล่');
}

const statNet = (s: Record<string, number>, main?: string) => {
  let v = 0;
  for (const [k, n] of Object.entries(s)) v += n > 0 ? n * (k === main ? 2 : 1) : n;
  return v;
};

function aptLevel(life: LifeState, apt: string): number {
  return Math.max(0, ...apt.split(/\s+/).map((a) => life.aptitudes[a] ?? 0));
}

/** The weapon as the character holds it: the data plus what a smith did (mods) and the wear (dullness). */
export function describe(ctx: Ctx, life: LifeState, w: Weapon, ex: ItemsExt = extOf(life)): Wielded {
  const mod: WeaponMod = ex.mods[w.id] ?? {};
  const ab = w.abilities;
  const dull = ex.dull.includes(w.id) && !mod.unbreakable && !has(ab, 'unbreakable');
  const everyday = w.group === 'everyday';
  const skilled = aptLevel(life, w.apt) > 0;
  const stats = { ...w.stats };
  for (const [k, n] of Object.entries(mod.stat ?? {})) stats[k] = (stats[k] ?? 0) + n;
  const stances: Record<string, number> = {};
  for (const a of ab) if (a.k === 'stance' && a.stance) stances[a.stance] = (stances[a.stance] ?? 0) + (a.n ?? 0);
  if (mod.stance) {
    const s = MAIN_STANCE[w.apt.split(/\s+/)[0]] ?? 'ปะทะประชิด';
    stances[s] = (stances[s] ?? 0) + mod.stance;
  }
  const tags = [...w.tags, ...(mod.tags ?? [])];
  if (has(ab, 'poison') && !tags.includes('poison')) tags.push('poison');
  const repel = { codes: [] as string[], words: [] as string[] };
  for (const a of ab) if (a.k === 'repel') (repel.codes.push(...(a.codes ?? [])), repel.words.push(...(a.words ?? [])));
  const power = Math.max(0, w.power - (dull ? DULL_POWER : 0));
  return {
    id: w.id,
    name: mod.name ?? w.name,
    rarity: w.rarity,
    power,
    type: w.type,
    apt: w.apt,
    skilled,
    unskilled: !everyday && !skilled,
    tags,
    stats,
    everyday,
    reach: has(ab, 'reach'),
    parry: has(ab, 'parry') || !!mod.parry,
    twoHand: has(ab, 'twohand'),
    conceal: has(ab, 'conceal'),
    unbreakable: has(ab, 'unbreakable') || !!mod.unbreakable,
    poison: has(ab, 'poison'),
    intimidate: has(ab, 'intimidate'),
    engrave: has(ab, 'engrave') || !!mod.engrave,
    bound: has(ab, 'bound'),
    dull,
    stances,
    repel,
    bonus: ab.filter((a) => a.k === 'bonus' && a.subject).map((a) => ({ subject: a.subject as string, n: a.n ?? 0, pct: !!a.pct })),
    tool: ab.filter((a) => a.k === 'tool' && a.apt).map((a) => a.apt as string),
    text: ab.filter((a) => a.k === 'text' || a.k === 'bonus').map((a) => a.text),
  };
}

// ---------- scores ----------

function tagAffinity(ctx: Ctx, life: LifeState, tags: readonly string[]): number {
  // the tags the character has without the gear: a piece is not liked for the tags it brings itself
  const mine = tagsOf(ctx, life, { gear: false });
  let n = 0;
  for (const t of tags) if (mine.has(t.replace(/^#/, ''))) n += 1;
  return n;
}

export function weaponScore(ctx: Ctx, life: LifeState, w: Weapon, ex: ItemsExt): number {
  const d = describe(ctx, life, w, ex);
  const main = MAIN_STAT[w.apt.split(/\s+/)[0]];
  let s = RANK[w.rarity] * SCORE_TIER + d.power + statNet(d.stats, main) + tagAffinity(ctx, life, w.tags);
  if (!d.everyday) s += d.skilled ? SCORE_SKILLED : SCORE_UNSKILLED;
  // a weapon that serves the character's job as a tool is worth a point
  if (life.job && d.tool.length && d.tool.some((a) => life.aptitudes[a])) s += 1;
  return s;
}

export function armorScore(ctx: Ctx, life: LifeState, i: Item, ex: ItemsExt): number {
  const def = defenseOf(i, ex);
  return RANK[i.tier] * SCORE_TIER + def * SCORE_DEFENCE + statNet(i.stats, 'vit') + tagAffinity(ctx, life, i.tags);
}

export function charmScore(ctx: Ctx, life: LifeState, i: Item): number {
  return RANK[i.tier] * SCORE_TIER + statNet(i.stats) + tagAffinity(ctx, life, i.tags);
}

/** Defence of an armour after wear (E and L do not wear). */
export function defenseOf(i: Item, ex: ItemsExt): number {
  const base = i.defense ?? 0;
  if (RANK[i.tier] >= RANK.E) return base;
  return Math.max(0, base - Math.floor((ex.losses[i.id] ?? 0) / ARMOR_LOSSES_PER_POINT));
}

/** Everything the character holds in a kind, with duplicates counted once. */
function owned<T>(life: LifeState, get: (id: string) => T | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of life.items) {
    if (seen.has(id)) continue;
    seen.add(id);
    const t = get(id);
    if (t) out.push(t);
  }
  return out;
}

/** Picks the weapon, the armour, two ornaments and one charm with the best scores (a child holds only the articles near at hand). */
export function equip(ctx: Ctx, life: LifeState): void {
  const c = catalog(ctx);
  const ex = extOf(life);
  const rng = ctx.rng('life.items');
  const before = [ex.wield, ex.armor, ex.charm, ...ex.acc].join('|');
  const adult = life.hAge >= ADULT_FROM;
  // the weapon
  let wield: string | undefined;
  let best = -Infinity;
  for (const w of owned(life, (id) => c.weapons.get(id))) {
    if (!adult && w.group !== 'everyday') continue;
    const s = weaponScore(ctx, life, w, ex);
    if (s > best) {
      best = s;
      wield = w.id;
    }
  }
  ex.wield = wield;
  const two = wield ? !!c.weapons.get(wield)?.abilities.some((a) => a.k === 'twohand') : false;
  // armour (a shield cannot go with a two-handed weapon)
  let armor: string | undefined;
  best = -Infinity;
  if (adult)
    for (const i of owned(life, (id) => c.items.get(id))) {
      if (i.cat !== 'armor' || (two && isShield(i))) continue;
      const s = armorScore(ctx, life, i, ex);
      if (s > best) {
        best = s;
        armor = i.id;
      }
    }
  ex.armor = armor;
  // ornaments: the two best
  ex.acc = adult
    ? owned(life, (id) => c.items.get(id))
        .filter((i) => i.cat === 'accessory')
        .map((i) => ({ id: i.id, s: charmScore(ctx, life, i) }))
        .sort((a, b) => b.s - a.s || a.id.localeCompare(b.id))
        .slice(0, 2)
        .map((x) => x.id)
    : [];
  // one charm: an ancient talisman or a folk charm; a skeptic turns the strong ones down half the time
  let charm: string | undefined;
  best = -Infinity;
  if (adult)
    for (const i of owned(life, (id) => c.items.get(id))) {
      if (i.cat !== 'talisman' && i.cat !== 'folk') continue;
      if (life.traits.includes('skeptic') && RANK[i.tier] >= RANK.E) {
        if (!ex.refused.includes(i.id) && !ex.trusted.includes(i.id)) (rng.chance(SKEPTIC_REFUSE) ? ex.refused : ex.trusted).push(i.id);
        if (ex.refused.includes(i.id)) continue;
      }
      const s = charmScore(ctx, life, i);
      if (s > best) {
        best = s;
        charm = i.id;
      }
    }
  ex.charm = charm;
  const after = [ex.wield, ex.armor, ex.charm, ...ex.acc].join('|');
  if (after !== before) logGear(ctx, ex);
}

// ---------- what combat reads ----------

/** The weapon in the hand. With none in the bag the character picks up the article near at hand that fits an aptitude (README §4: anywhere, any age). */
export function wielded(ctx: Ctx): Wielded {
  const life = ctx.state.life;
  const c = catalog(ctx);
  if (!life) return describe(ctx, { aptitudes: {}, items: [], ext: {} } as unknown as LifeState, c.weapons.get('wi_stick')!, extOf({ ext: {} } as unknown as LifeState));
  const ex = extOf(life);
  const w = ex.wield ? c.weapons.get(ex.wield) : undefined;
  if (w && life.items.includes(w.id)) return describe(ctx, life, w, ex);
  return describe(ctx, life, nearAtHand(ctx, life), ex);
}

/** The everyday article that best fits the character: of an aptitude the character has, else the stick. */
export function nearAtHand(ctx: Ctx, life: LifeState): Weapon {
  const c = catalog(ctx);
  let best: Weapon | undefined;
  let lv = 0;
  for (const [apt, list] of c.everyday) {
    const l = aptLevel(life, apt);
    if (l > lv) {
      lv = l;
      best = list[0];
    }
  }
  // a job with a tool hand: the job's aptitude (a farmer's hoe)
  return best ?? c.weapons.get('wi_stick')!;
}

/** The armour worn and the damage factor it gives (1 − 0.04 N). The shield's extra step in the defensive stance is `shieldMult`. */
export function armorOf(ctx: Ctx): Armor {
  const life = ctx.state.life;
  if (!life) return { defense: 0, mult: 1, shield: false, tags: [] };
  const ex = extOf(life);
  const i = ex.armor ? catalog(ctx).items.get(ex.armor) : undefined;
  if (!i || !life.items.includes(i.id)) return { defense: 0, mult: 1, shield: false, tags: [] };
  const def = defenseOf(i, ex);
  return { id: i.id, defense: def, mult: 1 - ARMOR_STEP * def, shield: isShield(i), tags: i.tags };
}

/** The factor of a shield in the defensive stance: ×0.5 less 0.05 for each point of defence of the shield (11-item-system.md §4), never below the floor. */
export function shieldMult(ctx: Ctx): number {
  const a = armorOf(ctx);
  if (!a.shield) return 1;
  return Math.max(DAMAGE_FLOOR, 0.5 - 0.05 * a.defense);
}

/** The floor under the product of all the damage factors (×0.35). */
export const damageFloor = (): number => DAMAGE_FLOOR;

const STAT_KEYS = ['pow', 'mag', 'spd', 'luk', 'int', 'vit'] as const;

/** The pieces the character has on: the weapon, the armour, two ornaments, one charm. */
export function worn(ctx: Ctx): string[] {
  const life = ctx.state.life;
  if (!life) return [];
  const ex = extOf(life);
  return [ex.wield, ex.armor, ...ex.acc, ex.charm].filter((x): x is string => !!x && life.items.includes(x));
}

/** The stats the gear adds while worn (the weapon in the hand, armour, ornaments, the charm). */
export function gearStats(ctx: Ctx): Partial<StatBlock> {
  const life = ctx.state.life;
  const out: Partial<StatBlock> = {};
  if (!life) return out;
  const c = catalog(ctx);
  const add = (s: Record<string, number>) => {
    for (const k of STAT_KEYS) if (s[k]) out[k] = (out[k] ?? 0) + s[k];
  };
  const w = wielded(ctx);
  if (!w.everyday || Object.keys(w.stats).length) add(w.stats);
  for (const id of worn(ctx).filter((x) => !/^w[a-z]_/.test(x))) {
    const i = c.items.get(id);
    if (i) add(i.stats);
  }
  return out;
}

/** The tags the gear gives the character while worn (README §3 `#แท็ก`, items `tags`). Bare names, without `#`. */
export function gearTags(ctx: Ctx): string[] {
  const life = ctx.state.life;
  if (!life) return [];
  const c = catalog(ctx);
  const out = new Set<string>();
  for (const t of wielded(ctx).tags) out.add(t.replace(/^#/, ''));
  for (const id of worn(ctx).filter((x) => !/^w[a-z]_/.test(x))) for (const t of c.items.get(id)?.tags ?? []) out.add(t.replace(/^#/, ''));
  return [...out];
}

/** The +1 an engraved weapon gives against a kind it has killed. */
export function engravedBonus(ctx: Ctx, enemy: string): number {
  const life = ctx.state.life;
  if (!life) return 0;
  const w = wielded(ctx);
  if (!w.engrave) return 0;
  return extOf(life).engraved[w.id]?.includes(enemy) ? ENGRAVE_BONUS : 0;
}

export { charExt };
