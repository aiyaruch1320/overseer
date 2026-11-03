// Sample lives for the stories of the allies screens (code-plan §8.1 rule 5). Story-only: each is a seeded life at an age, shaped with the same functions the
// bond system uses (addTie, addChild, changeB, endTie ...) so the state is one the core could make, and the screens can be checked without playing to it.
import { addChild, addTie, changeB, endTie, extOf, showMood, type Tie } from '../../core/bonds';
import type { Ctx, GameData } from '../../core/game';
import { nextLife } from '../../core/lineage';
import { write } from '../../core/log';
import type { GameState, LifeState } from '../../core/types';
import { createSession, runToDeath, startLife } from '../../../scripts/tools/session';

export interface Made {
  state: GameState;
  ctx: Ctx;
  life: LifeState;
}

const memo = new Map<string, Made>();

/** A fresh life of the seed at an age, with an empty bond book (the sample puts in the people it wants). */
function base(data: GameData, seed: number, age: number): Made {
  const s = createSession(data, { seed });
  const life = startLife(s);
  life.hAge = age;
  life.ext.bonds = undefined;
  extOf(life);
  return { state: s.game.state, ctx: s.game.ctx, life };
}

const person = (m: Made, o: Parameters<typeof addTie>[2]): Tie => {
  const t = addTie(m.ctx, m.life, { race: 'same', gap: 0, ...o });
  t.rapport = false;
  t.family = false;
  return t;
};

/** A feeling that lasts `years` more (the way `showMood` leaves it on the tie). */
const feel = (m: Made, t: Tie, mood: string, why: string, years = 3): void => {
  if (!showMood(m.ctx, m.life, t, mood, why)) t.moods.push({ mood, until: m.life.hAge + years });
};

/** A life of forty with a partner and four children, a mother, a brother, a friend, a rival, a student and a companion on the road. */
export function familyLife(data: GameData): Made {
  const hit = memo.get('family');
  if (hit) return hit;
  const m = base(data, 4, 41);
  const { ctx, life, state } = m;
  const mother = person(m, { line: 'ญาติผู้ใหญ่', kin: 'mother', gender: 'f', level: 4, from: 'kin', light: true, gap: 26, quiet: true });
  person(m, { line: 'พี่น้อง', kin: 'younger_sibling', gender: 'm', level: 3, from: 'kin', light: true, gap: -4, quiet: true });
  const wife = person(m, { line: 'คนรัก', gender: 'f', level: 5, from: 'peer', gap: 1, b: 92 });
  wife.spouse = true;
  wife.workedWith = life.hAge - 20;
  wife.opened = life.hAge - 20;
  extOf(life).partner = wife.id;
  const ages = [19, 14, 8, 2];
  const kids = ages.map((a) => addChild(ctx, life, { age: a, other: wife }));
  kids.forEach((k, i) => {
    k.born = life.hAge - ages[i];
    k.b = [78, 70, 82, 90][i];
    k.peak = k.b;
  });
  const friend = person(m, { line: 'สหาย', gender: 'm', level: 3, from: 'journey', gap: 2 });
  const rival = person(m, { line: 'คู่แข่ง', gender: 'f', level: 2, from: 'work', gap: -3 });
  const student = person(m, { line: 'ศิษย์', gender: 'm', level: 3, from: 'work', gap: -20 });
  const mate = person(m, { line: 'คู่หู', gender: 'f', level: 4, from: 'journey', gap: -1 });
  extOf(life).party = [mate.id];
  mate.party = life.hAge - 3;
  changeB(ctx, friend, 14, 'asked');
  changeB(ctx, mate, 9, 'party');
  changeB(ctx, rival, 12, 'joy');
  feel(m, wife, 'รัก', 'partner', 4);
  feel(m, wife, 'ไว้ใจ', 'partner', 4);
  feel(m, kids[0], 'ภูมิใจ', 'child:grow', 4);
  feel(m, kids[1], 'ห่วง', 'child:grow', 3);
  feel(m, kids[2], 'เอ็นดู', 'child:grow', 3);
  feel(m, kids[3], 'เอ็นดู', 'child:grow', 3);
  feel(m, mother, 'คิดถึง', 'far', 3);
  feel(m, friend, 'ขอบคุณ', 'asked', 3);
  feel(m, rival, 'ชื่นชม', 'rival', 3);
  feel(m, student, 'ภูมิใจ', 'student', 3);
  feel(m, mate, 'ไว้ใจ', 'party', 3);
  write(state, { sys: 'bonds', kind: 'level', id: wife.id, data: { name: wife.name, line: wife.line, from: 4, to: 5, why: 'joy', b: wife.b }, level: 1 });
  const out = { state, ctx, life };
  memo.set('family', out);
  return out;
}

/** A life of fifty-eight with no one: the father and the mother are dead and nobody took their place. */
export function lonelyLife(data: GameData): Made {
  const hit = memo.get('lonely');
  if (hit) return hit;
  const m = base(data, 6, 58);
  const { ctx } = m;
  const father = person(m, { line: 'ญาติผู้ใหญ่', kin: 'father', gender: 'm', level: 4, from: 'kin', light: true, gap: 28, quiet: true });
  const mother = person(m, { line: 'ญาติผู้ใหญ่', kin: 'mother', gender: 'f', level: 4, from: 'kin', light: true, gap: 25, quiet: true });
  endTie(ctx, father, 'death', 'old', { cause: 'old' });
  endTie(ctx, mother, 'death', 'old', { cause: 'illness' });
  const out = { state: m.state, ctx, life: m.life };
  memo.set('lonely', out);
  return out;
}

/** A life with a friend in trouble: the crisis is announced and waits for the character's answer; a second ally is calm. */
export function crisisLife(data: GameData): Made {
  const hit = memo.get('crisis');
  if (hit) return hit;
  const m = base(data, 8, 33);
  const { ctx, life, state } = m;
  const friend = person(m, { line: 'สหาย', gender: 'f', level: 4, from: 'peer', gap: 1 });
  const mentor = person(m, { line: 'ครู', gender: 'm', level: 3, from: 'school', gap: 25 });
  changeB(ctx, friend, 8, 'asked');
  feel(m, friend, 'ห่วง', 'crisis', 2);
  feel(m, mentor, 'เคารพ', 'school', 3);
  const text = 'ติดหนี้เจ้าหนี้ที่ตามทวงถึงห้องเช่า และไม่มีที่ให้ไป';
  const entry = write(state, { sys: 'bonds', kind: 'crisis', id: friend.id, data: { name: friend.name, line: friend.line, code: 'FT-03', level: 4, text, kin: null, tie: friend.id, gender: friend.gender }, level: 2 });
  extOf(life).crises.push({ tie: friend.id, n: entry.n, beats: 0, age: life.hAge, code: 'FT-03', text });
  const out = { state, ctx, life };
  memo.set('crisis', out);
  return out;
}

/** Three lives of one family: each life ends and the heir takes over (a newcomer when the family has none). The state is the third life, dead. */
export function lineageOfThree(data: GameData, seed = 5): Made {
  const key = `lineage:${seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const s = createSession(data, { seed });
  startLife(s);
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      const r = nextLife(s.game, {});
      if (!r.ok) nextLife(s.game, { newcomer: true });
    }
    runToDeath(s.game);
  }
  const out = { state: s.game.state, ctx: s.game.ctx, life: s.game.state.life! };
  memo.set(key, out);
  return out;
}

/** The middle of the second life: an heir who lives, with the first life behind it (the tree shows the lineage and the household together). */
export function lineageAlive(data: GameData, seed = 5): Made {
  const key = `alive:${seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const s = createSession(data, { seed });
  startLife(s);
  runToDeath(s.game);
  nextLife(s.game, {});
  // the heir lives eight years of the second life
  for (let i = 0; i < 4 * 8 && s.game.state.life && !s.game.state.life.dead; i++) s.game.beat();
  const out = { state: s.game.state, ctx: s.game.ctx, life: s.game.state.life! };
  memo.set(key, out);
  return out;
}
