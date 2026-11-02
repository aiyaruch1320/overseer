// Miracles (god/04-miracles.md): the part every miracle shares. A miracle is checked against the iron rules, the caps of the life and of
// the world, its own wait and the power; it is previewed without a roll; it is paid and either happens at once or after an omen
// (a season ahead for the large and above, `OMEN` in tuning). The miracles themselves are in set.ts (MR-01 to 16, 21, 23, 24) and fate.ts (MR-25);
// a later step adds the rest with `registerMiracle`.
import type { Ctx } from '../../game';
import type { Miracle } from '../../data/types-god';
import type { CountryId } from '../../types';
import { apply } from '../../rules';
import { chronicle, say } from './record';
import { continentOf, godOf, lifeCountry, neighboursOf } from './geo';
import { faithAt } from './mods';
import { belief, gain, pay, priceOf, whyNot, type Cost } from './pay';
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

export const priceNow = (ctx: Ctx, m: Miracle, h: Handler, args: Record<string, unknown>): Cost => (h.unscaled ? baseCost(ctx, m, h, args) : priceOf(ctx, baseCost(ctx, m, h, args)));

// ---------- the caps (04-miracles.md §2 rule 6, 01-power.md §4) ----------

function capReason(ctx: Ctx, m: Miracle): string | null {
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
      if (m.makesRuin && c.ruin >= caps.ruinOfBig) return 'ปาฏิหาริย์ที่ทำให้เป็นซากใช้ได้ชีวิตละครั้ง';
      if (m.makesRuin && !ready(ctx, 'world.ruin')) return `ซากพระเจ้าห่างกันอย่างน้อย ${lim.ruinGapYears} ปีโลก`;
      if (!ready(ctx, 'world.big')) return `ระดับใหญ่ห่างกันอย่างน้อย ${lim.worldBigGapYears} ปีโลก`;
      return null;
    case 'grand':
      return c.grand >= caps.grand ? 'ปาฏิหาริย์ระดับมหาใช้ได้ครั้งเดียวต่อชีวิต' : null;
  }
  return null;
}

function spendCaps(ctx: Ctx, m: Miracle): void {
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
      if (m.makesRuin) {
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
  const cap = capReason(ctx, m);
  if (cap) return cap;
  const wk = h.waitKey ? h.waitKey(ctx, m, args) : id;
  if (m.wait && !ready(ctx, wk)) return `${m.name} ต้องรออีก ${Math.ceil((ctx.state.god.cooldowns[wk] ?? 0) - yearOf(ctx))} ปีโลก`;
  const why = h.check?.(ctx, m, args);
  if (why) return why;
  return whyNot(ctx, priceNow(ctx, m, h, args));
}

/** What the confirm screen shows: the price, the day, what falls and what it changes. */
export function previewMiracle(ctx: Ctx, args: Record<string, unknown>): Record<string, unknown> {
  if (args.cancel !== undefined) {
    const p = viewActs(ctx.state).pending.find((x) => x.n === Number(args.cancel))!;
    return { cancel: p.n, id: p.id, refund: { faith: Math.floor(p.paid.faith * OMEN.refund), dread: Math.floor(p.paid.dread * OMEN.refund) } };
  }
  const id = idOf(args);
  const m = miracleOf(ctx, id)!;
  const h = handlers.get(id)!;
  const caps = godOf(ctx).caps.miraclePerLife;
  const c = peekCounters(ctx);
  return {
    id,
    name: m.name,
    tier: m.tier,
    line: h.line,
    cost: priceNow(ctx, m, h, args),
    omen: omenQuarters(m),
    wait: m.wait,
    immediate: m.immediate,
    world: m.world,
    left: { mid: caps.mid - c.mid, big: caps.big - c.big, grand: caps.grand - c.grand },
    ...(h.preview?.(ctx, m, args) ?? {}),
  };
}

/** Pays and acts. The omen of a large miracle is a pending entry that happens `OMEN` beats later (`miracleBeat`). */
export function runMiracle(ctx: Ctx, args: Record<string, unknown>): void {
  const a = actsOf(ctx.state);
  if (args.cancel !== undefined) {
    const p = a.pending.find((x) => x.n === Number(args.cancel))!;
    a.pending = a.pending.filter((x) => x !== p);
    gain(ctx, 'faith', Math.floor(p.paid.faith * OMEN.refund));
    gain(ctx, 'dread', Math.floor(p.paid.dread * OMEN.refund));
    say(ctx, { kind: 'miracle.cancel', id: p.id, data: { n: p.n }, level: 1 });
    chronicle(ctx, { kind: 'miracle.cancel', id: p.id });
    return;
  }
  const id = idOf(args);
  const m = miracleOf(ctx, id)!;
  const h = handlers.get(id)!;
  const cost = priceNow(ctx, m, h, args);
  pay(ctx, cost);
  spendCaps(ctx, m);
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
  const out = h.run(ctx, m, args);
  if (!h.noReaction) react(ctx, m, h, out, paid);
  say(ctx, { kind: 'miracle', id: m.id, data: { name: m.name, target: out.target, result: out.result, tier: m.tier }, level: tierKey(m) === 'small' ? 1 : 2 });
  chronicle(ctx, { kind: 'miracle', id: m.id, target: out.target, result: out.result });
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
  const key = h.line === 'create' ? (small ? 'createSmall' : 'createMid') : h.line === 'destroy' ? (small ? 'destroySmall' : 'destroyMid') : undefined;
  const life = livingOf(ctx);
  if (key && out.country) {
    let [self, near] = REACTION[key];
    const given = m.faithDelta.find((f) => f.scope === 'country');
    if (given) self = given.delta;
    faithAt(ctx, out.country, self);
    if (near) for (const n of neighboursOf(ctx, out.country)) faithAt(ctx, n, near);
  }
  if (h.line === 'destroy' || (h.line === 'dragon' && m.cost.dread)) gain(ctx, 'dread', Math.round(paid.dread / DESTROY_RETURN_DIV));
  // the character who stands where it fell sees it
  if (life && h.line !== 'dragon' && ((out.country && out.country === life.country) || (out.continent && out.continent === continentOf(life.country)))) {
    belief(ctx, h.line === 'create' ? BELIEF_SEEN.create : BELIEF_SEEN.destroy);
    // iron rule 1: he is never killed, he may be hurt
    if (h.line === 'destroy' && ctx.rng('god.miracle').chance(MC_HURT)) apply(ctx, [{ k: 'wound' }], { sys: 'god', id: m.id, stream: 'god.miracle' });
  }
}

