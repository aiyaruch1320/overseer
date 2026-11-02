// Family (docs/systems/bonds/05-family.md): the frame of relatives a life is born with, the close kin of ages 5 to 12, the life partner and the children.
import type { Ctx } from '../game';
import { write } from '../log';
import type { Rng } from '../rng';
import type { LifeState } from '../types';
import type { KinRow } from '../data/types-bonds';
import { bondsIndex, ceilB, floorB } from './data';
import { addTie, hAgeOf, isChild, raceRow, setLine } from './people';
import { showMood } from './moods';
import { holderPlace, rowOf, slotOf } from './npcs';
import { addNpcTie } from './sources';
import { peopleCode, personName, registerName } from '../text';
import { startArc } from './arcs';
import { extOf, isLive, levelOf, tiesOf, type BondsExt, type Tie } from './state';
import { ADULT_LIFE_AGE, CHILD_AGE, CHILD_CHANCE, CHILD_FEELS, GROW_TEXT, CHILD_STAGES, CHILD_START_B, CHILD_WED, MAX_CHILDREN, PARENT_AGE, PARTNER_FEELS } from './tuning';

/** A number drawn from a table "0 ตัว 20% · 1 ตัว 35% ..." of the data. */
function drawCount(rng: Rng, row: KinRow | undefined, extraPct = 0): number {
  const c = row?.count;
  if (!c) return 0;
  if (c.range) return rng.int(c.range[0], c.range[1]);
  if (!c.dist) return 0;
  const w = c.dist.map((d) => d.pct);
  const i = Math.max(0, rng.weighted(w));
  const d = c.dist[i];
  // "4 ตัวขึ้นไป": four to five
  return d.orMore ? rng.int(d.n, d.n + 1) : d.n + (extraPct > 0 && d.n >= 1 && rng.chance(extraPct) ? 1 : 0);
}

const kinRow = (rows: KinRow[], start: string) => rows.find((r) => r.relative.startsWith(start));

/** The wake races have kin of their own kind of origin (05 §1, second table): the data table `origins` by the node that starts the life. */
const ORIGIN_NODE: Record<string, string> = { slime: 'sl.b1', soulmachine: 'so.b1', mummy: 'mu.b1', ghoul: 'gh.b1', construct: 'co.b1' };

/** The relatives a life is born with, as ties of the frame (light: no story of their own). */
export function birthKin(ctx: Ctx, life: LifeState): void {
  const e = extOf(life);
  const ix = bondsIndex(ctx);
  const fam = ix.data.family;
  const rng = ctx.rng('bonds.kin');
  const node = ORIGIN_NODE[life.race];
  const origin = node ? fam.origins.find((o) => o.nodes.includes(node)) : undefined;
  const cls = Number(String(life.cls).replace(/\D/g, '')) || 3;
  const quiet = { light: true, quiet: true } as const;
  if (origin) {
    if (origin.elderLevel) addTie(ctx, life, { ...quiet, line: 'ญาติผู้ใหญ่', level: origin.elderLevel, from: 'kin', kin: 'parent', gap: rng.int(20, 35) });
    const n = origin.siblingRange ? rng.int(origin.siblingRange[0], origin.siblingRange[1]) : 0;
    for (let i = 0; i < n; i++) addTie(ctx, life, { ...quiet, line: 'พี่น้อง', level: origin.siblingLevel ?? 1, from: 'kin', kin: rng.chance(0.5) ? 'elder_sibling' : 'younger_sibling', gap: rng.int(-3, 3) });
    return;
  }
  // parents: alive at the birth; 4 when they live with the child, 3 when far or unknown
  const parents = kinRow(fam.kin, 'พ่อ');
  for (const [kin, gender] of [['father', 'm'], ['mother', 'f']] as const) {
    const near = rng.chance(0.85);
    addTie(ctx, life, { ...quiet, line: 'ญาติผู้ใหญ่', level: near ? parents?.startLevel ?? 4 : parents?.startLevelFar ?? 3, from: 'kin', kin, gender, gap: rng.int(PARENT_AGE[0], PARENT_AGE[1]), race: 'same' });
  }
  // brothers and sisters: a big house (class 1 to 2) has more (+10%)
  const sib = kinRow(fam.kin, 'พี่น้อง');
  const nSib = drawCount(rng, sib, cls <= 2 ? 0.1 : cls === 5 ? -0.1 : 0);
  for (let i = 0; i < nSib; i++) {
    const elder = rng.chance(0.5);
    addTie(ctx, life, { ...quiet, line: 'พี่น้อง', level: sib?.startLevel ?? 3, from: 'kin', kin: elder ? 'elder_sibling' : 'younger_sibling', gap: elder ? rng.int(1, 8) : -rng.int(1, 8), race: 'same' });
  }
  const mk = (start: string, kin: string, gap: [number, number], genders?: 'm' | 'f') => {
    const row = kinRow(fam.kin, start);
    const n = drawCount(rng, row);
    for (let i = 0; i < n; i++) addTie(ctx, life, { ...quiet, line: row?.term ?? 'ญาติผู้ใหญ่', level: row?.startLevel ?? 2, from: 'kin', kin, gender: genders ?? (rng.chance(0.5) ? 'm' : 'f'), gap: rng.int(gap[0], gap[1]), race: 'same' });
  };
  mk('ลุง ป้า', 'uncle', [24, 42]);
  mk('อา', 'uncle', [18, 34]);
  mk('น้า', 'aunt', [18, 34]);
  const grand = kinRow(fam.kin, 'ปู่');
  const nGrand = grand?.count.range ? rng.int(grand.count.range[0], grand.count.range[1]) : 0;
  for (let i = 0; i < nGrand; i++) addTie(ctx, life, { ...quiet, line: 'ญาติผู้ใหญ่', level: grand?.startLevel ?? 2, from: 'kin', kin: 'grand', gap: rng.int(46, 66), race: 'same' });
  const cousin = kinRow(fam.kin, 'ลูกพี่ลูกน้อง');
  const nCousin = cousin?.count.range ? rng.int(cousin.count.range[0], cousin.count.range[1]) : 0;
  for (let i = 0; i < nCousin; i++) addTie(ctx, life, { ...quiet, line: 'พี่น้อง', level: cousin?.startLevel ?? 1, from: 'kin', kin: 'cousin', gap: rng.int(-8, 8), race: 'same' });
}

/** The relatives alive who can be the close kin of a child (not the parents). */
function kinCandidates(e: BondsExt): Tie[] {
  return tiesOf(e).filter((t) => isLive(t) && t.light && t.kin && !['father', 'mother', 'parent', 'child', 'adopted'].includes(t.kin));
}

/** Close kin at 5 to 12 (05 §1): one living relative (two for a big house, class 3 or more) gets a story of his own from a family template. */
export function closeKin(ctx: Ctx, life: LifeState): void {
  const e = extOf(life);
  if (e.done.includes('closeKin')) return;
  e.done.push('closeKin');
  const rule = bondsIndex(ctx).data.family.closeKin;
  const cls = Number(String(life.cls).replace(/\D/g, '')) || 3;
  const want = cls >= rule.minClassForTwo ? rule.countBigHouse : rule.count;
  const rng = ctx.rng('bonds.kin');
  // a written relative of the roster (AL17-2 Tommy, MK12-1 Patch) is the close kin with 10% when the country and the people match (05 §1)
  let left = want;
  for (const id of rule.flagNpcs) {
    const slot = slotOf(ctx, id);
    const row = rowOf(ctx, id);
    if (left <= 0 || !slot || !row || slot.status !== 'alive' || holderPlace(slot, row) !== life.country || row.peopleId !== peopleCode(ctx, life.race)) continue;
    if (!rng.chance(rule.flagChance)) continue;
    const t = addNpcTie(ctx, life, id, 'ญาติผู้ใหญ่', 3, 'closeKin');
    if (!t) continue;
    t.arc = { code: id, stage: 1, next: life.hAge + rng.int(2, 4), flag: true };
    left--;
  }
  for (let i = 0; i < left; i++) {
    const pool = kinCandidates(e).filter((t) => !t.arc);
    if (!pool.length) return;
    const t = pool[rng.int(0, pool.length - 1)];
    t.light = false;
    startArc(ctx, life, t);
    write(ctx.state, { sys: 'bonds', kind: 'tie', id: t.id, data: { name: t.name, line: t.line, from: 'closeKin', level: 0, b: t.b, race: t.race, npc: null }, level: 1 });
  }
}

/** The life stage of a child by his own age (05 §3 table: 0–5, 6–14, 15–25, grown). */
export function stageOfAge(age: number, adult = ADULT_LIFE_AGE): NonNullable<Tie['stage']> {
  return age <= Math.round(adult * CHILD_STAGES.infant) ? 'infant' : age <= Math.round(adult * CHILD_STAGES.child) ? 'child' : age < adult ? 'youth' : 'adult';
}

/** The age (life years) a person becomes an adult at, by his race (races `adultAge` is in world years: a life year is `perYear` of them). */
export function adultAgeOf(ctx: Ctx, t: Pick<Tie, 'race' | 'perYear'>): number {
  const a = raceRow(ctx, t.race)?.adultAge;
  return a ? Math.max(8, Math.round(a / Math.max(0.01, t.perYear))) : ADULT_LIFE_AGE;
}

/**
 * A child: of the character's own blood or taken in (the prayer, the couple, a freed child). The child keeps who the other parent is
 * (the partner of the day, as a tie when he is one), the hAge the character was when he came, a stage by his age and the feelings the
 * character shows over the years (05 §3); all of it lives on the tie in `life.ext.bonds` and in the log (`bonds/child`).
 */
export function addChild(ctx: Ctx, life: LifeState, opt: { adopted?: boolean; age?: number; from?: string; other?: Tie } = {}): Tie {
  const e = extOf(life);
  const rng = ctx.rng('bonds.people');
  const fam = bondsIndex(ctx).data.family.children;
  const age = opt.age ?? 0;
  const t = addTie(ctx, life, {
    line: 'ญาติรุ่นเยาว์', b: opt.adopted ? floorB(ctx, fam.adopted.startLevel) : CHILD_START_B, from: opt.from ?? (opt.adopted ? 'adopted' : 'child'), kin: opt.adopted ? 'adopted' : 'child', light: true,
    gap: age - life.hAge, race: 'same', gender: rng.chance(0.5) ? 'm' : 'f', quiet: true,
  });
  // the other parent: the one asked for, else the partner of the day for a child of the couple or of a prayer (a taken-in child has none known)
  const partner = e.partner ? e.ties[e.partner] : undefined;
  const other = opt.other ?? (!opt.adopted && partner && isLive(partner) ? partner : undefined);
  t.born = life.hAge;
  t.stage = stageOfAge(age, adultAgeOf(ctx, t));
  t.kidMood = life.hAge;
  if (other) {
    t.other = other.id;
    t.otherName = other.name;
  }
  write(ctx.state, {
    sys: 'bonds', kind: 'child', id: t.id,
    data: { name: t.name, adopted: !!opt.adopted, from: opt.from ?? 'child', b: t.b, kin: t.kin ?? null, gender: t.gender, age, other: other?.name ?? null, otherId: other?.id ?? null },
    level: 2,
  });
  e.children = tiesOf(e).filter((x) => (x.kin === 'child' || x.kin === 'adopted') && isLive(x)).map((x) => x.id);
  return t;
}

/** Can the pair have a child (05: the races that wake have none of their own: generationGap null)? */
function canBear(ctx: Ctx, a: string, b: string): boolean {
  return raceRow(ctx, a)?.generationGap !== null && raceRow(ctx, b)?.generationGap !== null;
}

/** Once a year: a couple may have a child (assumption of the rate), a child of the house grows and the adopted one binds faster (05 §3). */
export function familyYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rng = ctx.rng('bonds.family');
  const fam = bondsIndex(ctx).data.family.children;
  const partner = e.partner ? e.ties[e.partner] : undefined;
  if (partner && (partner.spouse || levelOf(ctx, partner) >= 3) && isLive(partner) && canBear(ctx, life.race, partner.race)) {
    const mine = life.hAge;
    const his = hAgeOf(ctx, partner);
    const kids = e.children.length;
    if (mine >= CHILD_AGE[0] && mine <= CHILD_AGE[1] && his >= CHILD_AGE[0] && his <= CHILD_AGE[1] + 4 && kids < MAX_CHILDREN && rng.chance(CHILD_CHANCE)) addChild(ctx, life, { from: 'couple', other: partner });
  }
  for (const id of e.children) {
    const c = e.ties[id];
    if (!c || !isLive(c)) continue;
    if (c.kin === 'adopted') {
      const hold = fam.adopted.plusPerYear;
      c.b = Math.min(ceilB(ctx, 5), c.b + hold);
    }
  }
  childrenYear(ctx, life, e);
  partnerYear(ctx, life, e);
}

/**
 * The children over the years (H6 of the M3 review): each grows through the stages of 05 §3, the character shows the feeling of the stage now and
 * then, and the child marries in the years a person marries. His death is the book's (year.ts), written with the kin.
 */
function childrenYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rng = ctx.rng('bonds.kids');
  for (const id of [...e.children]) {
    const c = e.ties[id];
    if (!c || !isLive(c) || !isChild(c)) continue;
    const age = Math.floor(hAgeOf(ctx, c));
    const stage = stageOfAge(age, adultAgeOf(ctx, c));
    if (c.stage !== stage) {
      c.stage = stage;
      write(ctx.state, { sys: 'bonds', kind: 'news', id: c.id, data: { name: c.name, line: c.line, kind: 'grow', text: GROW_TEXT[stage], kin: c.kin ?? null, stage, age, gender: c.gender, other: c.otherName ?? null }, level: 1 });
    }
    // the feeling of the stage: one in `gapYears` years at the most toward a child
    if (life.hAge - (c.kidMood ?? -99) >= CHILD_FEELS.gapYears && rng.chance(CHILD_FEELS.chance)) {
      c.kidMood = life.hAge;
      const far = c.country !== life.country;
      const pool = [...CHILD_FEELS.byStage[stage].filter((m) => far || !CHILD_FEELS.farOnly.includes(m)), ...(far ? CHILD_FEELS.far[stage] : [])];
      if (pool.length) {
        const mood = pool[rng.int(0, pool.length - 1)];
        // the same feeling toward the same child in the same stage is told once, then again only after several years (a feeling that changes is told at once)
        const f = c.kidFeel;
        const again = !f || f.mood !== mood || f.stage !== stage || life.hAge - f.age >= CHILD_FEELS.repeatYears;
        if (again && showMood(ctx, life, c, mood, `child:${stage}`)) c.kidFeel = { mood, stage, age: life.hAge };
      }
    }
    if (!c.married && age >= CHILD_WED.ages[0] && age <= CHILD_WED.ages[1] && c.gender !== 'n' && rng.chance(CHILD_WED.chance)) {
      const people = peopleCode(ctx, c.race);
      const gender = c.gender === 'm' ? 'f' : 'm';
      const make = () => personName(ctx.rng('bonds.names'), { people, gender, continent: c.country.slice(0, 2) });
      const name = registerName(ctx, `bond:${life.id}:${c.id}:spouse`, make(), make);
      c.married = { age, name };
      write(ctx.state, { sys: 'bonds', kind: 'news', id: c.id, data: { name: c.name, line: c.line, kind: 'wed', text: `แต่งงานกับ ${name}`, kin: c.kin ?? null, spouse: name, age, gender: c.gender }, level: 1 });
    }
  }
}

/**
 * The life partner is told again every few years (H7 of the M3 review): a feeling toward him, not only the lines of his coming and going. A partner
 * who lives far away is missed. A partner who is gone has his end as a line of its own (people.ts `endTie`).
 */
function partnerYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const p = e.partner ? e.ties[e.partner] : undefined;
  if (!p || !isLive(p) || life.hAge - (p.partnerMood ?? p.opened) < PARTNER_FEELS.gapYears) return;
  const rng = ctx.rng('bonds.kids');
  if (!rng.chance(PARTNER_FEELS.chance)) return;
  p.partnerMood = life.hAge;
  const pool = p.country !== life.country ? PARTNER_FEELS.far : levelOf(ctx, p) >= 4 ? PARTNER_FEELS.close : PARTNER_FEELS.near;
  showMood(ctx, life, p, pool[rng.int(0, pool.length - 1)], 'partner');
}

export { setLine };
