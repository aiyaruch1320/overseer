// Who takes over and what is handed on (docs/lore/heirs/01-inheritance.md).
// `pickHeir` reads the bond book of the dead life and walks the ladder of §1 and §6: a child alive (the player picks one, else the eldest), an
// adopted child or a student, the partner, a person the character helped, nobody. It reads only.
// `inherit` writes the gifts of §2 into the heir that `character.birth` made: gold, class, the best weapon and the armour and tools, half the
// materials, one blessing of the blood, the best skill one level lower, faith, +1 to the best stat, the grudges and the thanks.
import { birth as characterBirth, extOf as characterExt } from '../character';
import { raiseAptitude, grantGift } from '../character/life';
import { worldYearsPerLifeYear } from '../clock';
import { extOf as bondsExt, hAgeOf, isLive, tiesOf, type Tie } from '../bonds';
import { makeCtx, type Ctx } from '../game';
import { items as dataItems } from '../text/labels';
import { fameOf, type LifeState, type StatBlock } from '../types';
import { bindFamily } from './family';
import { lx, type HeirHow, type HeirSpec } from './state';


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
/** Years of life a person must have left to take over (assumption: the docs do not say). A partner who lives takes over whatever the years left (heirs/01 §6 rung 2: \"คู่ที่ยังมีชีวิต\"; M4 review F1). */
export const MIN_LEFT = { child: 2, other: 8, partner: 1 };
/** Item groups by id prefix (items.json): weapons `ws_`, armour `ar_`, tools `lt_`, materials and consumables are halved. */
const HALVED = ['mt_', 'cn_'];

const byGen = <T extends { from: number }>(table: T[], gen: number): T | undefined => table.find((r) => gen >= r.from);

function tieAge(ctx: Ctx, t: Tie): number {
  return Math.max(0, Math.floor(hAgeOf(ctx, t)));
}

function spec(ctx: Ctx, t: Tie, how: HeirHow, rung: HeirSpec['rung'], life: LifeState, rank = 0): HeirSpec {
  return {
    how, rung, tie: t.id, name: t.name, race: t.race, gender: t.gender, country: t.country || life.country, age: tieAge(ctx, t), blood: t.kin === 'child', rank,
    ...(t.married ? { married: t.married.name } : {}), ...(t.otherName ? { other: t.otherName } : {}),
  };
}

/** The candidates of rung 0 in the order of the ladder: the eldest first (heirs/01 §1). */
function kidsOf(ctx: Ctx, ties: Tie[]): Tie[] {
  return ties.filter((t) => t.kin === 'child' || t.kin === 'adopted').sort((a, b) => hAgeOf(ctx, b) - hAgeOf(ctx, a) || a.id.localeCompare(b.id));
}

/** The children who could take over, each as the heir it would be: the player reads them (`heirs`) and picks one (`pickHeirTie`). Empty when the ladder goes down to another rung. */
export function candidates(ctx: Ctx): HeirSpec[] {
  const life = ctx.state.life;
  if (!life || !life.ext.bonds) return [];
  const e = bondsExt(life);
  const ties = tiesOf(e).filter((t) => isLive(t) && t.dieAge - tieAge(ctx, t) >= MIN_LEFT.child);
  return kidsOf(ctx, ties).map((t, i) => spec(ctx, t, t.kin === 'child' ? 'child' : 'adopted', 0, life, i));
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
  const kids = kidsOf(ctx, ties);
  const chosen = kids.find((t) => t.id === pick) ?? kids[0];
  if (chosen) return spec(ctx, chosen, chosen.kin === 'child' ? 'child' : 'adopted', 0, life, kids.indexOf(chosen));
  // rung 1: a student the character taught and trusted (the mentor line, trust 3 or more)
  const student = ties.filter((t) => t.line === 'ศิษย์' && t.trust >= 3 && left(t) >= MIN_LEFT.other).sort((a, b) => b.b - a.b || a.id.localeCompare(b.id))[0];
  if (student) return spec(ctx, student, 'student', 1, life);
  // rung 2: the partner who lives
  const partner = e.partner ? e.ties[e.partner] : undefined;
  if (partner && isLive(partner) && left(partner) >= MIN_LEFT.partner) return spec(ctx, partner, 'partner', 2, life);
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
    const worn = parent.ext.items?.wield;
    const weapon = worn && parent.items.includes(worn) && worn.startsWith('ws_') ? worn : parent.items.find((i) => i.startsWith('ws_'));
    const give: string[] = [];
    if (weapon) give.push(weapon);
    for (const id of parent.items) if (id.startsWith('ar_') || id.startsWith('lt_')) give.push(id);
    // materials and consumables: half of each kind, rounded down (01 §2), a partner's share of that
    const count: Record<string, number> = {};
    for (const id of parent.items) if (HALVED.some((q) => id.startsWith(q))) count[id] = (count[id] ?? 0) + 1;
    for (const [id, n] of Object.entries(count)) for (let i = 0; i < Math.floor((n * Math.min(share, 1)) / 2); i++) give.push(id);
    for (const id of give) {
      // a piece the heir has already (the birth gave it one) is not given twice; materials stack
      if (!heir.items.includes(id) || HALVED.some((q) => id.startsWith(q))) {
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
    const fame = fameOf(parent);
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
 * Binds the heir to the family and the friends of the dead life (lineage/family.ts) and keeps the thanks and the grudges of the people for the
 * family (heirs/01 §2): a person who thanked or hated the parent keeps it, at most +3.
 */
export function bindParent(ctx: Ctx, parent: LifeState, heir: LifeState, how: HeirSpec): void {
  if (!heir.ext.bonds) return;
  bindFamily(ctx, parent, heir, how);
  const book = lx(ctx.state).book.npcs;
  for (const o of parent.ext.bonds ? tiesOf(bondsExt(parent)) : []) {
    if (!o.npc || (o.gratitude < 1 && o.grudge < 1)) continue;
    const had = book[o.name] ?? { gratitude: 0, grudge: 0 };
    book[o.name] = { gratitude: Math.min(3, Math.max(had.gratitude, o.gratitude)), grudge: Math.min(3, Math.max(had.grudge, o.grudge)) };
  }
}


/**
 * Makes the life of the heir: the person of the bond book, with the race, gender, country and name of the tie and the age the book gives. The birth
 * draws of a brother or sister move on by the place in the line, so each child is a person of its own (traits, aptitudes, sign) and not the same one
 * under another name (M4 review M2). `st.life` must be empty. Used by the next life and by the preview of the candidates.
 */
export function bearHeir(ctx: Ctx, spec: HeirSpec): LifeState {
  const st = ctx.state;
  for (const name of ['life.birth', 'life.character']) {
    const r = ctx.rng(name);
    for (let i = 0; i < (spec.rank ?? 0) * 11; i++) r.next();
  }
  const life = characterBirth(ctx, { race: spec.race, country: spec.country, ...(spec.gender === 'n' ? {} : { gender: spec.gender }), second: null, special: false });
  st.world.names[`char:${life.id}`] = spec.name;
  life.name = spec.name;
  life.hAge = spec.age;
  life.birthYear = Math.round(st.clock.worldYear - spec.age * worldYearsPerLifeYear(life.lifespan, life.race));
  const cx = characterExt(life);
  if (cx.deathAge <= spec.age + 2) cx.deathAge = spec.age + 3;
  return life;
}

/** What the candidate would be, read without touching the game: the traits and the best aptitude it is born with (a copy of the state bears it). */
export function previewHeir(ctx: Ctx, spec: HeirSpec): { traits: string[]; aptitudes: string[] } {
  const copy = makeCtx(structuredClone(ctx.state), ctx.data);
  copy.state.life = null;
  const life = bearHeir(copy, spec);
  return { traits: [...life.traits], aptitudes: Object.entries(life.aptitudes).sort((a, b) => b[1] - a[1]).map(([k]) => k) };
}
