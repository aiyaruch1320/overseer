// The main character as a fighter: hit points, the stances open to him, what each rolls with (01-core.md §3 and §4).
import { extOf as charExt, idx, tagsOf } from '../character';
import type { Ctx } from '../game';
import type { LifeState } from '../types';
import { indexOf, type WeaponLite } from './data';
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

export interface Hero {
  life: LifeState;
  tags: Set<string>;
  /** Attack tags the hero has from gifts and the like (`fire` from `b_firetouch`). */
  gift: string[];
  maxHp: number;
  hp: number;
  /** Item weapon for melee and for ranged, or the implied one. */
  melee?: WeaponLite;
  ranged?: WeaponLite;
  shield: boolean;
  /** Power added to the roll of the fight stances: the best weapon's, or 1 for a hero whose job is the sword (assumption until the items system gives weapons). */
  power: number;
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
  const ix = indexOf(ctx);
  const tags = tagsOf(ctx, life);
  let melee: WeaponLite | undefined;
  let ranged: WeaponLite | undefined;
  let shield = false;
  for (const id of life.items) {
    const w = ix.weapons.get(id);
    if (!w) continue;
    if (w.apt === 'shield') shield = true;
    else if (RANGED_APTS.includes(w.apt) || w.tags.includes('ranged')) {
      if (!ranged || w.power > ranged.power) ranged = w;
    } else if (MELEE_APTS.includes(w.apt) || w.tags.some((t) => ['blade', 'blunt', 'pierce'].includes(t))) {
      if (!melee || w.power > melee.power) melee = w;
    }
  }
  const heldPower = Math.max(melee?.power ?? 0, ranged?.power ?? 0);
  const power = heldPower || (life.job && SOLDIER_JOBS.has(life.job) ? 1 : 0);
  const gift = [...tags].filter((t) => ATTACK_TAGS.has(t) && t !== 'ranged');
  return {
    life,
    tags,
    gift,
    maxHp: maxHpOf(ctx, life),
    hp: hpOf(ctx, life),
    melee,
    ranged,
    shield,
    power,
    companion: companionOf(ctx, life),
    seer: SEER_TAGS.some((t) => tags.has(t)) || SEER_SKILLS.some((s) => life.skills.includes(s)),
    apt: (id) => life.aptitudes[id] ?? 0,
  };
}

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
