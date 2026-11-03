// The family an heir wakes with (docs/lore/heirs/01-inheritance.md §2 last row, docs/systems/bonds/05-family.md; M4 review F1).
// The heir is made by `character.birth` at age 0 and is then set to the age the bond book of the dead life gives it, so the relatives `birthKin`
// drew (parents, brothers and sisters, uncles of an age of a newborn) belong to nobody. They are taken out and the web of the book is put in:
//  - the parent who died (a dead tie, trust 80) and the other parent (the one the child tie of the dead life names: alive, dead or gone as the book says)
//  - the grandparents, the uncles and aunts, the cousins: the parents, brothers and sisters of the dead life, with the ages they have
//  - the brothers and sisters: the other children of the dead life, alive or dead as they are
//  - the spouse the heir married in the years before the takeover (`married` on the child tie) and the children of that marriage, drawn the way
//    `familyYear` draws them, over the years of the marriage
//  - the friends and companions the dead life held at level 3 or more, at half their bond (heirs/01 §2 "ความไว้ใจ NPC ลดครึ่ง"), three at most
// The heir who is not a child (a student, the partner, a person helped) is no one's blood: it keeps its own brothers and cousins, drawn at its age,
// and the dead life is a spouse, a teacher or a friend to it.
import { addChild, addNpcTie, adultAgeOf, birthKin, extOf as bondsExt, hAgeOf, isLive, levelOf, showMood, stageOfAge, tiesOf, type Tie } from '../bonds';
import { floorB } from '../bonds/data';
import { reindex } from '../bonds/state';
import { CHILD_AGE, CHILD_CHANCE, DEATH_AGE, MAX_CHILDREN } from '../bonds/tuning';
import { worldYearsPerLifeYear } from '../clock';
import type { Ctx } from '../game';
import { write } from '../log';
import type { LifeState } from '../types';
import type { HeirSpec } from './state';

/** The lines that carry over from the dead life: friends, partners in a trade, teachers, students (heirs/01 §2, bonds/05 "ผู้ค้ำคอของทายาท"). */
const CARRY_LINES = new Set(['สหาย', 'คู่หู', 'ครู', 'ศิษย์']);
/** At most this many people of the dead life stay as friends of the heir. */
export const CARRY_MAX = 3;
/** The least level a person of the dead life must have had to be remembered by the heir. */
export const CARRY_LEVEL = 3;
/** Kin of the heir that the draw of `birthKin` makes without a story (the heir that is not of the blood loses the elders). */
const ELDERS = new Set(['father', 'mother', 'parent', 'grand', 'uncle', 'aunt']);

/** Puts a copy of a person of the dead life into the book of the heir under a new id, as another relation. */
function place(heir: LifeState, src: Tie, over: Partial<Tie>): Tie {
  const e = bondsExt(heir);
  const copy: Tie = {
    ...structuredClone(src),
    id: `T${e.next++}`,
    past: [],
    moods: [],
    arc: undefined,
    party: undefined,
    workedWith: undefined,
    gate: undefined,
    tpl: undefined,
    moodCount: undefined,
    letterAt: undefined,
    born: undefined,
    other: undefined,
    otherName: undefined,
    stage: undefined,
    kidMood: undefined,
    kidFeel: undefined,
    married: undefined,
    bound: src.bound,
    opened: heir.hAge,
    last: heir.hAge,
    ...over,
  };
  copy.peak = Math.max(copy.peak, copy.b);
  e.ties[copy.id] = copy;
  e.counts.ties++;
  return copy;
}

/** The age of the dead life when the lover line of a tie began: the line change of the log, else the day the two met. */
function loveSince(ctx: Ctx, t: Tie): number {
  const became = [...ctx.state.log].reverse().find((e) => e.sys === 'bonds' && e.kind === 'line' && e.id === t.id && e.data.to === 'คนรัก');
  return became?.age !== undefined ? Math.max(t.opened, became.age) : t.opened;
}

const parentKin = (gender: Tie['gender']): string => (gender === 'm' ? 'father' : gender === 'f' ? 'mother' : 'parent');

/** The kin word of a brother or sister by who is older. */
const sibKin = (elder: boolean): string => (elder ? 'elder_sibling' : 'younger_sibling');

/**
 * Binds the heir to the family of the dead life. `parent` is the dead life (its bond book is read), `heir` the life `character.birth` made, already
 * set to the age and the name of the person it takes over from (next.ts).
 */
export function bindFamily(ctx: Ctx, parent: LifeState, heir: LifeState, how: HeirSpec): void {
  if (!heir.ext.bonds) return;
  const e = bondsExt(heir);
  const pe = parent.ext.bonds ? bondsExt(parent) : undefined;
  const rng = ctx.rng('lineage.family');
  const worldYear = ctx.state.clock.worldYear;
  // the relatives the birth drew are for a child that is born, not for a person that takes over at forty
  for (const t of tiesOf(e)) if (t.from === 'kin') delete e.ties[t.id];
  const blood = how.rung === 0;
  const mine = pe && how.tie ? pe.ties[how.tie] : undefined;

  // ---- the dead life
  const gone = (age: number, cause: string) => ({ age: Math.round(age), year: worldYear, cause });
  const dead = parent.dead ? gone(parent.dead.hAge, parent.dead.cause) : gone(parent.hAge, 'old');
  const line = blood ? 'ญาติผู้ใหญ่' : how.how === 'partner' ? 'คนรัก' : how.how === 'student' ? 'ครู' : 'สหาย';
  const kin = blood ? parentKin(parent.gender) : how.how === 'partner' ? 'spouse' : undefined;
  const d = place(heir, {
    id: '', name: parent.name, line, past: [], b: 80, gratitude: how.how === 'helped' ? 3 : 0, grudge: 0, known: 5, trust: 3, acc: 0, from: 'parent', light: true, kin, race: parent.race, gender: parent.gender,
    country: parent.country, age0: dead.age, t0: worldYear, perYear: worldYearsPerLifeYear(parent.lifespan, parent.race), dieAge: dead.age, opened: heir.hAge, last: heir.hAge, state: 'dead', died: dead, moods: [], peak: 80, family: false, rapport: false,
    ...(how.how === 'partner' ? { spouse: true } : {}),
  } as Tie, {
    // the partner who takes over was the lover of the dead life for as long as the book of the dead life says: the card tells when it began, not the day of the takeover (R1)
    ...(how.how === 'partner' && mine ? { opened: Math.max(0, heir.hAge - Math.max(0, Math.round(dead.age - loveSince(ctx, mine)))) } : {}),
  });
  d.gone = { age: heir.hAge, year: worldYear, way: 'death', why: 'ตาย', reason: 'ตาย' };

  if (blood && pe) {
    // ---- the other parent
    const other = mine?.other ? pe.ties[mine.other] : undefined;
    if (other && !other.npc) {
      const alive = isLive(other);
      place(heir, other, {
        line: 'ญาติผู้ใหญ่', kin: parentKin(other.gender), b: alive ? Math.max(60, floorB(ctx, 4)) : 70, light: true,
        spouse: undefined, from: 'family', ...(alive ? {} : { state: other.state === 'dead' ? 'dead' : 'ended' }),
      });
    }
    // ---- the grandparents, uncles, aunts, cousins: the kin of the dead life
    for (const t of tiesOf(pe)) {
      if (!t.light || t.npc || t.id === mine?.id || !t.kin) continue;
      if (t.kin === 'father' || t.kin === 'mother') place(heir, t, { kin: 'grand', line: 'ญาติผู้ใหญ่', b: floorB(ctx, 2) + 3, from: 'family', light: true });
      else if (t.kin === 'elder_sibling' || t.kin === 'younger_sibling') place(heir, t, { kin: t.gender === 'm' ? 'uncle' : 'aunt', line: 'ญาติผู้ใหญ่', b: floorB(ctx, 2) + 3, from: 'family', light: true });
      else if (t.kin === 'uncle' || t.kin === 'aunt' || t.kin === 'grand') continue;
      else if (t.kin === 'cousin') place(heir, t, { kin: 'cousin', line: 'พี่น้อง', b: floorB(ctx, 1) + 2, from: 'family', light: true });
    }
    // ---- brothers and sisters: the other children of the dead life
    const me = mine ? hAgeOf(ctx, mine) : heir.hAge;
    for (const t of tiesOf(pe)) {
      if (t.id === mine?.id || (t.kin !== 'child' && t.kin !== 'adopted') || t.npc) continue;
      place(heir, t, { kin: sibKin(hAgeOf(ctx, t) >= me), line: 'พี่น้อง', b: Math.max(floorB(ctx, 3) + 5, 50), from: 'family', light: true });
    }
    // ---- the spouse and the children the heir had before the takeover
    if (mine?.married && heir.gender !== 'n') {
      const wedAge = Math.min(mine.married.age, heir.hAge);
      const age0 = Math.max(16, heir.hAge + rng.int(-5, 3));
      const s = place(heir, {
        id: '', name: mine.married.name, line: 'คนรัก', past: [], b: 75, gratitude: 0, grudge: 0, known: 4, trust: 3, acc: 0, from: 'family', light: false, race: heir.race, gender: heir.gender === 'm' ? 'f' : 'm',
        country: heir.country, age0, t0: worldYear, perYear: worldYearsPerLifeYear(heir.lifespan, heir.race), opened: wedAge, last: heir.hAge, state: 'alive', moods: [], peak: 75, family: false, rapport: true, spouse: true,
        dieAge: Math.round(Math.max(Math.min(DEATH_AGE.max, DEATH_AGE.mean + rng.gauss() * DEATH_AGE.sd), DEATH_AGE.min, age0 + 8)),
      } as Tie, { opened: wedAge });
      s.workedWith = wedAge;
      reindex(e);
      // the children are drawn year by year from the wedding, the way the life years draw them
      let kids = 0;
      for (let age = wedAge; age < heir.hAge && kids < MAX_CHILDREN; age++) {
        if (age < CHILD_AGE[0] || age > CHILD_AGE[1] || !rng.chance(CHILD_CHANCE)) continue;
        const ago = heir.hAge - age;
        const c = addChild(ctx, heir, { from: 'couple', other: s, age: ago, quiet: true });
        c.born = age;
        kids++;
      }
      for (const id of e.children) {
        const c = e.ties[id];
        if (c) c.stage = stageOfAge(Math.floor(hAgeOf(ctx, c)), adultAgeOf(ctx, c));
      }
    }
  } else {
    // ---- an heir who is not of the blood: its own brothers and cousins, drawn at its age; no elders of the line
    birthKin(ctx, heir);
    for (const t of tiesOf(e)) if (t.from === 'kin' && t.kin && ELDERS.has(t.kin)) delete e.ties[t.id];
  }

  // ---- friends and companions of the dead life, at half the bond
  if (pe) {
    const ally = (t: Tie) => isLive(t) && !t.light && CARRY_LINES.has(t.line) && levelOf(ctx, t) >= CARRY_LEVEL && t.id !== mine?.id;
    const carry = tiesOf(pe).filter(ally).sort((a, b) => b.b - a.b || a.id.localeCompare(b.id)).slice(0, CARRY_MAX);
    for (const t of carry) {
      const b = Math.floor(t.b / 2);
      if (t.npc) {
        const n = addNpcTie(ctx, heir, t.npc, t.line, 1, 'inherited');
        if (n) {
          n.b = b;
          n.peak = Math.max(n.peak, b);
          n.gratitude = Math.min(3, t.gratitude);
          n.grudge = Math.min(3, t.grudge);
        }
      } else place(heir, t, { b, from: 'inherited', trust: Math.floor(t.trust / 2), gratitude: Math.min(3, t.gratitude), grudge: Math.min(3, t.grudge), light: false });
    }
  }
  reindex(e);

  // ---- the funeral of the one who died, and the grief (the heir stands at the grave of the parent on the first day)
  if (blood || how.how === 'partner') {
    e.funeralAt = heir.hAge;
    e.funerals++;
    write(ctx.state, { sys: 'bonds', kind: 'funeral', id: d.id, data: { name: d.name, line: d.line, cause: dead.cause, level: levelOf(ctx, d), kin: d.kin ?? null, age: dead.age, partner: how.how === 'partner' }, level: 2 });
    showMood(ctx, heir, d, 'เสียใจ', `${d.name} ตาย`);
  }
}
