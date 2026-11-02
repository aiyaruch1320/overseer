// The main character as a fighter: hit points, the stances open to him, what each rolls with (01-core.md §3 and §4).
import { partyEffects } from '../bonds';
import { extOf as charExt, idx, tagsOf } from '../character';
import type { Ctx } from '../game';
import { armorOf, gearStats, wielded, type Armor, type Wielded } from '../items';
import type { LifeState, StatBlock } from '../types';
import { indexOf } from './data';
import { ATTACK_TAGS } from './matrix';
import { extOf } from './state';
import {
  CALM, COMPANION_ASSIST, COMPANION_TAG, HP, LIFE_SHARE, SEER_SKILLS, SEER_TAGS, SOLDIER_JOBS, THICK_HIDE,
} from './tuning';

const MELEE_APTS = ['sword', 'axe', 'spear', 'dagger', 'unarmed', 'hammer', 'whip', 'mounted'];
const RANGED_APTS = ['bow', 'sling'];

export interface Companion {
  /** Level of the best assisting ability (+1..+3) and the tag it adds. */
  assist: number;
  tags: string[];
  thick: number;
  lifeShare: number;
  danger: boolean;
  distract: boolean;
  guard: boolean;
  heal: boolean;
}

/** The weapon in the hand as the stances read it: the first aptitude it trains, its attack tags, and the weapon of the items system behind it. */
export interface Held {
  id: string;
  apt: string;
  tags: string[];
  power: number;
  w: Wielded;
}

export interface Hero {
  life: LifeState;
  tags: Set<string>;
  /** Attack tags the hero has from gifts and the like (`fire` from `b_firetouch`). */
  gift: string[];
  maxHp: number;
  hp: number;
  /** The weapon in the hand (items `wielded`): in the melee stance or, when it shoots, in the ranged one. */
  melee?: Held;
  ranged?: Held;
  /** The staff, wand or book in the hand: it adds its power to the magic stance only. */
  focus?: Held;
  /** The weapon of the items system whatever its kind (an article near at hand when the bag holds none). */
  weapon?: Wielded;
  /** The armour worn (items `armorOf`): the damage factor and whether it is a shield. */
  armor: Armor;
  shield: boolean;
  /** What the gear adds to the six stats while worn (items `gearStats`). */
  gear: Partial<StatBlock>;
  /** What the party of the character gives to a fight (bonds `partyEffects`): the roll as a share, the damage cut, the people. */
  party: { rollPct: number; cutPct: number; members: number };
  /** Power added to the roll of the fight stances: the weapon in the hand, or 1 for a hero whose job is the sword (the stand-in of a bag with no weapon). */
  power: number;
  /** The power of the focus for the magic stance. */
  magicPower: number;
  companion: Companion;
  seer: boolean;
  /** Level of an aptitude, 0 when none. */
  apt(id: string): number;
}

export const maxHpOf = (ctx: Ctx, life: LifeState): number => {
  const e = extOf(life);
  const hurt = e.hurt && life.hAge < e.hurt.until ? e.hurt.amount : 0;
  return Math.max(HP.floor, HP.base + life.stats.vit * HP.perVit + charExt(life).hpBonus - hurt);
};

/** Hit points now; a life that has none yet starts full. */
export function hpOf(ctx: Ctx, life: LifeState): number {
  const e = extOf(life);
  if (e.hp === null) e.hp = maxHpOf(ctx, life);
  return e.hp;
}

/** Heals (or hurts, with a negative number) the hero; returns the hit points now. Used by prayers and rest. */
export function addHp(ctx: Ctx, life: LifeState, by: number): number {
  const e = extOf(life);
  const max = maxHpOf(ctx, life);
  e.hp = Math.max(0, Math.min(max, hpOf(ctx, life) + by));
  return e.hp;
}

function companionOf(ctx: Ctx, life: LifeState): Companion {
  const ix = indexOf(ctx);
  const out: Companion = { assist: 0, tags: [], thick: 0, lifeShare: 0, danger: false, distract: false, guard: false, heal: false };
  for (const id of charExt(life).companions) {
    const sp = ix.species.get(id);
    if (!sp) continue;
    for (const a of sp.abilities) {
      if (COMPANION_ASSIST.includes(a.id) && a.level > out.assist) {
        out.assist = a.level;
        out.tags = COMPANION_TAG[a.id] ? [COMPANION_TAG[a.id]] : [];
      }
      if (a.id === 'pa_thick_hide') out.thick = Math.max(out.thick, a.level);
      else if (a.id === 'pa_life_share') out.lifeShare = Math.max(out.lifeShare, a.level);
      else if (a.id === 'pa_danger_sense' || a.id === 'pa_night_watch') out.danger = true;
      else if (a.id === 'pa_distract') out.distract = true;
      else if (a.id === 'pa_guard_stance') out.guard = true;
      else if (a.id === 'pa_lick_heal') out.heal = true;
    }
  }
  return out;
}

export const thickMul = (c: Companion): number => THICK_HIDE[Math.min(3, c.thick)] ?? 1;
export const shareOf = (c: Companion): number => LIFE_SHARE[Math.min(3, c.lifeShare)] ?? 0;

export function buildHero(ctx: Ctx, life: LifeState): Hero {
  const tags = tagsOf(ctx, life);
  // one weapon is in the hand (items `wielded`); a bow or a sling shoots, every other weapon strikes
  const w = wielded(ctx);
  const apts = w.apt.split(/\s+/);
  const first = apts.find((a) => (life.aptitudes[a] ?? 0) > 0) ?? apts[0];
  const held: Held = { id: w.id, apt: first, tags: w.tags.map((t) => t.replace(/^#/, '')), power: w.power, w };
  // a staff, a wand or a book (the aptitude `magic`) is the focus of the magic stance, not a blade: it strikes as a fist does
  const focus = first === 'magic' ? held : undefined;
  const shoots = !focus && (RANGED_APTS.includes(first) || held.tags.includes('ranged'));
  const melee = shoots || focus ? undefined : held;
  const ranged = shoots ? held : undefined;
  const armor = armorOf(ctx);
  const power = melee || ranged ? w.power || (life.job && SOLDIER_JOBS.has(life.job) ? 1 : 0) : life.job && SOLDIER_JOBS.has(life.job) ? 1 : 0;
  const gift = [...tags].filter((t) => ATTACK_TAGS.has(t) && t !== 'ranged');
  const party = partyEffects(ctx);
  return {
    life,
    tags,
    gift,
    maxHp: maxHpOf(ctx, life),
    hp: hpOf(ctx, life),
    melee,
    ranged,
    focus,
    weapon: w,
    armor,
    shield: armor.shield || first === 'shield',
    gear: gearStats(ctx),
    party: { rollPct: party.rollPct, cutPct: party.cutPct, members: party.members.length },
    power,
    magicPower: focus ? focus.power : 0,
    companion: companionOf(ctx, life),
    seer: SEER_TAGS.some((t) => tags.has(t)) || SEER_SKILLS.some((s) => life.skills.includes(s)),
    apt: (id) => life.aptitudes[id] ?? 0,
  };
}

/** A stat of the hero with the gear on (the six stats of `StatBlock`). */
export const statOf = (hero: Hero, key: keyof StatBlock): number => hero.life.stats[key] + (hero.gear[key] ?? 0);

/** Aptitudes of the magic group the hero has, best first (the order of the data breaks ties). */
export function magicApts(ctx: Ctx, hero: Hero): { id: string; level: number; stat: string; tags: string[] }[] {
  const out: { id: string; level: number; stat: string; tags: string[] }[] = [];
  for (const a of idx(ctx).aptitudeList) {
    if (a.group !== 'magic') continue;
    const level = hero.apt(a.id);
    if (level > 0) out.push({ id: a.id, level, stat: a.stat, tags: a.tags.map((t) => t.replace(/^#/, '')) });
  }
  return out.sort((a, b) => b.level - a.level);
}

/** The best melee and the best ranged aptitude the hero has, when he holds no weapon of that kind. */
export function bestApt(hero: Hero, ids: string[]): { id: string; level: number } | undefined {
  let best: { id: string; level: number } | undefined;
  for (const id of ids) {
    const level = hero.apt(id);
    if (level > 0 && (!best || level > best.level)) best = { id, level };
  }
  return best;
}

export const MELEE = MELEE_APTS;
export const RANGED = RANGED_APTS;
export const calmable = (hero: Hero): boolean => CALM.tags.some((t) => hero.tags.has(t)) || CALM.aptitudes.some((a) => hero.apt(a) > 0);
