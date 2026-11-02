// Where ties come from (docs/systems/bonds/03-formation.md §1, §4.1, §5 and 07-successors.md): the school years, the people of the roster who
// are met in the country the character lives in, the NPCs whose story made them an ally, and the allies who bind with each other.
import type { Ctx } from '../game';
import { write } from '../log';
import type { LifeState } from '../types';
import { idx as characterIdx } from '../character/data';
import { bondsIndex, floorB } from './data';
import { plain, startArc } from './arcs';
import { addTie, hAgeOf, raceRow, tieLog } from './people';
import { holderPlace, rowOf, slotHAge, slotOf, allRows } from './npcs';
import { closeTies, extOf, isLive, levelOf, looseTies, tiesOf, type BondsExt, type Tie } from './state';
import { FLAG_MEET, FLAG_MEET_AGE, SCHOOL_AGE } from './tuning';

/** Is there room for a loose tie (levels 1 and 2: at most 10, 01 §2)? A new tie that would start at level 3 or more also needs room among the close ones. */
export function hasRoom(ctx: Ctx, e: BondsExt, level: number): boolean {
  if (level >= 3) return closeTies(ctx, e).length < bondsIndex(ctx).data.ties.caps.close;
  return looseTies(ctx, e).length < bondsIndex(ctx).data.ties.caps.loose;
}

/** The weight a line gets from the character's work (03 §5): `ผู้กล้า นักผจญภัย ...` read against the Thai name of the job. */
export function lineWeights(ctx: Ctx, life: LifeState, lines: string[]): number[] {
  const out = lines.map(() => 1);
  if (!life.job || !ctx.data.jobs) return out;
  const name = characterIdx(ctx).jobs.get(life.job)?.name;
  if (!name) return out;
  for (const g of bondsIndex(ctx).data.formation.occupations) {
    if (!g.groupRaw.split(/\s+/).some((w) => w && name.includes(w))) continue;
    for (const l of g.lines) {
      const i = lines.indexOf(l.line);
      if (i >= 0) out[i] *= l.mul;
    }
  }
  return out;
}

/** A person who enters the life from a source of 03 §1: the line is drawn among the lines the source gives, by the work of the character. */
export function meet(ctx: Ctx, life: LifeState, source: string, lines: string[], opt: { level?: number; race?: 'same' | 'any' } = {}): Tie | undefined {
  const e = extOf(life);
  const level = opt.level ?? 1;
  if (!hasRoom(ctx, e, level)) return undefined;
  const w = lineWeights(ctx, life, lines);
  const line = lines[Math.max(0, ctx.rng('bonds.meet').weighted(w))];
  const t = addTie(ctx, life, { line, level, from: source, race: opt.race ?? 'any' });
  startArc(ctx, life, t);
  return t;
}

// ---------- the school years ----------

/** Teacher and schoolmate (03 §1 row 3): once, at an age between 10 and 24 drawn at birth. */
export function schoolYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  if (e.done.includes('school')) return;
  const rng = ctx.rng('bonds.meet');
  if (!e.schoolAt) e.schoolAt = rng.int(SCHOOL_AGE[0], SCHOOL_AGE[1]);
  const when = e.schoolAt;
  if (life.hAge < when) return;
  e.done.push('school');
  const rule = bondsIndex(ctx).data.formation.candidates.find((c) => c.id === 'school');
  const [pt, pm] = rule?.chances ?? [0.5, 0.4];
  if (rng.chance(pt)) meet(ctx, life, 'school', ['ครู'], { level: 2, race: 'same' });
  if (rng.chance(pm)) meet(ctx, life, 'school', ['สหาย', 'คู่แข่ง'], { level: 2, race: 'same' });
}

// ---------- the roster ----------

function gen2(slot: { gen: number }): boolean {
  return slot.gen > 1;
}

/** A person of the roster who stands in a tie: his own axes and holder (a new holder is a new person). */
export function addNpcTie(ctx: Ctx, life: LifeState, npc: string, line: string, level: number, from: string): Tie | undefined {
  const e = extOf(life);
  const slot = slotOf(ctx, npc);
  const row = rowOf(ctx, npc);
  if (!slot || !row || slot.status !== 'alive') return undefined;
  if (tiesOf(e).some((t) => t.npc === npc && isLive(t))) return undefined;
  const race = row.peopleId ? raceRow(ctx, row.peopleId) : undefined;
  const bound = ['MH09-7', 'NR05-7', 'SH01-7', 'MK16-7'].includes(npc) && slot.gen === 1 ? 'B2' : undefined;
  const t = addTie(ctx, life, {
    line, level, from, name: slot.name, race: race?.id ?? life.race, country: holderPlace(slot, row), gap: Math.round(slotHAge(ctx, slot) - life.hAge),
    bound, gratitude: slot.rel['mc.favor'] ?? 0, trust: Math.max(0, slot.rel['mc.trust'] ?? 0), known: slot.rel['mc.known'] ?? 0, quiet: true,
  });
  t.npc = npc;
  t.gen = slot.gen;
  tieLog(ctx, t);
  return t;
}

/** The lines a person of the roster can take for this character, by age (03 §2: friends within 25 years, lovers within 20, a teacher older, a student 10 years younger). */
function lineFor(ctx: Ctx, life: LifeState, lines: string[], hAge: number): string | undefined {
  const rule = bondsIndex(ctx).data.formation.pairing;
  const gap = hAge - life.hAge;
  return lines.find((l) => {
    if (l === 'ครู') return gap >= 8;
    if (l === 'ศิษย์') return gap <= -rule.studentYoungerBy;
    if (l === 'คนรัก') return Math.abs(gap) <= rule.loverMaxAgeGap && hAge >= 18 && life.hAge >= 18;
    if (l === 'ญาติรุ่นเยาว์' || l === 'ญาติผู้ใหญ่') return true;
    return Math.abs(gap) <= rule.friendMaxAgeGap;
  });
}

/**
 * The written allies (55) are met where they live: a roster position with a living holder in the country the character lives in is met with a small
 * chance each year. The holder after the first is the written successor (07 §1): the same story, one level lower, and never a lover (rule 4 and 5).
 * A position whose story set `mc.ally` (the ally chance of a path) becomes a tie whoever he is.
 */
export function rosterYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  if (!ctx.data.npcs) return;
  const ix = bondsIndex(ctx);
  const rng = ctx.rng('bonds.meet');
  for (const [npc, arc] of ix.arcs) {
    const slot = slotOf(ctx, npc);
    if (!slot || slot.status !== 'alive') continue;
    if (tiesOf(e).some((t) => t.npc === npc)) continue;
    const row = rowOf(ctx, npc);
    if (!row || holderPlace(slot, row) !== life.country) continue;
    // a person the character holds is no ally before he is freed (03 §2)
    if (((life.ext.bondage as { held?: { npc?: string; gone?: string }[] } | undefined)?.held ?? []).some((h) => h.npc === npc && !h.gone)) continue;
    const marked = slot.rel['mc.ally'] === 1;
    if (!marked && (life.hAge < FLAG_MEET_AGE || !rng.chance(FLAG_MEET))) continue;
    const succ = gen2(slot) ? ix.successors.get(npc) : undefined;
    const lines = (succ ? succ.lines : arc.lines).filter((l) => !(succ && l === 'คนรัก'));
    const line = lineFor(ctx, life, lines, slotHAge(ctx, slot));
    if (!line) continue;
    const level = succ ? Math.max(1, 2 - ix.data.successors.levelDrop) : 2;
    if (!hasRoom(ctx, e, level)) continue;
    const t = addNpcTie(ctx, life, npc, line, level, marked ? 'ally' : 'roster');
    if (!t) continue;
    t.arc = { code: npc, stage: 1, next: life.hAge + rng.int(2, 4), flag: true };
    if (marked) slot.rel['mc.ally'] = 2;
    // who he is: the written introduction, and for a successor how he stands to the original and what ties him (07 §2)
    write(ctx.state, {
      sys: 'bonds', kind: succ ? 'successor' : 'ally', id: t.id,
      data: { name: t.name, npc, line: t.line, origin: arc.origin, text: plain(succ ? `${succ.relation} · ${succ.hook}` : arc.intro).slice(0, 240), proto: succ ? succ.protoName : null },
      level: 1,
    });
  }
  // a position of the roster that is no written ally but whose story made the character his ally (the ally chance of a path)
  for (const row of allRows(ctx)) {
    const slot = slotOf(ctx, row.id);
    if (!slot || slot.rel['mc.ally'] !== 1 || ix.arcs.has(row.id) || slot.status !== 'alive') continue;
    if (tiesOf(e).some((t) => t.npc === row.id)) {
      slot.rel['mc.ally'] = 2;
      continue;
    }
    const lines = ['สหาย', 'คู่หู', 'ครู', 'ศิษย์'];
    const line = lineFor(ctx, life, lines, slotHAge(ctx, slot));
    if (!line || !hasRoom(ctx, e, 2)) continue;
    const t = addNpcTie(ctx, life, row.id, line, 2, 'ally');
    slot.rel['mc.ally'] = 2;
    if (t) startArc(ctx, life, t);
  }
}

// ---------- allies who bind with each other (03 §4.1) ----------

export function amongYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  const rule = bondsIndex(ctx).data.formation.among;
  const rng = ctx.rng('bonds.among');
  const open = e.among.filter((p) => !p.closed);
  // stories of the pairs roll once, 2 to 6 life years after the tie forms
  for (const p of open) {
    const a = e.ties[p.a];
    const b = e.ties[p.b];
    if (!a || !b || !isLive(a) || !isLive(b)) {
      p.closed = true;
      continue;
    }
    const wait = rule.storyYears[0] + (hashPair(p.a, p.b) % (rule.storyYears[1] - rule.storyYears[0] + 1));
    if (!p.story && life.hAge >= p.at + wait) {
      p.story = true;
      const story = bondsIndex(ctx).data.formation.pairStories.find((s) => s.line === p.line);
      const pick = story ? story.choices[Math.max(0, rng.weighted(story.choices.map((c) => c.weight)))] : undefined;
      write(ctx.state, { sys: 'bonds', kind: 'pair-story', id: `${p.a}+${p.b}`, data: { a: a.name, b: b.name, line: p.line, key: pick?.key ?? '', text: pick?.label ?? '' }, level: 0 });
      if (p.line === 'คู่แข่ง' && pick?.key === 'c') p.closed = true;
      if (p.line === 'คนรัก' && pick?.key === 'c') p.closed = true;
    }
  }
  if (e.among.filter((p) => !p.closed).length >= rule.maxOpenPairs) return;
  if (!rng.chance(rule.chancePerYear)) return;
  const pool = tiesOf(e).filter((t) => isLive(t) && !t.light && levelOf(ctx, t) >= rule.minLevel && t.country === life.country);
  if (pool.length < 2) return;
  const a = pool[rng.int(0, pool.length - 1)];
  const rest = pool.filter((t) => t.id !== a.id && !e.among.some((p) => !p.closed && ((p.a === a.id && p.b === t.id) || (p.b === a.id && p.a === t.id)) ));
  if (!rest.length) return;
  const b = rest[rng.int(0, rest.length - 1)];
  const lines = Object.keys(rule.lineWeights);
  let line = lines[Math.max(0, rng.weighted(lines.map((l) => rule.lineWeights[l])))];
  // lovers only when both could be lovers; otherwise friends (03 §4.1)
  if (line === 'คนรัก' && !(hAgeOf(ctx, a) >= 18 && hAgeOf(ctx, b) >= 18 && Math.abs(hAgeOf(ctx, a) - hAgeOf(ctx, b)) <= 20 && !a.kin && !b.kin)) line = 'สหาย';
  e.among.push({ a: a.id, b: b.id, line, at: life.hAge, story: false });
  write(ctx.state, { sys: 'bonds', kind: 'among', id: `${a.id}+${b.id}`, data: { a: a.name, b: b.name, line }, level: 0 });
}

function hashPair(a: string, b: string): number {
  let h = 0;
  for (const c of a + b) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export { floorB };
