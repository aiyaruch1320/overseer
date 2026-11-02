// Miracles (god/04-miracles.md): the part every miracle shares. A miracle is checked against the iron rules, the caps of the life and of
// the world, its own wait and the power; it is previewed without a roll; it is paid and either happens at once or after an omen
// (a season ahead for the large and above, `OMEN` in tuning). The miracles themselves are in set.ts (MR-01 to 16, 21, 23, 24) and fate.ts (MR-25);
// a later step adds the rest with `registerMiracle`.
import type { Ctx } from '../../game';
import type { Miracle } from '../../data/types-god';
import type { CountryId } from '../../types';
import { apply } from '../../rules';
import { tablesOf } from '../../world';
import { chronicle, say } from './record';
import { continentOf, godOf, lifeCountry, neighboursOf } from './geo';
import { faithAt } from './mods';
import { addBelief } from '../belief';
import { earn, pay, scaleCost, whyNot, type Cost } from '../power';
import { actsOf, lifeCounters, livingOf, peekCounters, ready, startCooldown, viewActs, yearOf, type Pending } from './state';
import { BELIEF_SEEN, DESTROY_RETURN_DIV, MC_HURT, OMEN, REACTION } from './tuning';

export type Line = 'create' | 'destroy' | 'dragon' | 'fate';

export interface Outcome {
  /** What the hand fell on, for the chronicle (`AL-01` `dragon:รหัส` `npc:AL01-1`). */
  target: string;
  result: string;
  /** The country or continent the miracle fell in, for the reactions of the world. */
  country?: CountryId;
  continent?: string;
  /** The faith reaction of the world when it is not the one of the miracle's line and tier (a large miracle that fell on a seal is answered as a mid one). */
  reaction?: 'createSmall' | 'createMid' | 'destroySmall' | 'destroyMid' | 'destroyBig' | 'none';
  /** Dread the hand gets back when the deed happens, when it is not a third of the price. */
  back?: number;
}

export interface Handler {
  line: Line;
  /** The price before the multipliers, when it is not simply the table's (MR-21 pays all the light, MR-25 by the fate table). */
  cost?(ctx: Ctx, m: Miracle, args: Record<string, unknown>): Cost;
  /** The key of the wait: the miracle's own id unless the wait is per target (a dragon). */
  waitKey?(ctx: Ctx, m: Miracle, args: Record<string, unknown>): string;
  /** Why the miracle cannot fall on this target, or null. Never rolls. */
  check?(ctx: Ctx, m: Miracle, args: Record<string, unknown>): string | null;
  preview?(ctx: Ctx, m: Miracle, args: Record<string, unknown>): Record<string, unknown>;
  run(ctx: Ctx, m: Miracle, args: Record<string, unknown>): Outcome;
  /** The cost is exactly what `cost` says (MR-21 pays all the light, whatever the belief of the character). */
  unscaled?: boolean;
  /** Faith of the countries (04-miracles.md §6) is not moved by the default table. */
  noReaction?: boolean;
  /** Does this miracle make a ruin on this target (a large one that falls on a seal makes none)? Default: the table's `makesRuin`. */
  makesRuin?(ctx: Ctx, m: Miracle, args: Record<string, unknown>): boolean;
  /** The dread that comes back when the deed happens (a large destroying miracle: 20, 04-miracles.md §6); default a third of the price. */
  back?(ctx: Ctx, m: Miracle, args: Record<string, unknown>, cost: Cost): number;
}

/**
 * A layer between the command and the handler: the seals (god/ruin/seal.ts) refuse a miracle on a protected country, answer a destroying one
 * with the effect of a lower tier, and want their own caps. Layers are registered at import time and never stored in the state.
 */
export interface Intercept {
  /** Why the miracle cannot fall here (a country the dragon protects, the cap of the seals). Never rolls. */
  check?(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): string | null;
  /** Answers instead of `h.run` when it returns an outcome (the deed is then paid and written down as for any other). */
  run?(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): Outcome | null;
  /** What the confirm screen shows besides the handler's own preview. */
  preview?(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): Record<string, unknown> | null;
  /** The miracle was paid (a cap or a wait that belongs to the layer starts). */
  spent?(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): void;
  /** Called when the day of the miracle has come and it has happened. */
  after?(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>, out: Outcome): void;
}

const intercepts: Intercept[] = [];

/** Lines a deed wants told after the line of the miracle itself (the fate of the people of a ruin comes after "ดาวตก ที่ซอร์เนบ"), not before it. */
let deferred: (() => void)[] = [];
export function later(fn: () => void): void {
  deferred.push(fn);
}
export function addIntercept(x: Intercept): void {
  if (!intercepts.includes(x)) intercepts.push(x);
}

const handlers = new Map<string, Handler>();

export function registerMiracle(id: string, h: Handler): void {
  handlers.set(id, h);
}
export const handlerOf = (id: string): Handler | undefined => handlers.get(id);
export const implemented = (): string[] => [...handlers.keys()].sort();

export const miracleOf = (ctx: Ctx, id: string): Miracle | undefined => godOf(ctx).miracles.list.find((m) => m.id === id);

/** The id a command names: `id` (MR-01) or `miracle`. */
export const idOf = (args: Record<string, unknown>): string => String(args.id ?? args.miracle ?? '');

/** The country a command names, else the one where the character lives. */
export const countryArg = (ctx: Ctx, args: Record<string, unknown>): CountryId | undefined => (args.country === undefined ? lifeCountry(ctx) : String(args.country));

const tierKey = (m: Miracle): 'small' | 'mid' | 'big' | 'grand' | 'dragon' | 'fate' =>
  m.tier === 'เล็ก' ? 'small' : m.tier === 'กลาง' ? 'mid' : m.tier === 'ใหญ่' ? 'big' : m.tier === 'มหา' ? 'grand' : m.tier === 'มังกร' ? 'dragon' : 'fate';

export const omenQuarters = (m: Miracle): number => {
  const k = tierKey(m);
  return k === 'fate' ? 0 : OMEN[k];
};

/** The price before the multipliers. */
export function baseCost(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): Cost {
  if (h.cost) return h.cost(ctx, m, args);
  return { ...(m.cost.faith ? { faith: m.cost.faith } : {}), ...(m.cost.dread ? { dread: m.cost.dread } : {}) };
}

export const priceNow = (ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): Cost => (h.unscaled ? baseCost(ctx, m, h, args) : scaleCost(ctx, baseCost(ctx, m, h, args)));

// ---------- the caps (04-miracles.md §2 rule 6, 01-power.md §4) ----------

const ruinOf = (ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): boolean => (h.makesRuin ? h.makesRuin(ctx, m, args) : !!m.makesRuin);

function capReason(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): string | null {
  const caps = godOf(ctx).caps.miraclePerLife;
  const lim = godOf(ctx).miracles.limits;
  const c = peekCounters(ctx);
  switch (tierKey(m)) {
    case 'mid':
      if (c.mid >= caps.mid) return `ปาฏิหาริย์ระดับกลางครบ ${caps.mid} ครั้งในชีวิตนี้แล้ว`;
      if (!ready(ctx, 'world.mid')) return `ระดับกลางห่างกันอย่างน้อย ${lim.worldMidGapYears} ปีโลก`;
      return null;
    case 'big':
      if (c.big >= caps.big) return `ปาฏิหาริย์ระดับใหญ่ครบ ${caps.big} ครั้งในชีวิตนี้แล้ว`;
      if (ruinOf(ctx, m, h, args) && c.ruin >= caps.ruinOfBig) return 'ปาฏิหาริย์ที่ทำให้เป็นซากใช้ได้ชีวิตละครั้ง';
      if (ruinOf(ctx, m, h, args) && !ready(ctx, 'world.ruin')) return `ซากพระเจ้าห่างกันอย่างน้อย ${lim.ruinGapYears} ปีโลก`;
      if (!ready(ctx, 'world.big')) return `ระดับใหญ่ห่างกันอย่างน้อย ${lim.worldBigGapYears} ปีโลก`;
      return null;
    case 'grand':
      return c.grand >= caps.grand ? 'ปาฏิหาริย์ระดับมหาใช้ได้ครั้งเดียวต่อชีวิต' : null;
  }
  return null;
}

function spendCaps(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): void {
  const lim = godOf(ctx).miracles.limits;
  const c = lifeCounters(ctx);
  switch (tierKey(m)) {
    case 'mid':
      c.mid++;
      startCooldown(ctx, 'world.mid', lim.worldMidGapYears);
      break;
    case 'big':
      c.big++;
      startCooldown(ctx, 'world.big', lim.worldBigGapYears);
      if (ruinOf(ctx, m, h, args)) {
        c.ruin++;
        startCooldown(ctx, 'world.ruin', lim.ruinGapYears);
      }
      break;
    case 'grand':
      c.grand++;
      break;
  }
}

// ---------- check · preview · run ----------

/** Why the command cannot be taken now, or null. Never rolls, never changes the state. */
export function checkMiracle(ctx: Ctx, args: Record<string, unknown>): string | null {
  if (!livingOf(ctx)) return 'ไม่มีตัวละครที่มีชีวิต';
  if (args.cancel !== undefined) return viewActs(ctx.state).pending.some((p) => p.n === Number(args.cancel)) ? null : 'ไม่มีลางนั้น';
  const id = idOf(args);
  const m = miracleOf(ctx, id);
  if (!m) return `ไม่มีปาฏิหาริย์ ${id || '(ไม่ระบุ)'}`;
  const h = handlers.get(id);
  if (!h) return `${id} ${m.name} ยังไม่เปิดใช้`;
  const cap = capReason(ctx, m, h, args);
  if (cap) return cap;
  const wk = h.waitKey ? h.waitKey(ctx, m, args) : id;
  if (m.wait && !ready(ctx, wk)) return `${m.name} ต้องรออีก ${Math.ceil((ctx.state.god.cooldowns[wk] ?? 0) - yearOf(ctx))} ปีโลก`;
  for (const x of intercepts) {
    const no = x.check?.(ctx, m, h, args);
    if (no) return no;
  }
  const why = h.check?.(ctx, m, args);
  if (why) return why;
  return whyNot(ctx, priceNow(ctx, m, h, args));
}

/** What the confirm screen shows: the price, the day, what falls and what it changes. */
export function previewMiracle(ctx: Ctx, args: Record<string, unknown>): Record<string, unknown> {
  if (args.cancel !== undefined) {
    const p = viewActs(ctx.state).pending.find((x) => x.n === Number(args.cancel))!;
    const m = miracleOf(ctx, p.id);
    // cancelling gives back half of the power only: the right the miracle used (a cap of the life) and its wait stay spent (M2 review M3)
    const warn: string[] = [];
    if (m) {
      const tier = tierKey(m);
      if (tier === 'grand') warn.push('ใช้สิทธิ์ปาฏิหาริย์ระดับมหาของชีวิตนี้ไปแล้ว ยกเลิกก็ไม่คืน จะใช้อีกไม่ได้');
      else if (tier === 'big') warn.push('นับเป็นปาฏิหาริย์ระดับใหญ่ครั้งหนึ่งของชีวิตนี้ไปแล้ว ยกเลิกก็ไม่คืน');
      else if (tier === 'mid') warn.push('นับเป็นปาฏิหาริย์ระดับกลางครั้งหนึ่งของชีวิตนี้ไปแล้ว ยกเลิกก็ไม่คืน');
      if (m.wait) warn.push(`ระยะรอ ${m.wait} ปีโลกยังเดินต่อ`);
    }
    return { cancel: p.n, id: p.id, refund: { faith: Math.floor(p.paid.faith * OMEN.refund), dread: Math.floor(p.paid.dread * OMEN.refund) }, ...(warn.length ? { warn, spent: true } : {}) };
  }
  const id = idOf(args);
  const m = miracleOf(ctx, id)!;
  const h = handlers.get(id)!;
  const caps = godOf(ctx).caps.miraclePerLife;
  const c = peekCounters(ctx);
  const cost = priceNow(ctx, m, h, args);
  // the blood and the dragon's provoking give back a third of the dread when they happen (01-power.md §1): the price shown is what is paid, `back` what returns
  const sealed = intercepts.map((x) => x.preview?.(ctx, m, h, args)).filter((x): x is Record<string, unknown> => !!x);
  const sealedBack = sealed.some((x) => x.sealBack === true) ? Math.round((cost.dread ?? 0) / DESTROY_RETURN_DIV) : undefined;
  const back = sealedBack ?? (h.back ? h.back(ctx, m, args, cost) : h.line === 'destroy' || (h.line === 'dragon' && m.cost.dread) ? Math.round((cost.dread ?? 0) / DESTROY_RETURN_DIV) : 0);
  return {
    id,
    name: m.name,
    tier: m.tier,
    line: h.line,
    cost,
    ...(back > 0 ? { back: { dread: back }, net: { ...cost, dread: (cost.dread ?? 0) - back } } : {}),
    omen: omenQuarters(m),
    wait: m.wait,
    immediate: m.immediate,
    world: m.world,
    left: { mid: caps.mid - c.mid, big: caps.big - c.big, grand: caps.grand - c.grand },
    ...(h.preview?.(ctx, m, args) ?? {}),
    ...sealed.reduce((a, x) => ({ ...a, ...x, ...(Array.isArray(x.notes) ? { notes: [...(Array.isArray(a.notes) ? a.notes : []), ...x.notes] } : {}) }), {} as Record<string, unknown>),
  };
}

/** Pays and acts. The omen of a large miracle is a pending entry that happens `OMEN` beats later (`miracleBeat`). */
export function runMiracle(ctx: Ctx, args: Record<string, unknown>): void {
  const a = actsOf(ctx.state);
  if (args.cancel !== undefined) {
    const p = a.pending.find((x) => x.n === Number(args.cancel))!;
    a.pending = a.pending.filter((x) => x !== p);
    earn(ctx, { faith: Math.floor(p.paid.faith * OMEN.refund), dread: Math.floor(p.paid.dread * OMEN.refund) }, 'miracle.cancel');
    say(ctx, { kind: 'miracle.cancel', id: p.id, data: { n: p.n }, level: 1 });
    chronicle(ctx, { kind: 'miracle.cancel', id: p.id });
    return;
  }
  const id = idOf(args);
  const m = miracleOf(ctx, id)!;
  const h = handlers.get(id)!;
  const cost = priceNow(ctx, m, h, args);
  pay(ctx, cost, `miracle:${id}`);
  spendCaps(ctx, m, h, args);
  for (const x of intercepts) x.spent?.(ctx, m, h, args);
  if (m.wait) startCooldown(ctx, h.waitKey ? h.waitKey(ctx, m, args) : id, m.wait);
  const paid = { faith: cost.faith ?? 0, dread: cost.dread ?? 0 };
  const quarters = omenQuarters(m);
  if (quarters > 0) {
    const p: Pending = { n: ++a.pendingN, id, args: { ...args }, left: quarters, paid, year: yearOf(ctx) };
    a.pending.push(p);
    say(ctx, { kind: 'miracle.omen', id, data: { n: p.n, name: m.name, quarters }, level: 2 });
    chronicle(ctx, { kind: 'miracle.omen', id, target: String(args.country ?? args.continent ?? '') });
    return;
  }
  happen(ctx, m, h, args, paid);
}

/** The day of the miracle: the world changes, the reactions follow, the hand is written down. */
function happen(ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>, paid: { faith: number; dread: number }): void {
  deferred = [];
  let out: Outcome | null = null;
  for (const x of intercepts) {
    out = x.run?.(ctx, m, h, args) ?? null;
    if (out) break;
  }
  out ??= h.run(ctx, m, args);
  if (!h.noReaction) react(ctx, m, h, out, paid);
  for (const x of intercepts) x.after?.(ctx, m, h, args, out);
  // the dragon is named by its place in the table; the countries, continents, NPCs and events are named by the text layer from their codes
  const dragon = /^dragon:(\d+)$/.exec(out.target);
  const where = dragon ? tablesOf(ctx).dragons[Number(dragon[1])]?.name ?? '' : '';
  say(ctx, { kind: 'miracle', id: m.id, data: { name: m.name, target: out.target, result: out.result, tier: m.tier, ...(where ? { where } : {}) }, level: tierKey(m) === 'small' ? 1 : 2 });
  chronicle(ctx, { kind: 'miracle', id: m.id, target: out.target, result: out.result });
  const told = deferred;
  deferred = [];
  for (const fn of told) fn();
}

/** Each beat: the omens come due. */
export function miracleBeat(ctx: Ctx): void {
  const a = actsOf(ctx.state);
  if (!a.pending.length) return;
  for (const p of [...a.pending]) {
    p.left -= 1;
    if (p.left > 0) continue;
    a.pending = a.pending.filter((x) => x !== p);
    const m = miracleOf(ctx, p.id);
    const h = handlers.get(p.id);
    if (m && h) happen(ctx, m, h, p.args, p.paid);
  }
}

// ---------- the world answers (04-miracles.md §6) ----------

function react(ctx: Ctx, m: Miracle, h: Handler, out: Outcome, paid: { faith: number; dread: number }): void {
  const small = m.tier === 'เล็ก';
  const big = m.tier === 'ใหญ่' && h.line === 'destroy';
  const key = out.reaction === 'none' ? undefined : out.reaction ?? (h.line === 'create' ? (small ? 'createSmall' : 'createMid') : h.line === 'destroy' ? (small ? 'destroySmall' : big ? 'destroyBig' : 'destroyMid') : undefined);
  const life = livingOf(ctx);
  if (key && out.country) {
    let [self, near] = REACTION[key];
    const given = m.faithDelta.find((f) => f.scope === 'country');
    if (given) self = given.delta;
    faithAt(ctx, out.country, self);
    if (near) for (const n of neighboursOf(ctx, out.country)) faithAt(ctx, n, near);
  }
  if (h.line === 'destroy' || (h.line === 'dragon' && m.cost.dread)) earn(ctx, { dread: out.back ?? Math.round(paid.dread / DESTROY_RETURN_DIV) }, 'miracle.return');
  // the character who stands where it fell sees it
  if (life && h.line !== 'dragon' && ((out.country && out.country === life.country) || (out.continent && out.continent === continentOf(life.country)))) {
    addBelief(ctx, h.line === 'create' ? BELIEF_SEEN.create : BELIEF_SEEN.destroy, 'miracle.seen');
    // iron rule 1: he is never killed, he may be hurt
    if (h.line === 'destroy' && ctx.rng('god.miracle').chance(MC_HURT)) apply(ctx, [{ k: 'wound' }], { sys: 'god', id: m.id, stream: 'god.miracle' });
  }
}

