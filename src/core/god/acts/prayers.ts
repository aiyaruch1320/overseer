// Prayers (god/03-dreams.md §7): the maker that raises one at some beats, the five answers, the lapse. The 17 kinds, their weights,
// conditions' words, prices and effects are in data/gen/god.json `prayers`; the conditions themselves are written here, one per kind.
import { classNum, extOf as characterExt, idx, tagsOf } from '../../character';
import type { Ctx } from '../../game';
import { inDeathScene, prayersWaiting } from '../../attention';
import { MAX_WAITING_PRAYERS } from '../../attention/tuning';
import { detached } from '../../rng';
import { apply, readStat } from '../../rules';
import type { LifeState } from '../../types';
import { applyFx } from './fx';
import { chronicle, say } from './record';
import { dangerous, godOf, hasFlag, stageOf } from './geo';
import { aliveNpc, nameOf, nemeses, sickInCircle } from './npcs';
import { addBelief } from '../belief';
import { blessingPool, drawBlessing } from '../chest';
import { syncFlags } from '../stats';
import { canPay, earn, noteAnswered, notePunished, pay, scaleCost, whyNot } from '../power';
import { touch } from '../state';
import { actsOf, livingOf, tickOf, viewActs, yearOf, type PrayerCard } from './state';
import { WEALTH_MAX_CLASS } from './tuning';

type Kind = ReturnType<typeof godOf>['prayers']['kinds'][number];

export const cardsOf = (ctx: Ctx): PrayerCard[] => ctx.state.god.prayers as PrayerCard[];

export const kindOf = (ctx: Ctx, id: string): Kind | undefined => godOf(ctx).prayers.kinds.find((k) => k.id === id);

/** The Thai name of a kind, from the table of 03-dreams.md §7.1 (the data file keeps the table in `raw`). */
export function nameOfKind(ctx: Ctx, id: string): string {
  const t = godOf(ctx).raw.find((r) => r.header[0] === 'รหัส' && r.header[1] === 'ชื่อ' && r.src.includes('03-dreams'));
  return t?.rows.find((r) => r[0] === id)?.[1] ?? id;
}

// ---------- conditions of the 17 kinds (03-dreams.md §7.1 "เกิดเมื่อ") ----------

/** Partner and children, as the bonds system (M3) will keep them in `life.ext.bonds`; before it nobody has either. */
function family(life: LifeState): { partner: boolean; children: number } {
  const b = life.ext.bonds as { partner?: unknown; spouse?: unknown; children?: unknown } | undefined;
  const kids = Array.isArray(b?.children) ? b.children.length : Number(b?.children ?? 0) || (life.flags.includes('god_child') ? 1 : 0);
  return { partner: !!(b?.partner || b?.spouse), children: kids };
}

const FARM_JOBS = ['farmer', 'merchant', 'fisher', 'shepherd', 'innkeeper'];

/** Does the prayer kind fit the character and the place now? Never rolls. */
export function holdsKind(ctx: Ctx, id: string): boolean {
  const life = livingOf(ctx);
  if (!life) return false;
  const stage = stageOf(life.hAge);
  const c = life.country;
  const fam = family(life);
  switch (id) {
    case 'heal': return life.flags.includes('wounded');
    case 'rain': return hasFlag(ctx, c, 'famine', 'sandstorm');
    case 'plague': return hasFlag(ctx, c, 'plague', 'undead_rising');
    case 'peace': return hasFlag(ctx, c, 'war', 'demon_raid', 'horde');
    case 'love': return stage === 'adult' && !fam.partner;
    case 'heir': return fam.partner && fam.children === 0 && life.hAge < 50;
    case 'wealth': return stage === 'adult' && life.gold < 25 && classNum(life) <= WEALTH_MAX_CLASS;
    case 'wisdom': return stage === 'teen';
    case 'courage': return stage !== 'infant' && stage !== 'child' && dangerous(ctx, c);
    case 'vengeance': return nemeses(ctx).length > 0;
    case 'uncurse': return life.curses.length > 0;
    case 'fame': return stage === 'adult' && (readStat(ctx, 'ambition') ?? 0) > 20;
    case 'harvest': return !!life.job && FARM_JOBS.includes(life.job);
    case 'grandchild': return stage === 'elder' && fam.children > 0;
    case 'challenge': return life.godFaith < -10 && stage !== 'infant';
    case 'kin_sick': return sickInCircle(ctx).length > 0;
    case 'mother': return stage === 'infant' || stage === 'child';
  }
  return false;
}

/**
 * Why a waiting card does not matter any more, or null: the one who asked is dead, or the matter he asked about is not true now (the noble does not ask to
 * be rid of poverty, the curse that was lifted is not asked about again). Checked when a prayer is raised (`holdsKind`), every beat, and when it is answered.
 */
export function mootReason(ctx: Ctx, card: PrayerCard): string | null {
  if (!livingOf(ctx)) return 'ไม่มีตัวละครที่มีชีวิต';
  if (card.npc && !aliveNpc(ctx, card.npc)) return 'ผู้ขอตายไปแล้ว';
  if (!holdsKind(ctx, card.kind)) return 'เรื่องที่ขอไม่เป็นจริงแล้ว';
  if (card.kind === 'kin_sick' && card.npc && !sickInCircle(ctx).includes(card.npc)) return 'คนที่ขอไม่ได้ป่วยหนักแล้ว';
  if (card.kind === 'vengeance' && card.npc && !nemeses(ctx).includes(card.npc)) return 'ความแค้นหมดไปแล้ว';
  return null;
}

/** Kinds that may be raised now: the condition holds and the kind has not come in the last 24 ticks. */
export function raisable(ctx: Ctx): Kind[] {
  const a = viewActs(ctx.state);
  const t = godOf(ctx).prayers.tick;
  const tick = tickOf(ctx);
  return godOf(ctx).prayers.kinds.filter((k) => (a.recent[k.id] ?? -99) + t.repeatCooldownTicks <= tick && holdsKind(ctx, k.id));
}

/** Chance that a prayer is raised at this beat (03-dreams.md §7.2). */
export function raiseChance(ctx: Ctx, pool: readonly Kind[]): number {
  const life = livingOf(ctx);
  if (!life) return 0;
  const t = godOf(ctx).prayers.tick;
  const piety = readStat(ctx, 'piety') ?? 0;
  let p = t.base + Math.max(0, piety) / t.pietyDiv + (tagsOf(ctx, life).has('oracle') ? t.oracle : 0);
  if (pool.some((k) => k.trouble)) p *= t.troubleMul;
  return p;
}

// ---------- the beat: lapse and raise ----------

/** One beat of the prayers: cards past their time lapse (belief −2), then a new one may be raised. */
export function prayerBeat(ctx: Ctx): void {
  const life = livingOf(ctx);
  if (!life) return;
  const g = godOf(ctx);
  const a = actsOf(ctx.state);
  const tick = tickOf(ctx);
  const cards = cardsOf(ctx);
  for (const card of [...cards]) {
    // a prayer that does not matter any more is taken back without a word against the god: the matter passed, he was not ignored
    const moot = mootReason(ctx, card);
    if (moot) {
      cards.splice(cards.indexOf(card), 1);
      forget(a, card.n, 'moot');
      // told in the log only: taking a prayer back is no deed of the hand (the chronicle keeps what the god did and what he left unanswered)
      say(ctx, { kind: 'prayer.moot', id: card.kind, data: { n: card.n, kind: card.kind, name: nameOfKind(ctx, card.kind), why: moot }, level: 1 });
      continue;
    }
    if (card.exp > tick) continue;
    cards.splice(cards.indexOf(card), 1);
    forget(a, card.n, 'lapsed');
    addBelief(ctx, g.belief.prayer.ignore, 'prayer.lapse');
    a.lapsed.push(yearOf(ctx));
    if (a.lapsed.length > 24) a.lapsed.shift();
    say(ctx, { kind: 'prayer.lapse', id: card.kind, data: { n: card.n, kind: card.kind, name: nameOfKind(ctx, card.kind) }, level: 1 });
    chronicle(ctx, { kind: 'prayer.lapse', id: card.kind, result: 'silent' });
    syncFlags(ctx);
  }
  const t = g.prayers.tick;
  // the attention system holds two prayers at most (07-attention.md §3): the third is not raised, it would be dropped unseen
  // from the scene before the end no prayer is raised: the player is called once more at the most, and a card raised later could not be shown (07-attention.md §2)
  if (cards.length >= t.maxPending || prayersWaiting(ctx.state) >= MAX_WAITING_PRAYERS || life.godFaith < t.silentBelow || inDeathScene(ctx.state)) return;
  const pool = raisable(ctx);
  const rng = ctx.rng('god.prayer');
  if (!pool.length || !rng.chance(raiseChance(ctx, pool))) return;
  const kind = pool[rng.weighted(pool.map((k) => k.weight))];
  let npc: string | undefined;
  if (kind.id === 'kin_sick') npc = rng.pick(sickInCircle(ctx));
  else if (kind.id === 'vengeance') npc = rng.pick(nemeses(ctx));
  a.recent[kind.id] = tick;
  // the words of a prayer differ from the one that came just before it: the log tells how many of this kind there were and what the last one was
  const seen = a.seen.filter((k) => k === kind.id).length;
  const prev = a.seen.at(-1);
  a.seen.push(kind.id);
  const card: PrayerCard = { n: ++a.prayerN, kind: kind.id, tick, exp: tick + t.expiryTicks, ...(npc ? { npc } : {}), year: yearOf(ctx), seen, ...(prev ? { prev } : {}) };
  cards.push(card);
  say(ctx, {
    kind: 'prayer',
    id: kind.id,
    data: { n: card.n, kind: kind.id, name: nameOfKind(ctx, kind.id), cost: grantPrice(ctx, kind), expires: t.expiryTicks, seen, ...(prev ? { prev, again: prev === kind.id } : {}), ...(npc ? { npc, npcName: nameOf(ctx, npc) } : {}) },
    level: 2,
  });
}

/** Remembers what became of a prayer that is not waiting any more (the last 40), so an answer to it can say why it is gone. */
function forget(a: ReturnType<typeof actsOf>, n: number, how: 'lapsed' | 'moot' | 'answered'): void {
  a.gone[String(n)] = how;
  const keys = Object.keys(a.gone);
  for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete a.gone[k];
}

// ---------- answering ----------

export type Answer = 'give' | 'strange' | 'deny' | 'punish' | 'silent';
const WORDS: Record<string, Answer> = {
  give: 'give', grant: 'give', ให้: 'give',
  strange: 'strange', แปลก: 'strange', 'ให้แบบแปลก': 'strange',
  deny: 'deny', ปฏิเสธ: 'deny',
  punish: 'punish', ลงโทษ: 'punish', 'ลงโทษผู้ขอ': 'punish',
  silent: 'silent', ignore: 'silent', นิ่ง: 'silent',
};
export const answerOf = (v: unknown): Answer | undefined => WORDS[String(v)];

export const grantPrice = (ctx: Ctx, kind: Kind): number => scaleCost(ctx, { faith: kind.grantCost }).faith ?? 0;

const cardOf = (ctx: Ctx, args: Record<string, unknown>): PrayerCard | undefined => cardsOf(ctx).find((c) => c.n === Number(args.id));

// the gift of a strange answer: three small blessings that help the same matter (03-dreams.md §7 "ให้แบบแปลก")
const THEME: Record<string, string[]> = {
  heal: ['vit', 'pow'], rain: ['luk'], plague: ['vit'], peace: ['kind', 'social'], love: ['social', 'luk'], heir: ['vit'], wealth: ['luk', 'gold'],
  wisdom: ['int', 'mag'], courage: ['brave', 'pow'], vengeance: ['pow', 'spd'], uncurse: ['luk'], fame: ['social', 'luk'], harvest: ['luk', 'gold'],
  grandchild: ['vit'], challenge: ['luk'], kin_sick: ['kind'], mother: ['vit'],
};

/**
 * The three gifts offered for a strange answer; the same three every time the same card is looked at. They come from the pool of the chest
 * (`blessingPool`: the same filter) and are drawn by the odds of its tiers, so a small prayer does not buy a rare blessing at its small price. The
 * ones that help the same matter (the stats of the kind) come first.
 */
export function strangeOptions(ctx: Ctx, card: PrayerCard): { id: string; name: string; tier: string }[] {
  const life = livingOf(ctx);
  if (!life) return [];
  const theme = THEME[card.kind] ?? [];
  const all = blessingPool(ctx);
  const ix = idx(ctx);
  const fits = all.filter((b) => (ix.gifts.get(b.id)?.fx ?? []).some((e) => e.k === 'stat' && theme.includes(e.stat)));
  const rng = detached(ctx.state.seed ^ Math.imul(card.n + 1, 2654435761));
  const out: { id: string; name: string; tier: string }[] = [];
  for (const pool of [fits, all]) {
    let left = pool.filter((b) => !out.some((o) => o.id === b.id));
    while (out.length < 3 && left.length) {
      const g = drawBlessing(ctx, rng, left);
      if (!g) break;
      out.push({ id: g.id, name: g.name, tier: g.tier });
      left = left.filter((b) => b.id !== g.id);
    }
  }
  return out;
}

export function checkAnswer(ctx: Ctx, args: Record<string, unknown>): string | null {
  const life = livingOf(ctx);
  if (!life) return 'ไม่มีตัวละครที่มีชีวิต';
  const card = cardOf(ctx, args);
  if (!card) {
    const how = viewActs(ctx.state).gone[String(Number(args.id))];
    return how === 'lapsed' ? 'คำอธิษฐานใบนั้นหมดเวลาไปแล้ว' : how === 'moot' ? 'คำอธิษฐานใบนั้นเลิกมีความหมายไปแล้ว' : how === 'answered' ? 'ตอบคำอธิษฐานใบนั้นไปแล้ว' : 'ไม่มีคำอธิษฐานใบนั้น';
  }
  // the beat takes the card away at the tick it runs out; until the next beat runs it must not be answerable
  if (card.exp <= tickOf(ctx)) return 'คำอธิษฐานใบนั้นหมดเวลาแล้ว';
  const moot = mootReason(ctx, card);
  if (moot) return `คำอธิษฐานใบนั้นไม่ต้องตอบแล้ว: ${moot}`;
  const ans = answerOf(args.answer);
  if (!ans) return 'คำตอบต้องเป็น ให้ ให้แบบแปลก ปฏิเสธ ลงโทษ หรือนิ่ง';
  const kind = kindOf(ctx, card.kind)!;
  if (ans === 'give' || ans === 'strange') {
    const why = whyNot(ctx, { faith: grantPrice(ctx, kind) });
    if (why) return why;
  }
  if (ans === 'strange') {
    const opts = strangeOptions(ctx, card);
    const pick = Number(args.option);
    if (!opts.length) return 'ไม่มีของให้เลือก';
    if (!Number.isInteger(pick) || pick < 0 || pick >= opts.length) return 'ต้องเลือกของหนึ่งใน 3 ใบ (option 0 ถึง 2)';
  }
  if (ans === 'silent' && card.silent) return 'นิ่งไปแล้ว';
  return null;
}

/** What the confirm screen shows. Rolls nothing. */
export function previewAnswer(ctx: Ctx, args: Record<string, unknown>): Record<string, unknown> {
  const card = cardOf(ctx, args)!;
  const kind = kindOf(ctx, card.kind)!;
  const g = godOf(ctx);
  const ans = answerOf(args.answer)!;
  const devout = (readStat(ctx, 'piety') ?? 0) > 30;
  const base = { prayer: card.n, kind: card.kind, name: nameOfKind(ctx, card.kind), answer: ans };
  switch (ans) {
    case 'give':
      return { ...base, cost: { faith: grantPrice(ctx, kind) }, effect: kind.grantFx, belief: Math.round(g.belief.prayer.grant * (devout ? g.belief.prayer.devoutMul : 1)), light: g.income.prayerGrant };
    case 'strange':
      return { ...base, cost: { faith: grantPrice(ctx, kind) }, options: strangeOptions(ctx, card), belief: 5 };
    case 'deny':
      return { ...base, cost: {}, belief: devout ? -1 : g.belief.prayer.deny };
    case 'punish':
      return { ...base, cost: {}, effect: kind.punishFx, dread: kind.punishGain, belief: g.belief.prayer.punish };
    default:
      return { ...base, cost: {}, belief: g.belief.prayer.ignore, note: 'หมดเวลาแล้วศรัทธาเทพ −2' };
  }
}

function settle(ctx: Ctx, card: PrayerCard): void {
  touch(ctx); // an answer is a deed of the god: the feelings of the character do not fade this year
  const cards = cardsOf(ctx);
  cards.splice(cards.indexOf(card), 1);
  const a = actsOf(ctx.state);
  a.lastAnswer = yearOf(ctx);
  forget(a, card.n, 'answered');
  syncFlags(ctx);
}

/** Answers a prayer. */
export function runAnswer(ctx: Ctx, args: Record<string, unknown>): void {
  const life = livingOf(ctx)!;
  const card = cardOf(ctx, args)!;
  const kind = kindOf(ctx, card.kind)!;
  const g = godOf(ctx);
  const ans = answerOf(args.answer)!;
  const devout = (readStat(ctx, 'piety') ?? 0) > 30;
  const who = { npc: card.npc };
  const name = nameOfKind(ctx, card.kind);
  if (ans === 'silent') {
    card.silent = true;
    say(ctx, { kind: 'prayer.silent', id: card.kind, data: { n: card.n, name }, level: 1 });
    return;
  }
  if (ans === 'give' || ans === 'strange') {
    const price = grantPrice(ctx, kind);
    pay(ctx, { faith: price }, `prayer:${card.kind}`);
    let notes: string[] = [];
    let gift: string | undefined;
    if (ans === 'give') {
      notes = applyFx(ctx, kind.grantFx, who);
      addBelief(ctx, Math.round(g.belief.prayer.grant * (devout ? g.belief.prayer.devoutMul : 1)), 'prayer.give');
    } else {
      gift = strangeOptions(ctx, card)[Number(args.option)].id;
      apply(ctx, [{ k: 'grant', kind: 'blessing', id: gift }], { sys: 'god', id: 'prayer', stream: 'god.acts' });
      addBelief(ctx, 5, 'prayer.strange');
      if (!life.flags.includes('god_gift_event')) life.flags.push('god_gift_event'); // the small event that follows (03-dreams.md §7)
    }
    earn(ctx, { faith: g.income.prayerGrant }, 'prayer.give');
    noteAnswered(ctx); // counts toward the end of GD-05 (01-power.md §1)
    settle(ctx, card);
    say(ctx, { kind: 'prayer.give', id: card.kind, data: { n: card.n, name, price, fx: notes.join(' '), ...(gift ? { gift } : {}), ...(card.npc ? { npc: card.npc } : {}) }, level: 2 });
    chronicle(ctx, { kind: ans === 'give' ? 'prayer.give' : 'prayer.strange', id: card.kind, target: card.npc, result: gift ?? notes.join(' ') });
    return;
  }
  if (ans === 'deny') {
    addBelief(ctx, devout ? -1 : g.belief.prayer.deny, 'prayer.deny');
    settle(ctx, card);
    say(ctx, { kind: 'prayer.deny', id: card.kind, data: { n: card.n, name }, level: 1 });
    chronicle(ctx, { kind: 'prayer.deny', id: card.kind, target: card.npc });
    return;
  }
  // punish
  earn(ctx, { dread: kind.punishGain }, 'prayer.punish');
  const notes = applyFx(ctx, kind.punishFx, who);
  addBelief(ctx, g.belief.prayer.punish, 'prayer.punish');
  notePunished(ctx); // dreams and whispers are heard less for five years
  if (!life.flags.includes('god_wronged')) life.flags.push('god_wronged'); // counted as one the god wronged (the path of the god-slayer)
  settle(ctx, card);
  say(ctx, { kind: 'prayer.punish', id: card.kind, data: { n: card.n, name, dread: kind.punishGain, fx: notes.join(' ') }, level: 2 });
  chronicle(ctx, { kind: 'prayer.punish', id: card.kind, target: card.npc, result: notes.join(' ') });
}

// the price the power check of the command reads (a pure helper for the screens)
export function canGive(ctx: Ctx, card: PrayerCard): boolean {
  const kind = kindOf(ctx, card.kind);
  return !!kind && canPay(ctx, { faith: grantPrice(ctx, kind) });
}

/** Test and tool helper: the character system's extension, so a test can read wounds. */
export const woundsOf = (life: LifeState): number => characterExt(life).wounds;
