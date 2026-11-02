// What a fight leaves: permanent wounds (01-core.md §5), loot by tier (05-rewards.md §2 to §5), the quiet wins (§6) and the titles (§7).
import { idx } from '../character';
import type { Ctx } from '../game';
import { write } from '../log';
import { apply, type EffectSource } from '../rules';
import type { Effect } from '../types';
import { indexOf } from './data';
import { bump, extOf } from './state';
import {
  EXTRA_CURSE, FLAWLESS, INJURY_CURSE, KILL_NPC_CURSE, KIND_GIFT_SHARE, LONG_INJURY, LOOT, MASS_CURSE_MUL, MATERIAL_BY_KIND, QUIET, RARITY_SHIFT,
  RARITY_WEIGHT, SCAR_FAME, STREAM, TAME_COMPANION, TITLES, WEAPON_DROP, WEAPON_GROUPS, WEAPON_MAX_RARITY, WILD_DRAGONS,
} from './tuning';
import type { FightOpts, Foe } from './types';
import type { Hero } from './hero';

const SRC: EffectSource = { sys: 'combat', stream: STREAM.loot };
const RARITY_ORDER = ['C', 'U', 'R', 'E', 'L'];

function give(ctx: Ctx, effects: Effect[], id?: string): void {
  apply(ctx, effects, id ? { ...SRC, id } : SRC);
}

/** The rarity a drop may reach: R for the ordinary, E for a boss, L for a legend (05 §2 "เลื่อนตามระดับศัตรู"). */
function rarityDraw(ctx: Ctx, foe: Foe, cap: string): string {
  const shift = RARITY_SHIFT[foe.rewardRow] ?? {};
  const top = RARITY_ORDER.indexOf(cap);
  const reach = foe.rewardRow === 'legend' ? 4 : foe.rewardRow === 'boss' || foe.rewardRow === 'elite' ? 3 : 2;
  const ranks = RARITY_ORDER.slice(0, Math.min(reach, top) + 1);
  const rng = ctx.rng(STREAM.loot);
  const w = ranks.map((r) => (RARITY_WEIGHT[r] ?? 0) * (shift[r] ?? 1));
  const i = rng.weighted(w);
  return ranks[Math.max(0, i)];
}

// ---------- permanent wounds ----------

/** The curse an injury leaves, by the kind of blow the foe struck with. */
function injuryCurse(ctx: Ctx, foe: Foe): string {
  const rng = ctx.rng(STREAM.loot);
  const blow = foe.attack.find((a) => INJURY_CURSE[a]);
  return rng.pick(INJURY_CURSE[blow ?? 'default']);
}

/** The curse an enemy hands on (05 §5): the list of its kind, else an injury. */
function foeCurse(ctx: Ctx, foe: Foe): string {
  const ix = indexOf(ctx);
  const rng = ctx.rng(STREAM.loot);
  for (const k of foe.kinds) {
    const g = ix.giftsByKind.get(k);
    if (g?.curses.length) return rng.pick(g.curses);
  }
  const npc = ix.giftsByKind.get('humanoid');
  if (foe.kinds.includes('humanoid') && npc?.curses.length && foe.named) return rng.pick(npc.curses);
  return injuryCurse(ctx, foe);
}

/**
 * The d100 of 01-core.md §5 after a lost fight: nothing (1–60), a scar with a story (61–80), a long injury (81–90), a curse of the blow
 * (91–96), a curse of the enemy (97–100). Returns what the hero keeps. A mass battle or a lost raid doubles the chance of the curses.
 */
export function rollWound(ctx: Ctx, hero: Hero, foe: Foe, node: string | undefined, mass = false): string[] {
  const life = hero.life;
  const rng = ctx.rng(STREAM.loot);
  const rows = indexOf(ctx).combat.damage.wounds;
  let d = rng.int(1, 100);
  if (mass && d < 91 && rng.chance((MASS_CURSE_MUL - 1) * 0.1)) d = 91;
  const row = rows.find((r) => d >= r.from && d <= r.to);
  const out: string[] = [];
  const wound = () => give(ctx, [{ k: 'wound' }], node);
  if (row && row.from >= 97) {
    wound();
    const id = foeCurse(ctx, foe);
    give(ctx, [{ k: 'grant', kind: 'curse', id }], node);
    out.push(id);
  } else if (row && row.from >= 91) {
    wound();
    const id = injuryCurse(ctx, foe);
    give(ctx, [{ k: 'grant', kind: 'curse', id }], node);
    out.push(id);
  } else if (row && row.from >= 81) {
    wound();
    extOf(life).hurt = { amount: LONG_INJURY.hp, until: life.hAge + LONG_INJURY.years };
    out.push('injury');
  } else if (row && row.from >= 61) {
    wound();
    give(ctx, [{ k: 'stat', stat: 'fame', delta: SCAR_FAME }], node);
    out.push('scar');
  }
  // the blow carries more than steel (01-core.md §5 last paragraph)
  const extra: [string, number][] = [];
  if (foe.attack.includes('poison')) extra.push([EXTRA_CURSE.poison[0], EXTRA_CURSE.poison[1]]);
  if (foe.kinds.includes('undead')) extra.push([EXTRA_CURSE.undead[0], EXTRA_CURSE.undead[1]]);
  if (foe.ids.includes('vampire') || foe.ids.includes('vampire_spawn')) extra.push([EXTRA_CURSE.vampire[0], EXTRA_CURSE.vampire[1]]);
  for (const [id, p] of extra) {
    if (life.curses.includes(id) || !rng.chance(p)) continue;
    give(ctx, [{ k: 'grant', kind: 'curse', id }], node);
    out.push(id);
  }
  if (out.length) write(ctx.state, { sys: 'combat', kind: 'wound', id: foe.lead, data: { wounds: out.join(','), roll: d, node: node ?? null }, level: 2 });
  return out;
}

// ---------- loot ----------

let bioCache: WeakMap<object, Map<string, string[]>> | undefined;
/** Materials made of one enemy (materials.json `bio`, field `enemies`). */
function bioOf(ctx: Ctx, enemy: string): string[] {
  const f = ctx.data.materials;
  if (!f) return [];
  bioCache ??= new WeakMap();
  let m = bioCache.get(f);
  if (!m) {
    m = new Map();
    for (const b of (f.items as { bio?: { id: string; enemies: string[] }[] }).bio ?? []) for (const e of b.enemies) m.set(e, [...(m.get(e) ?? []), b.id]);
    bioCache.set(f, m);
  }
  return m.get(enemy) ?? [];
}

function pickMaterial(ctx: Ctx, foe: Foe): string | undefined {
  const rng = ctx.rng(STREAM.loot);
  for (const id of foe.ids) {
    const own = bioOf(ctx, id);
    if (own.length) return rng.pick(own);
  }
  for (const k of foe.kinds) {
    const list = MATERIAL_BY_KIND[k];
    if (list) return rng.pick(list);
  }
  return undefined;
}

function pickWeapon(ctx: Ctx, foe: Foe): string | undefined {
  const ix = indexOf(ctx);
  if (!ix.weaponPool.length) return undefined;
  const rng = ctx.rng(STREAM.loot);
  const rarity = rarityDraw(ctx, foe, WEAPON_MAX_RARITY);
  const pool = ix.weaponPool.filter((w) => WEAPON_GROUPS.includes(w.group) && w.rarity === rarity);
  if (!pool.length) return undefined;
  const drop = foe.kinds.map((k) => WEAPON_DROP[k]).find(Boolean);
  if (drop && rng.chance(drop.share)) {
    const themed = pool.filter((w) => w.tags.some((t) => drop.tags.includes(t)));
    if (themed.length) return rng.pick(themed).id;
  }
  return rng.pick(pool).id;
}

/** A blessing or a curse: the list of the foe's kind most of the time (05 §5 "น้ำหนัก ×4"), else any of a rarity the tier can reach. */
function pickGift(ctx: Ctx, foe: Foe, curse: boolean): string | undefined {
  const ix = indexOf(ctx);
  const rng = ctx.rng(STREAM.loot);
  const lists = foe.kinds.map((k) => ix.giftsByKind.get(k)).filter((g): g is NonNullable<typeof g> => !!g);
  const own = lists.flatMap((g) => (curse ? g.curses : g.blessings));
  if (own.length && rng.chance(KIND_GIFT_SHARE)) return rng.pick(own);
  const all = curse ? idx(ctx).curses : idx(ctx).blessings;
  const rarity = rarityDraw(ctx, foe, foe.rewardRow === 'legend' ? 'L' : foe.rewardRow === 'boss' || foe.rewardRow === 'elite' ? 'E' : 'R');
  const pool = all.filter((g) => g.tier === rarity && !g.race);
  return pool.length ? rng.pick(pool).id : undefined;
}

/** The loot of a win by tier (05 §2): each slot rolled alone, the flawless win ×1.5 on all but the curse. Returns a line per thing. */
export function lootFor(ctx: Ctx, hero: Hero, foe: Foe, flawless: boolean, node: string | undefined): string[] {
  const ix = indexOf(ctx);
  const life = hero.life;
  const rng = ctx.rng(STREAM.loot);
  const row = ix.rewardRows.get(foe.rewardRow);
  const out: string[] = [];
  const base = LOOT[foe.tierId] ?? LOOT.normal;
  const gold = Math.max(0, Math.round(base.gold * (0.6 + rng.next() * 0.8)));
  const fame = Math.round(base.fame * (flawless ? FLAWLESS.fame : 1));
  if (gold) {
    give(ctx, [{ k: 'stat', stat: 'gold', delta: gold }], node);
    out.push(`gold+${gold}`);
  }
  if (fame) {
    give(ctx, [{ k: 'stat', stat: 'fame', delta: fame }], node);
    out.push(`fame+${fame}`);
  }
  if (!row) return out;
  const m = flawless ? FLAWLESS.slots : 1;
  if (rng.chance(Math.min(1, row.material * m))) {
    const id = pickMaterial(ctx, foe);
    if (id) {
      give(ctx, [{ k: 'grant', kind: 'material', id }], node);
      out.push(id);
    }
  }
  if (rng.chance(Math.min(1, row.weapon * m))) {
    const id = pickWeapon(ctx, foe);
    if (id) {
      give(ctx, [{ k: 'grant', kind: 'weapon', id }], node);
      out.push(id);
    }
  }
  if (rng.chance(Math.min(1, row.blessing * m))) {
    const id = pickGift(ctx, foe, false);
    if (id && !life.blessings.includes(id)) {
      give(ctx, [{ k: 'grant', kind: 'blessing', id }], node);
      out.push(id);
    }
  }
  if (rng.chance(row.curse)) {
    const id = pickGift(ctx, foe, true);
    if (id && !life.curses.includes(id)) {
      give(ctx, [{ k: 'grant', kind: 'curse', id }], node);
      out.push(id);
    }
  }
  if (rng.chance(Math.min(1, row.skill * m))) {
    // the skill the fight taught: one level of an aptitude the hero already fights with, else the first sword of his
    const mine = idx(ctx).aptitudeList.filter((a) => (a.group === 'combat' || a.group === 'magic') && hero.apt(a.id) > 0 && hero.apt(a.id) < 3);
    const a = mine.length ? rng.pick(mine) : undefined;
    if (a) {
      give(ctx, [{ k: 'stat', stat: a.id, delta: 1 }], node);
      out.push(`${a.id}+1`);
    }
  }
  return out;
}

// ---------- the quiet wins (05 §6) and the end of a clash ----------

export function quietReward(ctx: Ctx, hero: Hero, foe: Foe, how: 'talk' | 'tame' | 'spare', node: string | undefined): string[] {
  const life = hero.life;
  const ix = indexOf(ctx);
  const ext = extOf(life);
  const rng = ctx.rng(STREAM.loot);
  const out: string[] = [];
  if (how === 'talk') {
    give(ctx, [{ k: 'stat', stat: 'fame', delta: QUIET.talk.fame }], node);
    ext.karma += QUIET.talk.karma;
    out.push(`fame+${QUIET.talk.fame}`, `karma+${QUIET.talk.karma}`);
  } else if (how === 'tame') {
    ext.karma += QUIET.calm.karma;
    out.push(`karma+${QUIET.calm.karma}`);
    const sp = foe.ids.map((id) => ix.speciesByEnemy.get(id)).find(Boolean);
    if (sp && rng.chance(TAME_COMPANION[sp.tier] ?? 0.05) && !ext.tamed.includes(sp.id)) {
      ext.tamed.push(sp.id);
      give(ctx, [{ k: 'grant', kind: 'companion', id: sp.id }], node);
      out.push(sp.id);
    }
  } else {
    give(ctx, [{ k: 'stat', stat: 'kind', delta: QUIET.spare.kind }], node);
    out.push(`kind+${QUIET.spare.kind}`);
  }
  return out;
}

// ---------- titles (05 §7) ----------

function count(tally: Record<string, number>, key: string): number {
  return key.startsWith('kind:') ? key.slice(5).split('|').reduce((s, k) => s + (tally[`kind:${k}`] ?? 0), 0) : tally[key] ?? 0;
}

/** Counts a win for the titles and earns the ones now due. `how`: what the win was (the keys it counts under). */
export function countWin(ctx: Ctx, hero: Hero, foe: Foe, keys: string[], killed: boolean, node: string | undefined): string[] {
  const ext = extOf(hero.life);
  for (const k of keys) bump(ext.tally, k);
  for (const k of foe.kinds) bump(ext.tally, `kind:${k}`);
  if (foe.ids.some((id) => WILD_DRAGONS.has(id))) bump(ext.tally, 'wild_dragon');
  if (killed && foe.npc && foe.named) {
    bump(ext.tally, 'npc_named');
    if (foe.kinds.includes('humanoid') && ctx.rng(STREAM.loot).chance(KILL_NPC_CURSE.chance) && !hero.life.curses.includes(KILL_NPC_CURSE.id)) {
      give(ctx, [{ k: 'grant', kind: 'curse', id: KILL_NPC_CURSE.id }], node);
    }
  }
  const earned: string[] = [];
  for (const t of TITLES) {
    if (ext.titles.includes(t.id) || count(ext.tally, t.key) < t.n) continue;
    ext.titles.push(t.id);
    earned.push(t.id);
    if (t.fame) give(ctx, [{ k: 'stat', stat: 'fame', delta: t.fame }], node);
    if (t.grant && !hero.life.curses.includes(t.grant)) give(ctx, [{ k: 'grant', kind: 'curse', id: t.grant }], node);
    write(ctx.state, { sys: 'combat', kind: 'title', id: t.id, data: { key: t.key, n: t.n }, level: 2 });
  }
  return earned;
}

/** Which tally keys a fight of this kind counts under. */
export function keysOf(opts: FightOpts): string[] {
  const out: string[] = [];
  if (opts.tally) out.push(opts.tally);
  if (opts.kind === 'duel') out.push('duel');
  if (opts.kind === 'raid') out.push('raid');
  return out;
}
