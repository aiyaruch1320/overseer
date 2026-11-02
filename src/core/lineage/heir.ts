// Who takes over and what is handed on (docs/lore/heirs/01-inheritance.md).
// `pickHeir` reads the bond book of the dead life and walks the ladder of §1 and §6: a child alive (the player picks one, else the eldest), an
// adopted child or a student, the partner, a person the character helped, nobody. It reads only.
// `inherit` writes the gifts of §2 into the heir that `character.birth` made: gold, class, the best weapon and the armour and tools, half the
// materials, one blessing of the blood, the best skill one level lower, faith, +1 to the best stat, the grudges and the thanks.
import { raiseAptitude, grantGift } from '../character/life';
import { addTie, extOf as bondsExt, hAgeOf, isLive, tiesOf, type Tie } from '../bonds';
import { reindex } from '../bonds/state';
import type { Ctx } from '../game';
import { items as dataItems } from '../text/labels';
import type { LifeState, StatBlock } from '../types';
import { lx, type HeirHow, type HeirSpec } from './state';

/** Races whose people are not born of a mother (the heirs doc §1): none of them is a child of the blood, but any can be a student or a partner. */
const NO_BLOOD = new Set(['soulmachine', 'mummy', 'ghoul']);

/** Share of the gold that passes, by the generation of the heir (01 §4 "ภาษีรุ่น"). */
export const GOLD_SHARE = [{ from: 6, share: 0.5 }, { from: 4, share: 0.6 }, { from: 2, share: 0.7 }];
/** A partner or a helped person gets half or one piece (01 §6). */
export const RUNG_SHARE: Record<number, number> = { 0: 1, 1: 1, 2: 0.5, 3: 0, 4: 0 };
/** The most gold that goes down a generation: assumption (the doc says three times the median at age 30 of the country, which the economy does not list). */
export const GOLD_CAP = 1500;
/** Blessing of the blood: chance by generation, tiers C and U only (01 §2). */
export const BLOOD_BLESSING = [{ from: 6, p: 0 }, { from: 4, p: 0.1 }, { from: 2, p: 0.15 }];
/** Faith that passes. */
export const FAITH_SHARE = 0.6;
/** Fame that passes: one third, at most 40; one fourth from the sixth generation. */
export const FAME = { share: 1 / 3, cap: 40, late: { from: 6, share: 1 / 4 } };
/** Years of life a person must have left to take over (assumption: the docs do not say; a spouse of 72 in a life of 74 is not a life to play). */
export const MIN_LEFT = { child: 2, other: 8 };
/** Item groups by id prefix (items.json): weapons `ws_`, armour `ar_`, tools `lt_`, materials and consumables are halved. */
const HALVED = ['mt_', 'cn_'];

const byGen = <T extends { from: number }>(table: T[], gen: number): T | undefined => table.find((r) => gen >= r.from);

function tieAge(ctx: Ctx, t: Tie): number {
  return Math.max(0, Math.floor(hAgeOf(ctx, t)));
}

function spec(ctx: Ctx, t: Tie, how: HeirHow, rung: HeirSpec['rung'], life: LifeState): HeirSpec {
  return { how, rung, tie: t.id, name: t.name, race: t.race, gender: t.gender, country: t.country || life.country, age: tieAge(ctx, t), blood: t.kin === 'child' };
}

/**
 * The heir of the dead life (heirs/01 §1 and §6), or null when there is none. Reads only. The player may have picked a child with `pickHeirTie`;
 * the pick holds while that child lives, else the eldest takes over.
 */
export function pickHeir(ctx: Ctx): HeirSpec | null {
  const life = ctx.state.life;
  if (!life || !life.ext.bonds) return null;
  const e = bondsExt(life);
  // a person with no years left is no heir: the child is passed over when it would die within MIN_LEFT.child years, the others within MIN_LEFT.other (assumption)
  const left = (t: Tie): number => t.dieAge - tieAge(ctx, t);
  const ties = tiesOf(e).filter((t) => isLive(t) && left(t) >= MIN_LEFT.child);
  const pick = lx(ctx.state).pick;
  // rung 0: a child of the blood or taken in
  const kids = ties.filter((t) => t.kin === 'child' || t.kin === 'adopted').sort((a, b) => hAgeOf(ctx, b) - hAgeOf(ctx, a) || a.id.localeCompare(b.id));
  const chosen = kids.find((t) => t.id === pick) ?? kids[0];
  if (chosen) return spec(ctx, chosen, chosen.kin === 'child' ? 'child' : 'adopted', 0, life);
  // rung 1: a student the character taught and trusted (the mentor line, trust 3 or more)
  const student = ties.filter((t) => t.line === 'ศิษย์' && t.trust >= 3 && left(t) >= MIN_LEFT.other).sort((a, b) => b.b - a.b || a.id.localeCompare(b.id))[0];
  if (student) return spec(ctx, student, 'student', 1, life);
  // rung 2: the partner who lives
  const partner = e.partner ? e.ties[e.partner] : undefined;
  if (partner && isLive(partner) && left(partner) >= MIN_LEFT.other) return spec(ctx, partner, 'partner', 2, life);
  // rung 3: someone the character helped, owed more than 2 (an adult; the one most in debt)
  const helped = ties.filter((t) => t.gratitude >= 2 && tieAge(ctx, t) >= 13 && left(t) >= MIN_LEFT.other).sort((a, b) => b.gratitude - a.gratitude || a.id.localeCompare(b.id))[0];
  if (helped) return spec(ctx, helped, 'helped', 3, life);
  return null;
}

/** Makes the player's pick of the heir among the children of the dead life; false when that tie is not a living child. */
export function pickHeirTie(ctx: Ctx, tieId: string | undefined): boolean {
  const x = lx(ctx.state);
  if (tieId === undefined) {
    delete x.pick;
    return true;
  }
  const life = ctx.state.life;
  const t = life?.ext.bonds ? bondsExt(life).ties[tieId] : undefined;
  if (!t || !isLive(t) || !(t.kin === 'child' || t.kin === 'adopted')) return false;
  x.pick = tieId;
  return true;
}

export interface Carried {
  gold: number;
  items: number;
  blessing?: string;
  fame: number;
  faith: number;
  threads: number;
  skill?: string;
}

const STAT_KEYS = ['pow', 'mag', 'spd', 'luk', 'int', 'vit'] as const;

function bestStat(s: StatBlock): (typeof STAT_KEYS)[number] {
  return [...STAT_KEYS].sort((a, b) => s[b] - s[a])[0];
}

/** The tier of a blessing or a curse (C U R E L), from the character catalog. */
function tierOf(ctx: Ctx, id: string): string {
  const list = dataItems<{ id: string; tier?: string }[]>(ctx.data, 'blessings') ?? [];
  return list.find((b) => b.id === id)?.tier ?? '';
}

/**
 * Hands the dead life's things to the heir (the heir is made, its hooks have run). `generation` is the heir's (2 for the first heir).
 * The share by rung: a child or an adopted one gets what §2 lists, a student the same without the blood, a partner half the goods, a helped person nothing but the book.
 */
export function inherit(ctx: Ctx, parent: LifeState, heir: LifeState, how: HeirSpec, generation: number): Carried {
  const rng = ctx.rng('lineage.heir');
  const share = RUNG_SHARE[how.rung] ?? 0;
  const out: Carried = { gold: 0, items: 0, fame: 0, faith: 0, threads: 0 };

  // the house: class and place come from the parent (a child grows in it); a partner or a stranger keeps its own
  if (how.rung <= 1) {
    heir.cls = parent.cls;
    heir.home = parent.home;
  }
  // gold
  const gs = byGen(GOLD_SHARE, generation)?.share ?? 0.7;
  out.gold = Math.min(GOLD_CAP, Math.floor(Math.max(0, parent.gold) * gs * share));
  heir.gold = out.gold;
  // things: the weapon in hand, the armour, the tools, half the materials
  if (share > 0) {
    const worn = (parent.ext.items as { wield?: string } | undefined)?.wield;
    const weapon = worn && parent.items.includes(worn) && worn.startsWith('ws_') ? worn : parent.items.find((i) => i.startsWith('ws_'));
    const give: string[] = [];
    if (weapon) give.push(weapon);
    for (const id of parent.items) if (id.startsWith('ar_') || id.startsWith('lt_')) give.push(id);
    const halved: Record<string, string[]> = {};
    for (const id of parent.items) {
      const p = HALVED.find((q) => id.startsWith(q));
      if (p) (halved[id] ??= []).push(id);
    }
    for (const ids of Object.values(halved)) give.push(...ids.slice(0, Math.floor((ids.length * share) / 2 + (share < 1 ? 0 : 0))));
    for (const id of give) {
      if (!heir.items.includes(id) || id.startsWith('mt_') || id.startsWith('cn_')) {
        heir.items.push(id);
        out.items++;
      }
    }
  }
  // the blood: one blessing of tier C or U by chance, fame, faith, the best stat, the best skill one level lower
  if (how.blood && how.rung === 0) {
    const p = byGen(BLOOD_BLESSING, generation)?.p ?? 0;
    const pool = parent.blessings.filter((b) => ['C', 'U'].includes(tierOf(ctx, b)) && !heir.blessings.includes(b));
    if (pool.length && rng.chance(p)) {
      const id = pool[rng.int(0, pool.length - 1)];
      if (grantGift(ctx, heir, 'blessing', id)) out.blessing = id;
    }
    // a feud passes whole (01 §2 "คำสาปสืบสาย")
    for (const c of parent.curses) if (c === 'c_feud') grantGift(ctx, heir, 'curse', c);
    if (generation < 4) heir.stats[bestStat(heir.stats)] += 1;
  }
  if (how.rung <= 1) {
    const fame = Number((parent.ext.character as { fame?: number } | undefined)?.fame ?? 0);
    const f = byGen([{ from: FAME.late.from, share: FAME.late.share }, { from: 1, share: FAME.share }], generation)?.share ?? FAME.share;
    out.fame = Math.min(FAME.cap, Math.floor(Math.max(0, fame) * f));
    if (out.fame) ((heir.ext.character ??= {}) as { fame?: number }).fame = out.fame;
    out.faith = Math.round(parent.godFaith * FAITH_SHARE);
    heir.godFaith = out.faith;
    // the best aptitude of the parent, one level lower (at least 1)
    const best = Object.entries(parent.aptitudes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best && best[1] > 0) {
      const level = Math.max(1, best[1] - 1);
      if (raiseAptitude(ctx, heir, best[0], level)) out.skill = `${best[0]}_${level}`;
    }
  }
  heir.memory = [`รับช่วงต่อจาก ${parent.name}`];
  return out;
}

/**
 * Puts the dead character into the bond book of the heir as the parent who has gone, and takes the random parents `birthKin` drew away (the
 * parent of the heir is the character who died, trust 80, heirs/01 §2 last row).
 */
export function bindParent(ctx: Ctx, parent: LifeState, heir: LifeState, how: HeirSpec): void {
  if (!heir.ext.bonds) return;
  const e = bondsExt(heir);
  for (const t of tiesOf(e)) if (t.kin === 'father' || t.kin === 'mother') delete e.ties[t.id];
  const t = addTie(ctx, heir, {
    line: 'ญาติผู้ใหญ่', level: 3, from: 'parent', kin: how.how === 'partner' ? 'spouse' : 'parent', light: true, quiet: true, name: parent.name, race: 'same', gender: parent.gender, gap: 30,
  });
  t.b = 80;
  t.peak = 80;
  t.state = 'dead';
  t.died = { age: parent.dead?.hAge ?? parent.hAge, year: parent.dead?.year ?? ctx.state.clock.worldYear, cause: parent.dead?.cause ?? 'old' };
  reindex(e);
  // a person who thanked or hated the parent keeps it for the family, at most +3 (01 §2); the people are not copied into the bond book of the heir
  // (a tie to a roster NPC needs the NPC system to agree: left for the wave that reads the book)
  const book = lx(ctx.state).book.npcs;
  for (const o of parent.ext.bonds ? tiesOf(bondsExt(parent)) : []) {
    if (!o.npc || (o.gratitude < 1 && o.grudge < 1)) continue;
    const had = book[o.name] ?? { gratitude: 0, grudge: 0 };
    book[o.name] = { gratitude: Math.min(3, Math.max(had.gratitude, o.gratitude)), grudge: Math.min(3, Math.max(had.grudge, o.grudge)) };
  }
}
