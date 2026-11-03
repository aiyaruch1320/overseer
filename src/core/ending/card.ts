// The ending card of a life, built from the log at its death with the tier 0 templates (docs/systems/llm/07-ending-templates.md).
// The facts are chosen and ordered by the rules of §2.3; the summary, the card lines and the epitaph are words from the template file.
// The llm layer may replace the summary and the epitaph (`applyEndingText`); it reads `endingInput(state)` and may not add a fact.
import type { Ctx } from '../game';
import { hashText } from '../text/plain';
import { placeName, raceName } from '../text/pick';
import type { Template } from '../data/types-text';
import { currentThreads } from '../lineage/threads';
import { lx } from '../lineage/state';
import { keep, lifeEntries } from './collection';
import { gatherFacts, handOf, lifeLog, num, str, wishCard, type RawFact } from './facts';
import { folkOf } from './people';
import { vowPage } from './vow';
import { lifeGoals } from '../god/goals';
import { knownName } from '../text/labels';
import { CAUSE_WORD, CULTURE, EXTRA_MOMENT, FACT_KINDS, LIFE_EPITAPH, LIMIT, MARK, MOMENT, NOT_MOMENT, FILLER_MOMENT, SCORE, TARGET, TIME_WORD, stageOf } from './tuning';
import type { CauseGroup, EndingCard, EndingInput, Moment, QuestionGrade, SummaryFact, WorldMark } from './types';
import { family, flagWords, pickFrom, timeGroup, whenHolds } from './words';
import type { SlotValues } from '../text/pick';
import { fill } from '../text/pick';
import { pickHeir } from '../lineage/heir';

const GRADE_WORD: Record<QuestionGrade, string> = { good: 'ตอบได้ดี', bad: 'ตอบแย่', open: 'ยังเปิด', early: 'ตายก่อนถึงคำตอบ', changed: 'กลายเป็นอย่างอื่น' };

/** Does any template of the kind fit this fact (slots filled, "ใช้เมื่อ" holds, short enough)? Reads only. */
function usable(ctx: Ctx, f: RawFact): boolean {
  return templatesFor(ctx, f).some((t) => fill(t.text, f.slots) !== null && [...(fill(t.text, f.slots) ?? '')].length <= LIMIT.sentence);
}

/** The sentences of the kind that hold for the fact: the ones whose "ใช้เมื่อ" holds, and for a strict fact only the ones that ask for a condition. */
export function templatesFor(ctx: Ctx, f: RawFact): Template[] {
  const words = flagWords(f.flags);
  return family(ctx, 'life_fact').filter((t) => t.keys['ชนิด'] === f.kind && whenHolds(t, words) && (!f.strict || !!t.when));
}

const hashOf = (ctx: Ctx, life: string, kind: string, age: number | undefined) => hashText(`${ctx.state.seed}|${life}|${kind}|${age ?? ''}`);

/** The facts the summary tells, chosen by the score rules of 07 §2.3. */
export function chooseFacts(ctx: Ctx, all: RawFact[], deadAge: number, lifeId: string): { chosen: (RawFact & { score: number })[]; ranked: (RawFact & { score: number })[] } {
  const prev = lx(ctx.state).recs.length ? Object.values(lx(ctx.state).cards).slice(-1)[0] : undefined;
  const prevFirst = prev?.facts.find((f) => f.pos === 'mid')?.kind;
  const target = TARGET.find((t) => deadAge < t.below)!.n;
  const death = all.find((f) => f.kind === 'ความตาย')!;
  // step 1 and 2: facts that fit, one for each thing (the higher base wins)
  const pool: RawFact[] = [];
  for (const f of all) {
    if (f.kind === 'เกิด' || f.kind === 'ความตาย' || !usable(ctx, f)) continue;
    const dup = f.tags.length ? pool.findIndex((g) => g.tags.some((t) => f.tags.includes(t))) : -1;
    if (dup >= 0) {
      if ((FACT_KINDS[f.kind]?.base ?? 0) > (FACT_KINDS[pool[dup].kind]?.base ?? 0)) pool[dup] = f;
      continue;
    }
    pool.push(f);
  }
  const chosen: (RawFact & { score: number })[] = [{ ...death, score: 100 }];
  const ranked: (RawFact & { score: number })[] = [];
  const left = [...pool];
  while (chosen.length < target && left.length) {
    let best = -1;
    let bestScore = -Infinity;
    let bestHash = 0;
    left.forEach((f, i) => {
      const kind = FACT_KINDS[f.kind];
      if (!kind) return;
      let s = kind.base + (f.bonus ?? 0);
      if (chosen.some((c) => c.kind === f.kind)) s += SCORE.sameKind;
      const st = f.age !== undefined && kind.pos === 'mid' ? stageOf(f.age) : undefined;
      if (st && chosen.filter((c) => c.age !== undefined && FACT_KINDS[c.kind]?.pos === 'mid' && stageOf(c.age) === st).length >= 2) s += SCORE.sameStage;
      if (chosen.length === 1 && prevFirst === f.kind) s += SCORE.lineageFirst;
      const h = hashOf(ctx, lifeId, f.kind, f.age);
      if (s > bestScore || (s === bestScore && h > bestHash)) {
        best = i;
        bestScore = s;
        bestHash = h;
      }
    });
    if (best < 0) break;
    const f = left.splice(best, 1)[0];
    chosen.push({ ...f, score: bestScore });
  }
  for (const f of left) ranked.push({ ...f, score: (FACT_KINDS[f.kind]?.base ?? 0) + (f.bonus ?? 0) });
  return { chosen, ranked };
}

const positionRank = { start: 0, mid: 1, end: 2, after: 3 } as const;

/** Orders by position, then by age inside the middle (07 §2.3 step 6). */
function ordered<T extends RawFact>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const pa = positionRank[FACT_KINDS[a.kind].pos];
    const pb = positionRank[FACT_KINDS[b.kind].pos];
    return pa - pb || (a.age ?? 0) - (b.age ?? 0) || a.kind.localeCompare(b.kind);
  });
}

/** A connector for the sentence that follows `prev` (07 §4: the sequel, the cause, the contrast, the time). */
function connector(ctx: Ctx, prev: RawFact, next: RawFact, lifeId: string, local: Set<string>, last: { id: string }): string {
  const dir = (f: RawFact) => FACT_KINDS[f.kind].dir;
  const tries: { fam: string; keys?: Record<string, string> }[] = [];
  if (FACT_KINDS[next.kind].pos === 'after') tries.push({ fam: 'connect_then' });
  if (prev.tags.some((t) => next.tags.includes(t)) && prev.tags.length) tries.push({ fam: 'connect_because' });
  if ((dir(prev) === 'gain' && dir(next) === 'loss') || (dir(prev) === 'loss' && dir(next) === 'gain')) tries.push({ fam: 'connect_but' });
  tries.push({ fam: 'connect_time', keys: { กลุ่ม: timeGroup(next.age) } });
  // a connector of time that names a span ("a few years later") is true only for that span (M5)
  const gap = (next.age ?? 0) - (prev.age ?? 0);
  const timeOk = (c: Template): boolean => {
    const rule = TIME_WORD[c.text.trim()];
    // a fact with no age (the hand of the god, the roads) has no gap to name
    if (rule && (rule.minGap !== undefined || rule.maxGap !== undefined) && (next.age === undefined || prev.age === undefined)) return false;
    return !rule || ((rule.maxGap === undefined || gap <= rule.maxGap) && (rule.minGap === undefined || gap >= rule.minGap) && (rule.minAge === undefined || (next.age ?? 0) >= rule.minAge));
  };
  for (const t of tries) {
    const cands = family(ctx, t.fam).filter((c) => (!t.keys || Object.entries(t.keys).every(([k, v]) => c.keys[k] === v)) && (t.fam !== 'connect_time' || timeOk(c)));
    const got = pickFrom(ctx, cands, {}, { key: `${lifeId}|conn|${next.kind}|${t.fam}`, local, skip: new Set([last.id]) });
    if (got) {
      last.id = got.id;
      return got.text;
    }
  }
  return '';
}

/** The sentence of a fact, and the id of the template. */
function sentenceOf(ctx: Ctx, f: RawFact, lifeId: string, local: Set<string>): { text: string; id: string } | null {
  return pickFrom(ctx, templatesFor(ctx, f), f.slots, { key: `${lifeId}|fact|${f.kind}|${f.age ?? ''}`, local, max: LIMIT.sentence, words: flagWords(f.flags) });
}

function lineOf(ctx: Ctx, fam: string, keys: Record<string, string>, slots: SlotValues, key: string, max: number, local: Set<string>, onlyFresh = false, need = ''): { text: string; id: string } | null {
  const cands = family(ctx, fam).filter((t) => Object.entries(keys).every(([k, v]) => t.keys[k] === v) && (!need || t.text.includes(need)));
  const x = lx(ctx.state);
  const fit = cands.filter((t) => {
    const text = fill(t.text, slots);
    return text !== null && [...text].length <= max;
  });
  if (onlyFresh && !fit.some((t) => !x.used.includes(t.id))) return null;
  return pickFrom(ctx, onlyFresh ? fit.filter((t) => !x.used.includes(t.id)) : cands, slots, { key, local, max });
}

/**
 * The epitaph (07 §6, §10.3 rule 3): the cell of the culture and the cause, the two lines of the culture, and the lines that tell the life itself, one pool; the template
 * not yet used in this save comes first. The plain lines of the cause are the last resort for a race with no culture group.
 */
function epitaphOf(ctx: Ctx, slots: SlotValues, race: string, group: CauseGroup, lifeId: string): { text: string; id: string } {
  const g = CULTURE[race];
  const key = `${lifeId}|epitaph`;
  const own: Template[] = LIFE_EPITAPH.map((e) => ({ id: e.id, family: 'epitaph_life', keys: {}, col: '', text: e.text, slots: [], src: 'tuning' }));
  const pool = [
    ...(g ? family(ctx, 'epitaph_cause').filter((t) => t.keys['กลุ่ม'] === g && t.col === group) : []),
    ...(g ? family(ctx, 'epitaph_group').filter((t) => t.keys['กลุ่ม'] === g) : []),
    ...own,
  ];
  return pickFrom(ctx, pool, slots, { key, max: LIMIT.epitaph }) ?? pickFrom(ctx, family(ctx, 'epitaph_cause_general').filter((t) => t.keys['สาเหตุ'] === group), slots, { key, max: LIMIT.epitaph }) ?? { text: `${String(slots.name)} อายุ ${String(slots.age)}`, id: 'epitaph.plain' };
}

/** The mark of the life on the world (03 §2; assumption: the doc names three levels and no rule). */
function markOf(passedCv: number, bigEvents: number, fame: number, classUp: boolean): { level: WorldMark; label: string } {
  const level: WorldMark = passedCv >= MARK.eraConverge && bigEvents >= MARK.eraEvents ? 'era' : passedCv >= MARK.localConverge || fame >= MARK.localFame || classUp ? 'local' : 'none';
  return { level, label: MARK.labels[level] };
}

const trimTo = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s);

/** Builds the card of the life that just died. Writes the used templates and the collection to the save; draws nothing. */
export function buildCard(ctx: Ctx): { card: EndingCard; input: EndingInput } {
  const st = ctx.state;
  const life = st.life!;
  const x = lx(st);
  const ending = (life.ext.story as { ended?: string } | undefined)?.ended ?? null;
  const g = gatherFacts(ctx, ending);
  const deadAge = life.dead?.hAge ?? life.hAge;
  const log = lifeLog(ctx);
  const { chosen } = chooseFacts(ctx, g.facts, deadAge, life.id);
  const all = ordered([g.facts.find((f) => f.kind === 'เกิด')!, ...chosen.map((c) => ({ ...c }))]);

  // the summary: the birth, the facts with their connectors, the death
  const local = new Set<string>();
  const last = { id: '' };
  const facts: SummaryFact[] = [];
  const sentences: string[] = [];
  let prev: RawFact | undefined;
  let trimmed = all;
  for (let round = 0; round < 6; round++) {
    sentences.length = 0;
    facts.length = 0;
    local.clear();
    last.id = '';
    prev = undefined;
    for (const f of trimmed) {
      const s = sentenceOf(ctx, f, life.id, local);
      if (!s) continue;
      const c = prev ? connector(ctx, prev, f, life.id, local, last) : '';
      sentences.push(c ? `${c} ${s.text}` : s.text);
      const k = FACT_KINDS[f.kind];
      const score = (chosen.find((q) => q.kind === f.kind && q.age === f.age)?.score ?? 0);
      facts.push({ kind: f.kind, base: k.base, score, dir: k.dir, pos: k.pos, ...(f.age !== undefined ? { age: f.age } : {}), slots: f.slots, sentence: s.text, template: s.id });
      prev = f;
    }
    if ([...sentences.join(' ')].length <= LIMIT.summary || facts.length <= 3) break;
    // too long: the fact with the lowest score in the middle goes (07 §10.2 does not allow dropping below three facts)
    const drop = trimmed.filter((f) => FACT_KINDS[f.kind].pos === 'mid').sort((a, b) => (chosen.find((q) => q.kind === a.kind && q.age === a.age)?.score ?? 0) - (chosen.find((q) => q.kind === b.kind && q.age === b.age)?.score ?? 0))[0];
    if (!drop) break;
    trimmed = trimmed.filter((f) => f !== drop);
  }
  const summary = sentences.join(' ');

  // the question line (07 §5.3)
  const qf = g.facts.find((f) => f.kind === 'คำตอบของคำถามชีวิต');
  const question = String(qf?.slots.question ?? '');
  const qLine = question
    ? lineOf(ctx, 'card_question', { จบแบบ: GRADE_WORD[g.grade] }, { question, answer: qf?.slots.answer, age: deadAge }, `${life.id}|question`, LIMIT.questionLine, new Set(), false, '{question}')
    : null;

  // the three moments (07 §5.4, 03 §1): the turning points of the life, chosen by the scores of 07 §2.3 from all the facts (children, a lover lost, a curse, a betrayal, the
  // hand of the god, a war, a ruin lived through). The question is on the card already, so its fact is a moment only when nothing better exists.
  const inSummary = new Set(facts.map((f) => `${f.kind}|${f.age ?? ''}`));
  const moments = momentsOf(ctx, g.facts, inSummary, life.id);

  // the title line (07 §5.2): the titles of the life that the goals gave at the death (08-goals §3), one to three; a life with none gets the lines with no title
  const titles = lifeGoals(life).result?.titles ?? [];
  const base: SlotValues = { name: life.name, race: raceName(ctx, life.race), home: placeName(ctx, life.home) ?? '', ...(titles[0] ? { title_1: titles[0] } : {}), ...(titles[1] ? { title_2: titles[1] } : {}), ...(titles[2] ? { title_3: titles[2] } : {}) };
  // a title line too long falls back to the forms with one title, then to the forms with no title (7 and 8; 9 says "no title", which would be false); the name alone is the last resort
  const cands = (forms: string[]) => family(ctx, 'card_title').filter((t) => forms.includes(t.keys['แบบ']));
  const byCount = titles.length >= 3 ? ['3'] : titles.length === 2 ? ['2'] : ['1', '4', '5', '6'];
  const title =
    (titles.length ? pickFrom(ctx, cands(byCount), base, { key: `${life.id}|title`, max: LIMIT.titleLine }) ?? pickFrom(ctx, cands(['1', '4', '5', '6']), base, { key: `${life.id}|title`, max: LIMIT.titleLine }) : null) ??
    pickFrom(ctx, cands(titles.length ? ['7', '8'] : ['7', '8', '9']), base, { key: `${life.id}|title`, max: LIMIT.titleLine }) ?? { text: trimTo(life.name, LIMIT.titleLine), id: 'card_title.name' };

  // the epitaph (07 §6)
  const loveFact = g.facts.find((f) => f.kind === 'คนรัก');
  const kidsN = num(g.facts.find((f) => f.kind === 'ทายาท')?.slots.child_count);
  const far = !!g.place && g.place !== (placeName(ctx, life.home) ?? '');
  const ep = epitaphOf(
    ctx,
    {
      name: life.name,
      age: deadAge,
      place: g.place,
      home: placeName(ctx, life.home) ?? '',
      ...(g.enemy ? { enemy: g.enemy } : {}),
      ...(far ? { place_far: g.place } : { home_death: placeName(ctx, life.home) ?? '' }),
      ...(life.job ? { job: knownName(ctx.data, life.job) ?? '' } : {}),
      ...(kidsN > 0 ? { child_count: kidsN } : {}),
      ...(loveFact?.flags.includes('together') ? { lover: str(loveFact.slots.lover) } : {}),
    },
    life.race,
    g.group,
    life.id,
  );


  // what the life opened, and the mark it left on the world
  const earned = keep(st, lifeEntries(ctx, life, log));
  const hand = handOf(ctx, life);
  const heir = pickHeir(ctx);
  const threads = currentThreads(ctx);
  const passedCv = Object.keys(life.passed).filter((id) => id.startsWith('cv.') && !x.preset.includes(id)).length;
  const bigEvents = log.filter((e) => e.sys === 'world' && e.kind === 'event' && e.worldYear >= life.birthYear && String(e.data.mark).includes('⭐')).length;
  const fame = num((life.ext.character as { fame?: number } | undefined)?.fame);
  const classUp = log.some((e) => e.sys === 'character' && e.kind === 'class' && num(/\d/.exec(String(e.data.to))?.[0]) > num(/\d/.exec(String(e.data.from))?.[0]));
  const mark = markOf(passedCv, bigEvents, fame, classUp);
  // a newcomer in the old world is not a generation of the family (0 = none; 05 §4)
  const generation = x.recs.find((r) => r.id === life.id)?.origin === 'newcomer' ? 0 : st.lineage.lives.length + 1;
  const passed = threads.map((t) => t.text);

  // the vow and its page (07 §7), the people and the traces (03 §1)
  const vow = vowPage(ctx, life, log, CAUSE_WORD[g.group], mark.label);
  const folk = folkOf(ctx, life, { deadAge, titles, conjured: hand.conjured ?? [], mark });
  const wish = wishCard(life);

  // the card (07 §5.1): head, title, question, three moments, the vow, the ending of the story, the epitaph
  const head = [life.name, raceName(ctx, life.race), placeName(ctx, life.home) ?? '', `อายุ ${deadAge}`].filter(Boolean);
  let headLine = head.join(' · ');
  if ([...headLine].length > LIMIT.headLine) headLine = trimTo([head[0], head[1], head[3]].join(' · '), LIMIT.headLine);
  const lines = [headLine, title?.text ?? '', qLine?.text ?? '', ...moments.map((m) => m.line), vow?.line ?? '', ending ? `ปลายทาง: ${ending}` : '', ep.text].filter((l) => l !== '');

  const card: EndingCard = {
    v: 1,
    life: life.id,
    generation,
    name: life.name,
    race: life.race,
    home: life.home,
    bornYear: life.birthYear,
    diedYear: life.dead?.year ?? st.clock.worldYear,
    age: deadAge,
    cause: life.dead?.cause ?? '',
    group: g.group,
    ending,
    question: { text: question, grade: g.grade, line: qLine?.text ?? '' },
    titleLine: title?.text ?? '',
    moments,
    facts,
    summary: { text: summary, source: 'template' },
    epitaph: { text: ep.text, source: 'template' },
    hand,
    earned,
    mark,
    lines,
    ...(heir ? { heir: { name: heir.name, how: heir.how, age: heir.age } } : {}),
    // a thread goes to an heir; a family with none leaves it to fade (heirs/03 §3)
    threads: heir ? passed : [],
    titles,
    ...(vow ? { vow } : {}),
    people: folk.people,
    traces: folk.traces,
    ...(wish ? { wish } : {}),
  };
  const names = [...new Set([life.name, ...facts.flatMap((f) => ['name', 'lover', 'child', 'heir', 'npc', 'enemy'].map((k) => (f.slots[k] === undefined ? '' : String(f.slots[k])))), ...folk.names].filter(Boolean))];
  const input: EndingInput = {
    v: 1,
    seed: st.seed,
    life: { id: life.id, name: life.name, race: life.race, raceName: raceName(ctx, life.race), gender: life.gender, home: life.home, homeName: placeName(ctx, life.home) ?? '', bornYear: life.birthYear, diedYear: card.diedYear, age: deadAge, cls: life.cls, job: life.job ?? '' },
    death: { cause: card.cause, group: g.group, place: g.place, ...(g.enemy ? { enemy: g.enemy } : {}) },
    ...(ending ? { ending } : {}),
    question: { text: question, grade: g.grade },
    facts: facts.map(({ sentence: _s, template: _t, ...rest }) => rest),
    moments,
    hand,
    lineage: { dynasty: x.dynasty || life.name, generation, ...(x.recs.find((r) => r.id === life.id)?.parent ? { parent: x.recs.find((r) => r.id === life.id)!.parent } : {}), ...(heir ? { heir: heir.name } : {}), threads: heir ? passed : [] },
    titles,
    ...(vow ? { vow: { name: vow.name, result: vow.result, lines: vow.lines } } : {}),
    people: folk.people,
    traces: folk.traces,
    ...(wish ? { wish } : {}),
    names,
    others: [...new Set([...st.lineage.lives.map((l) => l.name), ...folk.others])].filter((n) => !names.includes(n)),
    earned,
  };
  return { card, input };
}

/** The base of a kind as a moment: the score of 07 §2.2, or the one of a turning point that has no sentence (`EXTRA_MOMENT`). */
const baseOfMoment = (kind: string): number | undefined => FACT_KINDS[kind]?.base ?? EXTRA_MOMENT[kind]?.base;

/**
 * The three moments of the card (07 §2.3 "สามช่วงเวลาของการ์ด", 03 §1): the facts with a short line, the highest scores first, one for each kind (a loss of any kind counts as one
 * family), the same stage of life twice costs 3 (the age of a fact with no age is unknown, so it has no stage). Two facts about one person or one event are one thing. The fact
 * of the question comes last: the card holds the question line already. Ordered by age at the end.
 */
export function momentsOf(ctx: Ctx, all: RawFact[], inSummary: Set<string>, lifeId: string): Moment[] {
  const pool: { f: RawFact; s: number }[] = [];
  for (const f of all) {
    const base = baseOfMoment(f.kind);
    if (base === undefined || NOT_MOMENT.includes(f.kind) || FILLER_MOMENT.includes(f.kind)) continue;
    // a lover who was a friend first: the card says when they became lovers, not "met" (the short line of the lover says "met")
    if (f.kind === 'คนรัก' && (f.flags.includes('late') || f.flags.includes('carried'))) continue;
    const s = f.kind === 'คำตอบของคำถามชีวิต' ? MOMENT.question : base + (f.bonus ?? 0) + (MOMENT.heardKinds.includes(f.kind) ? MOMENT.heard : 0) + (inSummary.has(`${f.kind}|${f.age ?? ''}`) ? MOMENT.inSummary : 0);
    const dup = f.tags.length ? pool.findIndex((q) => q.f.tags.some((t) => f.tags.includes(t))) : -1;
    if (dup >= 0) {
      if (s > pool[dup].s) pool[dup] = { f, s };
      continue;
    }
    pool.push({ f, s });
  }
  const out: { f: RawFact; line: string }[] = [];
  const familyOf = (kind: string) => (MOMENT.lossFamily.includes(kind) ? 'loss' : MOMENT.ruinFamily.includes(kind) ? 'ruin' : kind);
  while (out.length < 3 && pool.length) {
    let best = -1;
    let bestScore = -Infinity;
    let bestHash = 0;
    pool.forEach(({ f, s }, i) => {
      if (out.some((o) => familyOf(o.f.kind) === familyOf(f.kind))) return;
      let score = s;
      const st = f.age !== undefined ? stageOf(f.age) : undefined;
      if (st && out.filter((o) => o.f.age !== undefined && stageOf(o.f.age) === st).length >= 2) score += SCORE.sameStage;
      const h = hashOf(ctx, lifeId, f.kind, f.age);
      if (score > bestScore || (score === bestScore && h > bestHash)) {
        best = i;
        bestScore = score;
        bestHash = h;
      }
    });
    if (best < 0) break;
    const { f } = pool.splice(best, 1)[0];
    const extra = EXTRA_MOMENT[f.kind];
    const line = extra ? fill(extra.line, f.slots) : lineOf(ctx, 'card_short', { ชนิด: f.kind }, f.slots, `${lifeId}|short|${f.kind}`, LIMIT.momentLine, new Set())?.text ?? null;
    if (line && [...line].length <= LIMIT.momentLine) out.push({ f, line });
  }
  return out
    .map(({ f, line }): Moment => ({ kind: f.kind, ...(f.age !== undefined ? { age: f.age } : {}), line }))
    .sort((a, b) => (a.age ?? 999) - (b.age ?? 999));
}
