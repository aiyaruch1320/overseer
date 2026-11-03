// The stories of the ties (docs/systems/bonds/04-friend-arcs.md, 05-family.md §2, lore/storylines/28 and 29): five stages, the third a crisis,
// the last an ending drawn by weight. A story walks one step a year; a stage that opens at a level waits for the bond to reach it, and the
// story goes on alone when it does not (04 §2: "การไม่ช่วยเป็นทางเลือกที่ถูกต้อง").
import type { Ctx } from '../game';
import { write } from '../log';
import { apply, test } from '../rules';
import type { Effect, LifeState } from '../types';
import type { StoryTemplate } from '../data/types-bonds';
import { openLine } from '../story';
import { bondsIndex } from './data';
import { addGratitude, changeB, endTie, hAgeOf, setLine } from './people';
import { showMood } from './moods';
import { answered } from '../attention';
import { extOf, isLive, levelOf, type ArcState, type BondsExt, type Nudge, type Tie } from './state';
import { CRISIS_CARD, CRISIS_MAX_BEATS, ENDING_B, HELP, HELP_BASE, KIN_TEMPLATES, STAGE_GAP, STAGE_PATIENCE } from './tuning';
import { grantPair } from './items';

export const SRC = { sys: 'bonds', stream: 'bonds.arc' } as const;
const rng0 = (ctx: Ctx) => ctx.rng('bonds.crisis');

/** Runs `fn` with the tie as the subject of the effects (`stat B`, `บุญคุณ`, `mood`, `template` speak of him). */
export function withFocus<T>(e: BondsExt, t: Tie | null, fn: () => T): T {
  const was = e.focus;
  e.focus = t ? t.id : null;
  try {
    return fn();
  } finally {
    e.focus = was;
  }
}

// ---------- choosing a template ----------

function fits(ctx: Ctx, life: LifeState, t: Tie, tpl: StoryTemplate): boolean {
  if (!tpl.allLines && !tpl.lines.includes(t.line)) return false;
  const age = hAgeOf(ctx, t);
  if (tpl.age && (age < tpl.age[0] || age > tpl.age[1])) return false;
  const cls = Number(String(life.cls).replace(/\D/g, '')) || 3;
  if (tpl.classRange && (cls < tpl.classRange[0] || cls > tpl.classRange[1])) return false;
  if (tpl.fitCond && !test(ctx, tpl.fitCond)) return false;
  return true;
}

/** A template for a tie: family templates for the kin who are close, friend templates for the rest, none used twice in a life while another fits. */
export function pickTemplate(ctx: Ctx, life: LifeState, t: Tie, from?: string[]): StoryTemplate | undefined {
  const e = extOf(life);
  const ix = bondsIndex(ctx);
  let pool: StoryTemplate[];
  if (from) pool = from.map((c) => ix.templates.get(c)).filter((x): x is StoryTemplate => !!x);
  else if (t.kin && t.kin !== 'child' && t.kin !== 'adopted') {
    const codes = KIN_TEMPLATES[t.kin] ?? [];
    pool = codes.map((c) => ix.templates.get(c)).filter((x): x is StoryTemplate => !!x);
  } else pool = ix.ft;
  const ok = pool.filter((p) => fits(ctx, life, t, p));
  const fresh = ok.filter((p) => !e.used.includes(p.id));
  const list = fresh.length ? fresh : ok;
  if (!list.length) return undefined;
  return list[ctx.rng('bonds.arc').int(0, list.length - 1)];
}

/** Starts a story on a tie (stage 1 is the meeting that made the tie). A hand-written story for a roster person is started by `startFlag`. */
export function startArc(ctx: Ctx, life: LifeState, t: Tie, code?: string): ArcState | undefined {
  if (t.arc && t.arc.stage < 5 && !t.arc.end) return t.arc;
  const e = extOf(life);
  const ix = bondsIndex(ctx);
  const tpl = code ? ix.templates.get(code) : pickTemplate(ctx, life, t);
  if (!tpl) return undefined;
  if (!e.used.includes(tpl.id)) e.used.push(tpl.id);
  const rng = ctx.rng('bonds.arc');
  t.arc = { code: tpl.id, stage: 1, next: life.hAge + rng.int(STAGE_GAP[0], STAGE_GAP[1]) };
  write(ctx.state, { sys: 'bonds', kind: 'arc', id: t.id, data: { name: t.name, line: t.line, code: tpl.id, stage: 1, title: tpl.name, text: '' }, level: 0 });
  return t.arc;
}

// ---------- stages ----------

interface StageView {
  title: string;
  text: string;
  mood?: { line: string; mood: string; level: number };
  flagMoods?: { line: string; mood: string; level: number }[];
}

function stageView(ctx: Ctx, t: Tie, arc: ArcState, n: number): StageView {
  const ix = bondsIndex(ctx);
  if (arc.flag) {
    const a = ix.arcs.get(arc.code);
    const s = a?.steps.find((x) => x.n === n);
    return { title: s?.title ?? '', text: plain(s?.text ?? ''), flagMoods: s?.moods.map((m) => ({ line: m.line, mood: m.mood, level: m.level })) ?? [] };
  }
  const tpl = ix.templates.get(arc.code);
  if (!tpl) return { title: '', text: '' };
  const text = n === 2 ? tpl.stage2 : n === 3 ? tpl.stage3 : tpl.stage4;
  const m = tpl.moods[n - 2];
  return { title: tpl.name, text, mood: m ? { line: m.line, mood: m.mood, level: m.level } : undefined };
}

const OPEN_LEVEL = [1, 1, 2, 3, 4, 5];

/** The words of a written step without the markers the documents carry: `{สหาย:ห่วง@2}` and the links. */
export function plain(text: string): string {
  return text.replace(/`?\{[^}]*\}`?/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').replace(/\s+([·.])/g, '$1').trim();
}

/** One life year of every story. */
export function arcsYear(ctx: Ctx, life: LifeState, e: BondsExt): void {
  for (const t of Object.values(e.ties)) {
    const arc = t.arc;
    if (!arc || arc.end || arc.stage >= 5) continue;
    if (!isLive(t)) {
      // the person is gone before the end: the story ends with him (04 §2); nothing is drawn
      arc.end = 'c';
      continue;
    }
    if (life.hAge < arc.next) continue;
    stage(ctx, life, e, t, arc);
  }
}

function stage(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie, arc: ArcState): void {
  const n = arc.stage + 1;
  const lv = levelOf(ctx, t);
  const need = OPEN_LEVEL[n];
  const waited = arc.waitedFrom === undefined ? 0 : life.hAge - arc.waitedFrom;
  // a person another owner holds does not reach the fourth stage before he is free (03 §2)
  if (n >= 4 && t.bound) return;
  if (lv < need && waited < STAGE_PATIENCE && n < 5) {
    arc.waitedFrom ??= life.hAge;
    return;
  }
  if (n === 5 && lv < 5 && waited < STAGE_PATIENCE) {
    arc.waitedFrom ??= life.hAge;
    return;
  }
  arc.waitedFrom = undefined;
  const involved = lv >= need;
  arc.stage = n;
  arc.next = life.hAge + ctx.rng('bonds.arc').int(STAGE_GAP[0], STAGE_GAP[1]);
  if (n === 5) return void ending(ctx, life, e, t, arc);
  const v = stageView(ctx, t, arc, n);
  write(ctx.state, { sys: 'bonds', kind: 'arc', id: t.id, data: { name: t.name, line: t.line, code: arc.code, stage: n, title: v.title, text: v.text, involved }, level: involved ? 1 : 0 });
  if (!involved) {
    e.counts.news++;
    write(ctx.state, { sys: 'bonds', kind: 'news', id: t.id, data: { name: t.name, line: t.line, code: arc.code, stage: n, text: v.text }, level: 0 });
  }
  if (involved) {
    if (v.mood) showMood(ctx, life, t, v.mood.mood, `${arc.code} ${n}`);
    for (const m of v.flagMoods ?? []) showMoodAs(ctx, life, t, m.line, m.mood, `${arc.code} ${n}`);
  }
  if (n === 3) crisis(ctx, life, e, t, arc, v, involved);
  if (n === 4 && involved) {
    changeB(ctx, t, 2, `${arc.code} 4`);
    switchLine(ctx, t, arc);
  }
}

/** A mood the document puts on a line the person has or will have in the story (`ศิษย์` then `สหาย`): judged on that line. */
function showMoodAs(ctx: Ctx, life: LifeState, t: Tie, line: string, mood: string, why: string): void {
  if (line === t.line) {
    showMood(ctx, life, t, mood, why);
    return;
  }
  const arcLines = t.arc?.flag ? bondsIndex(ctx).arcs.get(t.arc.code)?.lines ?? [] : [];
  if (!arcLines.includes(line)) {
    showMood(ctx, life, t, mood, why);
    return;
  }
  const keep = t.line;
  t.line = line;
  try {
    showMood(ctx, life, t, mood, why);
  } finally {
    t.line = keep;
  }
}

function switchLine(ctx: Ctx, t: Tie, arc: ArcState): void {
  if (!arc.flag) return;
  const lines = bondsIndex(ctx).arcs.get(arc.code)?.lines ?? [];
  const next = lines[1];
  if (next && next !== t.line && next !== 'คนรัก' && lines[0] === t.line) setLine(ctx, t, next, `${arc.code} 4`);
}

// ---------- the crisis (stage 3) ----------

function traitWeight(life: LifeState): number {
  const axes = (life.ext.character as { axes?: Record<string, number> } | undefined)?.axes ?? {};
  return ((axes.kind ?? 0) + (axes.brave ?? 0)) / 400;
}

/** The character's answer to a crisis of his tie: full, small, or none (bn.a1: 40, 35, 25, moved by his nature, by the pair of items and by the god's hand: `bonus`). */
export function crisisAnswer(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie, bonus = 0): 'full' | 'small' | 'refuse' {
  const rng = ctx.rng('bonds.arc');
  let pair = 0;
  if (e.pairs.some((p) => p.tie === t.id && p.status === 'full' && p.code === 'PR-01')) pair = 0.1;
  const help = Math.max(0.1, Math.min(0.95, HELP_BASE + traitWeight(life) + 0.03 * levelOf(ctx, t) + pair + bonus));
  if (!rng.chance(help)) return 'refuse';
  return rng.chance(Math.max(0.05, Math.min(0.95, 0.55 + traitWeight(life) + bonus / 2))) ? 'full' : 'small';
}

/** What the answer does: the gold it costs, the bond and the gratitude it moves (bonds/01 §2.1). */
function answerEffects(ctx: Ctx, life: LifeState, t: Tie, answer: 'full' | 'small' | 'refuse'): void {
  const rng = ctx.rng('bonds.arc');
  if (answer === 'full') {
    const cost = rng.int(HELP.goldMin, HELP.goldMax);
    if (life.gold >= cost) life.gold -= cost;
    changeB(ctx, t, HELP.bGain, 'crisis');
    addGratitude(ctx, t, 1);
  } else if (answer === 'small') {
    changeB(ctx, t, HELP.bSmall, 'asked');
    addGratitude(ctx, t, 1);
  } else if (rng.chance(HELP.refusedKnowsPct)) {
    changeB(ctx, t, HELP.bRefuse, 'refused');
  }
}

/** The god's hand on this tie's crisis, if it is still in force; it is spent by the answer. */
function takeNudge(e: BondsExt, t: Tie, life: LifeState): Nudge | undefined {
  const n = e.nudges[t.id];
  delete e.nudges[t.id];
  return n && n.until >= life.hAge ? n : undefined;
}

/**
 * The crisis of a tie (stage 3). A crisis the player is called for (a card) is announced first: `bonds/crisis` at level 2 names the person, the line and what
 * is happening, and the attention system calls the player on it. The character answers at the next beat (`decideCrises`), so a whisper, a dream or a word of
 * the god can move the answer before it is given (M3 review H5; the same order as the god windows of the story). The rest of the crises are told as trouble
 * and answered at once.
 */
function crisis(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie, arc: ArcState, v: StageView, involved: boolean): void {
  if (!involved) return;
  arc.involved = true;
  e.counts.crises++;
  // a card for the player in a share of them (07-attention.md §2: about 1.5 a life with the bondage escapes); the rest are told as trouble
  const card = rng0(ctx).chance(CRISIS_CARD);
  if (!card) {
    const answer = crisisAnswer(ctx, life, e, t, takeNudge(e, t, life)?.bonus ?? 0);
    arc.helped = answer !== 'refuse';
    write(ctx.state, { sys: 'bonds', kind: 'trouble', id: t.id, data: { name: t.name, line: t.line, code: arc.code, level: levelOf(ctx, t), text: v.text, answer, kin: t.kin ?? null }, level: 1 });
    answerEffects(ctx, life, t, answer);
    return;
  }
  e.counts.cards++;
  const entry = write(ctx.state, { sys: 'bonds', kind: 'crisis', id: t.id, data: { name: t.name, line: t.line, code: arc.code, level: levelOf(ctx, t), text: v.text, kin: t.kin ?? null, tie: t.id, npc: t.npc ?? null, gender: t.gender }, level: 2 });
  e.crises.push({ tie: t.id, n: entry.n, beats: 0, age: life.hAge, code: arc.code, text: v.text });
}

/**
 * Beat hook: the character answers the crises announced to the player, the beat after the announcement once the attention system has called for it (a card
 * that is held for the gap rules keeps the answer waiting, at most CRISIS_MAX_BEATS). The answer is written as `bonds/trouble` at level 1 (`after: true`) with who
 * moved it (`by`: `whisper` `dream` `liar`, or null when the character chose alone). A person who is gone by then has no answer.
 */
export function decideCrises(ctx: Ctx, life: LifeState): void {
  const e = extOf(life);
  if (!e.crises.length) return;
  for (const c of [...e.crises]) {
    const t = e.ties[c.tie];
    c.beats++;
    if (!t || !isLive(t) || !t.arc) {
      e.crises = e.crises.filter((x) => x !== c);
      continue;
    }
    if (c.beats < CRISIS_MAX_BEATS && !answered(ctx.state, c.n)) continue;
    e.crises = e.crises.filter((x) => x !== c);
    const nudge = takeNudge(e, t, life);
    const answer = crisisAnswer(ctx, life, e, t, nudge?.bonus ?? 0);
    t.arc.helped = answer !== 'refuse';
    // told as `trouble` (the text system has it with the answer); `after` marks it as the answer to the `crisis` announced before, whose sentence (`what`) it does not repeat
    write(ctx.state, { sys: 'bonds', kind: 'trouble', id: t.id, data: { name: t.name, line: t.line, code: c.code, level: levelOf(ctx, t), text: '', what: c.text, answer, kin: t.kin ?? null, tie: t.id, by: nudge?.by ?? null, after: true, gender: t.gender }, level: 1 });
    answerEffects(ctx, life, t, answer);
  }
}

/** Nudges that outlived the years they waited for fall away. */
export function expireNudges(e: BondsExt, life: LifeState): void {
  for (const [id, n] of Object.entries(e.nudges)) if (n.until < life.hAge) delete e.nudges[id];
}

// ---------- the ending (stage 5) ----------

/** What an ending does to the person, read from its words (the documents write the effects as prose: 04 §3, 05 §2). */
export function endingKind(label: string): 'dies' | 'leaves' | 'split' | 'betrays' | 'stays' {
  // the words that are about someone else or about a cure, not about the tie going: "พบว่าตายแล้ว" (the one he searched for, FT-02) · "หายด้วยราคาที่แพง" (he is well again, FT-04)
  if (/^(พบว่า|หายด้วย|หายป่วย|หายดี)/.test(label)) return 'stays';
  if (/(ตาย|สิ้น|หลุมศพ)/.test(label) && !/(ไม่ตาย|ตายแทน)/.test(label)) return 'dies';
  if (/(หักหลัง|ศัตรู)/.test(label)) return 'betrays';
  if (/(สายแตก|สายจาง|แตกกัน|ตัดขาด|ไม่ไว้ใจตัวละคร|แยกทาง)/.test(label)) return 'split';
  if (/(ไม่กลับ|หนี|ไปแล้ว|ถูกพราก|ถูกขายต่อ|หาย)/.test(label)) return 'leaves';
  return 'stays';
}

function ending(ctx: Ctx, life: LifeState, e: BondsExt, t: Tie, arc: ArcState): void {
  const ix = bondsIndex(ctx);
  const rng = ctx.rng('bonds.arc');
  const tpl = arc.flag ? undefined : ix.templates.get(arc.code);
  const flag = arc.flag ? ix.arcs.get(arc.code) : undefined;
  const list = (tpl?.endings ?? flag?.endings ?? []) as { key: 'a' | 'b' | 'c'; weight: number; label?: string; text?: string; effects: Effect[]; opensLines?: string[]; templates?: string[] }[];
  if (!list.length) return;
  // the choice at the crisis moves the weights (04 §2: "ตัวเลือกกระทบ B และทางไปปลายทาง")
  const w = list.map((x) => x.weight * (arc.helped ? (x.key === 'a' ? 1.5 : x.key === 'c' ? 0.5 : 1) : arc.involved ? (x.key === 'c' ? 1.5 : x.key === 'a' ? 0.7 : 1) : 1));
  const pick = list[Math.max(0, rng.weighted(w))];
  arc.end = pick.key;
  const label = plain(pick.label ?? pick.text ?? '');
  const kind = endingKind(label);
  const involved = !!arc.involved || levelOf(ctx, t) >= 3;
  write(ctx.state, { sys: 'bonds', kind: 'ending', id: t.id, data: { name: t.name, line: t.line, code: arc.code, key: pick.key, text: label, kind, involved, npc: t.npc ?? null }, level: involved ? 1 : 0 });
  withFocus(e, t, () => {
    if (involved) {
      apply(ctx, pick.effects, { ...SRC, id: arc.code });
      for (const l of pick.opensLines ?? []) openLine(ctx, l);
      for (const c of pick.templates ?? []) if (c.startsWith('PR')) grantPair(ctx, life, t, c);
      changeB(ctx, t, ENDING_B[pick.key], `${arc.code} ${pick.key}`);
    } else {
      e.counts.news++;
    }
  });
  if (kind === 'dies') endTie(ctx, t, 'death', `${arc.code} ${pick.key}`, { cause: 'เรื่องของเขาจบ' });
  else if (kind === 'betrays') endTie(ctx, t, 'betray', `${arc.code} ${pick.key}`);
  else if (kind === 'split') endTie(ctx, t, 'split', `${arc.code} ${pick.key}`, { because: label });
  else if (kind === 'leaves') {
    t.note = 'ไปจากตัวละคร';
    endTie(ctx, t, 'fade', `${arc.code} ${pick.key}`);
  } else if (pick.key === 'a' && involved) {
    changeB(ctx, t, 0, 'goodEnd');
  }
}

/** Is a tie on a story the character takes part in? */
export function onStory(t: Tie): boolean {
  return !!t.arc && !t.arc.end && t.arc.stage < 5;
}
