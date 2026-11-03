// The conjuring as a command (07-conjure.md §5 and §6): `check` says whether the god may, `preview` shows the confirm screen (the result, the price, the chance of the shadow, the omen) and rolls
// nothing, `run` pays, uses the quota, and either does it or sets the omen of a season. A combination that is a listed miracle is run as that miracle and does not use the quota.
// The day of the conjuring: the ops of the cell land on the country (or on every country of the continent), the world answers (the faith of the countries, the sight of the character),
// the shadow is thrown, the name is written in the registry of the world, the chronicle and the log get their line.
import type { Ctx } from '../../game';
import { apply } from '../../rules';
import { healNpc, killNpc, favourNpc } from '../../npc';
import { addMood } from '../../world';
import { registerName } from '../../text/names';
import { applyFx } from '../acts/fx';
import { handlerOf, miracleOf, checkMiracle, previewMiracle, runMiracle } from '../acts/miracles';
import { chronicle, say } from '../acts/record';
import { faithAt } from '../acts/mods';
import { continentOf, godOf, neighboursOf } from '../acts/geo';
import { actsOf, lifeCounters, livingOf, peekCounters, ready, startCooldown, yearOf } from '../acts/state';
import { BELIEF_SEEN, DESTROY_RETURN_DIV, MC_HURT, REACTION } from '../acts/tuning';
import { addBelief } from '../belief';
import { earn, pay as payPower, whyNot } from '../power';
import { goalsOf, unlocked } from '../goals';
import { UNLOCKS } from '../goals/tuning';
import { runOps, type Op } from './ops';
import { dayDetail, detail, effectLines, plan, priceOf, scopeOf, shadowPlaces, coreName, scaleName, verbName, type Plan } from './plan';
import { conjOf, lifeCount, peekLife, viewConj, type PendingConjure } from './state';
import { REFUND, SEAL_GAP, SEAL_HOME, SEAL_LIFE_MOOD, SEAL_MOOD } from './tuning';

const MR06 = 'MR-06';

/** The names the registry of the world and the omens waiting already hold, to pass over. */
const takenNames = (ctx: Ctx): string[] => viewConj(ctx.state).pending.map((p) => p.name);

function planOf(ctx: Ctx, args: Record<string, unknown>) {
  return plan(ctx, args, takenNames(ctx));
}

// ---------- check ----------

/** The point of the chronicle that opens a verb or a core (for the answer "not open yet"). */
function opensAt(kind: 'verbs' | 'cores', id: string): number | undefined {
  return UNLOCKS.find((u) => u[kind]?.includes(id))?.at;
}

export function checkConjure(ctx: Ctx, args: Record<string, unknown>): string | null {
  if (!livingOf(ctx)) return 'ไม่มีตัวละครที่มีชีวิต';
  const cv = viewConj(ctx.state);
  if (args.cancel !== undefined) return cv.pending.some((p) => p.n === Number(args.cancel)) ? null : 'ไม่มีลางเสกตามใจใบนั้น';
  const r = planOf(ctx, args);
  if (!r.ok) return r.reason;
  const p = r.plan;
  const open = unlocked(ctx);
  if (!open.verbs.has(p.mix.verb)) return `กริยา "${verbName(ctx, p.mix.verb)}" ยังไม่เปิด (เปิดเมื่อพงศาวดารสายตระกูลถึง ${opensAt('verbs', p.mix.verb) ?? '?'} ตอนนี้ ${open.points})`;
  if (!open.cores.has(p.mix.core)) return `แก่น "${coreName(ctx, p.mix.core)}" ยังไม่เปิด (เปิดเมื่อพงศาวดารสายตระกูลถึง ${opensAt('cores', p.mix.core) ?? '?'} ตอนนี้ ${open.points})`;
  const need = p.cell.need?.(ctx, p.target.country);
  if (need && p.mix.scale !== 'continent') return need;
  if (p.mix.scale === 'person' && p.mix.verb === 'destroy' && !p.mr) {
    const why = handlerOf(MR06)?.check?.(ctx, miracleOf(ctx, MR06)!, { npc: p.target.npc });
    if (why) return why;
  }
  // a combination that is a listed miracle is that miracle: its caps, its waits and its price, and no quota
  if (p.mr) return checkMiracle(ctx, p.mr.args);
  return capReason(ctx, p) ?? whyNot(ctx, p.cost);
}

/** The caps of the conjuring (07-conjure.md §5). */
function capReason(ctx: Ctx, p: Plan): string | null {
  const caps = godOf(ctx).conjure.caps;
  const lim = godOf(ctx).miracles.limits;
  const mine = peekLife(ctx);
  const c = peekCounters(ctx);
  if (c.grand > 0) return 'เสกตามใจใช้ไม่ได้ในชีวิตที่ใช้ปาฏิหาริย์มหาแล้ว';
  if (mine.used >= caps.perLife) return `เสกตามใจครบ ${caps.perLife} ครั้งในชีวิตนี้แล้ว`;
  if (p.mix.scale === 'continent' && mine.continent >= caps.continentPerLife) return `ขนาดทวีปเสกได้ไม่เกิน ${caps.continentPerLife} ครั้งต่อชีวิต`;
  if (mine.mixes.includes(p.key)) return 'ส่วนผสมเดียวกันเสกได้ครั้งเดียวต่อชีวิต';
  if (!ready(ctx, 'conjure')) return `เสกตามใจห่างกันอย่างน้อย ${caps.gapYears} ปีโลก (อีก ${Math.ceil((ctx.state.god.cooldowns.conjure ?? 0) - yearOf(ctx))} ปี)`;
  // a country is the target of a place, a country or a continent (a person is the smallest thing the god's hand falls on)
  for (const s of p.mix.scale === 'person' ? [] : scopeOf(ctx, p.mix, p.target)) {
    if (!ready(ctx, `conjure.country.${s.country}`)) return `ประเทศหนึ่งถูกเสกตามใจได้ครั้งเดียวต่อ ${caps.sameCountryGapYears} ปีโลก`;
  }
  // the country counts among the mid miracles, the continent among the large (the same caps as 04-miracles.md iron rule 6)
  const lifeCaps = godOf(ctx).caps.miraclePerLife;
  if (p.mix.scale === 'country') {
    if (c.mid >= lifeCaps.mid) return `นับร่วมกับปาฏิหาริย์ระดับกลาง ครบ ${lifeCaps.mid} ครั้งในชีวิตนี้แล้ว`;
    if (!ready(ctx, 'world.mid')) return `ระดับกลางห่างกันอย่างน้อย ${lim.worldMidGapYears} ปีโลก`;
  }
  if (p.mix.scale === 'continent') {
    if (c.big >= lifeCaps.big) return `นับร่วมกับปาฏิหาริย์ระดับใหญ่ ครบ ${lifeCaps.big} ครั้งในชีวิตนี้แล้ว`;
    if (!ready(ctx, 'world.big')) return `ระดับใหญ่ห่างกันอย่างน้อย ${lim.worldBigGapYears} ปีโลก`;
  }
  if (p.pins.length && p.mix.verb === 'destroy' && (p.mix.scale === 'country' || p.mix.scale === 'continent')) {
    if (p.pins.some((i) => !ready(ctx, `conjure.pin.${i}`))) return `หมุดผนึกหนึ่งแห่งถูกโจมตีด้วยระดับกลางขึ้นไปได้ครั้งเดียวต่อ ${SEAL_GAP.pin} ปีโลก`;
    if (!ready(ctx, 'conjure.pin.any')) return `หมุดใดก็ได้ทั้งโลกถูกโจมตีได้ครั้งเดียวต่อ ${SEAL_GAP.any} ปีโลก`;
  }
  return null;
}

// ---------- preview ----------

/** When the multiplier of the belief is on the price (01-power.md §2: light ×1.5 below −30, dread ×1.2 above 60) the preview says the base and why (M4 review M1). */
function priceRise(ctx: Ctx, pl: Plan): Record<string, unknown> {
  const { base } = priceOf(ctx, pl.mix);
  const paid = pl.cost[pl.pay] ?? 0;
  const mods = godOf(ctx).prices.mods;
  return paid > base ? { priceBase: base, priceMul: pl.pay === 'faith' ? mods.beliefLow.faithMul : mods.beliefHigh.dreadMul, priceWhy: pl.pay === 'faith' ? 'belief-low' : 'belief-high' } : {};
}

export function previewConjure(ctx: Ctx, args: Record<string, unknown>): Record<string, unknown> {
  if (args.cancel !== undefined) {
    const p = viewConj(ctx.state).pending.find((x) => x.n === Number(args.cancel))!;
    return { conjure: true, cancel: p.n, name: p.name, refund: { faith: Math.floor(p.paid.faith * REFUND), dread: Math.floor(p.paid.dread * REFUND) }, warn: ['รอยนิ้วมือที่ใช้ไป (นับการเสกตามใจไปครั้งหนึ่งของชีวิตนี้แล้ว)'] };
  }
  const p = planOf(ctx, args);
  if (!p.ok) return {};
  const pl = p.plan;
  const mine = peekLife(ctx);
  const caps = godOf(ctx).conjure.caps;
  const head = { conjure: true, verb: verbName(ctx, pl.mix.verb), core: coreName(ctx, pl.mix.core), scale: scaleName(ctx, pl.mix.scale), mix: pl.key, target: pl.mix.scale === 'continent' ? pl.target.continent : pl.target.npc ?? pl.target.country, ...(pl.mix.scale === 'continent' ? { continent: pl.target.continent } : {}) };
  if (pl.mr) {
    const base = previewMiracle(ctx, pl.mr.args);
    return { ...head, ...base, listed: pl.mr.id, quota: 'ไม่ใช้โควต้าเสกตามใจ (เป็นปาฏิหาริย์ในรายการ)', left: base.left };
  }
  const back = pl.mix.verb === 'destroy' ? Math.round((pl.cost.dread ?? 0) / DESTROY_RETURN_DIV) : 0;
  return {
    ...head,
    name: pl.name,
    result: pl.say,
    expected: pl.expected,
    effects: effectLines(ctx, pl),
    cost: pl.cost,
    ...priceRise(ctx, pl),
    ...(back > 0 ? { back: { dread: back }, net: { dread: (pl.cost.dread ?? 0) - back } } : {}),
    chance: { shadow: pl.shadowSure ? 1 : pl.shadow },
    omen: pl.quarters,
    omenLine: pl.omen,
    quota: { used: mine.used, limit: caps.perLife, left: caps.perLife - mine.used },
    ...(pl.reaction ? { reaction: { id: pl.reaction.id, say: pl.reaction.say, text: pl.reaction.text(ctx) } } : {}),
    ...(pl.pins.length && pl.mix.verb === 'destroy' ? { seal: { pins: pl.pins, mood: pl.mix.scale === 'continent' ? SEAL_MOOD.continent : SEAL_MOOD.country, note: 'ผนึกรับแรงไว้ ผลลดหนึ่งระดับ' } } : {}),
  };
}

// ---------- run ----------

export function runConjure(ctx: Ctx, args: Record<string, unknown>): void {
  const cv = conjOf(ctx.state);
  if (args.cancel !== undefined) {
    const p = cv.pending.find((x) => x.n === Number(args.cancel))!;
    cv.pending = cv.pending.filter((x) => x !== p);
    earn(ctx, { faith: Math.floor(p.paid.faith * REFUND), dread: Math.floor(p.paid.dread * REFUND) }, 'conjure.cancel');
    say(ctx, { kind: 'conjure.cancel', id: p.mix, data: { n: p.n, name: p.name }, level: 1 });
    chronicle(ctx, { kind: 'conjure.cancel', id: p.mix });
    return;
  }
  const r = planOf(ctx, args);
  if (!r.ok) return;
  const pl = r.plan;
  if (pl.mr) {
    runMiracle(ctx, pl.mr.args);
    return;
  }
  const caps = godOf(ctx).conjure.caps;
  const lim = godOf(ctx).miracles.limits;
  payPower(ctx, pl.cost, `conjure:${pl.key}`);
  // the quota
  const mine = lifeCount(ctx);
  mine.used += 1;
  mine.mixes.push(pl.key);
  if (pl.mix.scale === 'continent') mine.continent += 1;
  const c = lifeCounters(ctx);
  if (pl.mix.scale === 'country') {
    c.mid += 1;
    startCooldown(ctx, 'world.mid', lim.worldMidGapYears);
  } else if (pl.mix.scale === 'continent') {
    c.big += 1;
    startCooldown(ctx, 'world.big', lim.worldBigGapYears);
  }
  startCooldown(ctx, 'conjure', caps.gapYears);
  if (pl.mix.scale !== 'person') for (const s of scopeOf(ctx, pl.mix, pl.target)) startCooldown(ctx, `conjure.country.${s.country}`, caps.sameCountryGapYears);
  if (pl.pins.length && pl.mix.verb === 'destroy' && (pl.mix.scale === 'country' || pl.mix.scale === 'continent')) {
    for (const i of pl.pins) startCooldown(ctx, `conjure.pin.${i}`, SEAL_GAP.pin);
    startCooldown(ctx, 'conjure.pin.any', SEAL_GAP.any);
  }
  const paid = { faith: pl.cost.faith ?? 0, dread: pl.cost.dread ?? 0 };
  if (pl.quarters > 0) {
    const pend: PendingConjure = { n: ++cv.n, mix: pl.key, args: { ...args }, left: pl.quarters, quarters: pl.quarters, paid, year: yearOf(ctx), name: pl.name };
    cv.pending.push(pend);
    say(ctx, { kind: 'conjure.omen', id: pl.key, data: { n: pend.n, name: pl.name, target: pl.target.continent && pl.mix.scale === 'continent' ? pl.target.continent : pl.target.country, omen: pl.omen, quarters: pl.quarters }, level: 2 });
    chronicle(ctx, { kind: 'conjure.omen', id: pl.key, target: pl.targetKey });
    return;
  }
  happen(ctx, pl, paid);
}

/** The day: the world changes, the world answers, the shadow falls, the name is written. */
function happen(ctx: Ctx, pl: Plan, paid: { faith: number; dread: number }): void {
  const { mix, target } = pl;
  const rng = detail(ctx, 'run', mix, pl.targetKey);
  const src = `conjure:${mix.verb}.${mix.core}`;
  const scope = scopeOf(ctx, mix, target);
  const pinsHit = pl.pins.length > 0 && mix.verb === 'destroy';
  let result = pl.say;
  if (mix.scale === 'person') result = personRun(ctx, pl, rng);
  else {
    for (const s of scope) {
      // a seal takes part of the blow: the result falls one step (04-miracles.md §5.4)
      const sealed = pinsHit && pinsIn(s.country, pl.pins);
      runOps(ctx, pl.ops, { country: s.country, factor: s.factor * (sealed ? 0.5 : 1), rng, src });
    }
    if (pl.reaction?.spread) {
      const near = neighboursOf(ctx, target.country);
      if (near.length) runOps(ctx, pl.cell.ops, { country: rng.pick(near), factor: SIZE_ONE, rng, src });
    }
    if (mix.verb === 'wake' && mix.core === 'shadow') {
      const home = ctx.state.life && !ctx.state.life.dead ? ctx.state.life.country : undefined;
      if (home && scope.some((s) => s.country === home)) conjOf(ctx.state).freeDream = true;
    }
    for (const i of pl.pins) {
      if (pl.reaction?.mood) addMood(ctx, i, pl.reaction.mood);
      else if (pl.mix.verb === 'create' && pl.mix.core === 'life') addMood(ctx, i, SEAL_LIFE_MOOD);
      if (pinsHit) addMood(ctx, i, mix.scale === 'continent' ? SEAL_MOOD.continent : SEAL_MOOD.country);
    }
    react(ctx, pl, rng, scope.map((s) => s.country));
  }
  const day = dayDetail(ctx, mix, target);
  const name = registerName(ctx, `conjure:${pl.key}:${pl.targetKey}:${yearOf(ctx)}`, pl.name);
  const g = goalsOf(ctx.state).meta;
  g.conjured.push({ name, mix: pl.key, year: yearOf(ctx) });
  if (pl.reaction && !g.reactionsSeen.includes(pl.reaction.id)) g.reactionsSeen.push(pl.reaction.id);
  say(ctx, {
    kind: 'conjure',
    id: pl.key,
    data: { name, result, verb: verbName(ctx, mix.verb), core: coreName(ctx, mix.core), scale: scaleName(ctx, mix.scale), target: mix.scale === 'continent' ? target.continent! : mix.scale === 'person' ? target.npc ?? 'self' : target.country, react: pl.reaction?.say ?? null, seen: day.seen, spot: day.spot, hue: day.hue, faith: paid.faith, dread: paid.dread },
    level: 2,
  });
  chronicle(ctx, { kind: 'conjure', id: pl.key, target: pl.targetKey, result: name });
  shadow(ctx, pl, name);
}

const SIZE_ONE = 1;
const pinsIn = (country: string, pins: number[]): boolean => (SEAL_HOME[country] ?? []).some((i) => pins.includes(i)) || country === 'AL-01';

/** The answer of the world (04-miracles.md §6): faith of the target and its neighbours, the dread the blood gives back, what the character sees. */
function react(ctx: Ctx, pl: Plan, rng: ReturnType<typeof detail>, countries: string[]): void {
  const { mix } = pl;
  const line = mix.verb === 'destroy' ? 'destroy' : mix.verb === 'change' ? undefined : 'create';
  const key = line === 'create' ? (mix.scale === 'place' ? 'createSmall' : 'createMid') : line === 'destroy' ? (mix.scale === 'place' ? 'destroySmall' : 'destroyMid') : undefined;
  const life = livingOf(ctx);
  if (key) {
    const [self, near] = REACTION[key];
    for (const c of countries) {
      faithAt(ctx, c, self);
      if (near) for (const n of neighboursOf(ctx, c)) if (!countries.includes(n)) faithAt(ctx, n, near);
    }
  }
  if (line === 'destroy') earn(ctx, { dread: Math.round((pl.cost.dread ?? 0) / DESTROY_RETURN_DIV) }, 'conjure.return');
  if (life && line && (countries.includes(life.country) || (mix.scale === 'continent' && pl.target.continent === continentOf(life.country)))) {
    addBelief(ctx, line === 'create' ? BELIEF_SEEN.create : BELIEF_SEEN.destroy, 'conjure.seen');
    // iron rule 1: he is never killed, he may be hurt
    if (line === 'destroy' && rng.chance(MC_HURT)) apply(ctx, [{ k: 'wound' }], { sys: 'god', id: pl.key, stream: 'god.miracle' });
  }
}

/** The shadow (07-conjure.md §4): thrown once on every conjuring, from the stream of the seed and the mix; falls on the target or a neighbour, by the core. */
function shadow(ctx: Ctx, pl: Plan, name: string): void {
  const sure = pl.shadowSure;
  const r = detail(ctx, 'shadow', pl.mix, pl.targetKey);
  const roll = r.next();
  if (!(sure || roll < pl.shadow)) return;
  const places = shadowPlaces(ctx, pl.target.country);
  const where = r.pick(places);
  const ops = SHADOW_OPS[pl.mix.core];
  runOps(ctx, ops, { country: where, factor: 1, rng: r, src: `conjure.shadow:${pl.mix.core}` });
  const text = godOf(ctx).conjure.shadow.byCore.find((x) => x.core === pl.mix.core)?.text ?? '';
  say(ctx, { kind: 'conjure.shadow', id: pl.key, data: { name, result: text, country: where }, level: 2 });
  chronicle(ctx, { kind: 'conjure.shadow', id: pl.key, target: where, result: text });
}

/** What the shadow does, by core (07-conjure.md §4 the second table): a small matter, at the target or a neighbour. */
export const SHADOW_OPS: Record<string, Op[]> = {
  fire: [{ op: 'mod', subject: 'W', add: -1, years: 2 }],
  water: [{ op: 'mod', subject: 'flood', mul: 1.1, years: 1 }],
  earth: [{ op: 'mod', subject: 'quake-events', mul: 2, years: 2 }, { op: 'mod', subject: 'W', add: -0.5, years: 2 }],
  wind: [{ op: 'mod', subject: 'sea', mul: 1.2, years: 1 }],
  life: [{ op: 'mod', subject: 'beast-fights', mul: 2, years: 2 }],
  death: [{ op: 'deed', kind: 'monster', id: 'wandering-ghost' }],
  light: [{ op: 'deed', kind: 'zealots', id: 'zealot-group' }],
  shadow: [{ op: 'flag', flag: 'nightmare', years: 1 }],
};

// ---------- the person ----------

/** A conjuring on one person (an NPC, or the character himself for what is not destroying). Returns the words of what happened. */
function personRun(ctx: Ctx, pl: Plan, rng: ReturnType<typeof detail>): string {
  const { mix, target } = pl;
  const id = target.npc;
  const deeds = actsOf(ctx.state).deeds;
  const put = (kind: string, what: string) => deeds.push({ kind, id: what, country: target.country, year: yearOf(ctx) });
  const life = livingOf(ctx);
  switch (mix.verb) {
    case 'destroy': {
      // the lightning's own luck: 50 to 50 between death and a grave wound
      const dies = rng.chance(0.5);
      if (id) {
        if (dies) killNpc(ctx, id, 'เสกตามใจ');
        else put('hurt', id);
      }
      return dies ? 'ตาย' : 'บาดเจ็บสาหัส';
    }
    case 'create': {
      if (pl.cell.person === 'companion') {
        const all = ((ctx.data.companions?.items as { species?: { id: string; name?: string; tier: string }[] } | undefined)?.species ?? []).filter((s) => s.tier === 'C' || s.tier === 'U');
        const species = all.map((s) => s.id).sort();
        const sp = species.length ? rng.pick(species) : 'sp_companion';
        const spName = all.find((s) => s.id === sp)?.name ?? 'สัตว์ตัวหนึ่ง';
        if (id) {
          put('companion', `${sp}:${id}`);
          favourNpc(ctx, id, 1);
        } else if (life) apply(ctx, [{ k: 'grant', kind: 'companion', id: sp }], { sys: 'god', id: pl.key, stream: 'god.acts' });
        return `สัตว์คู่หู ${spName} มาหา${id ? ' NPC' : 'ตัวละคร'}`;
      }
      put('gift', `${pl.cell.person === 'amulet' ? 'amulet' : 'boon'}:${mix.core}${id ? `:${id}` : ''}`);
      if (id) favourNpc(ctx, id, 1);
      return pl.cell.person === 'amulet' ? 'เครื่องรางไฟหนึ่งชิ้น' : `${pl.say}แก่คนหนึ่งคน`;
    }
    case 'wake':
      if (id) {
        healNpc(ctx, id, 1);
        put('woken', id);
      } else if (life) applyFx(ctx, 'hp+25');
      return 'ตื่นขึ้นและแรงขึ้น';
    case 'calm':
      if (id) favourNpc(ctx, id, 1);
      else if (life) life.heart = Math.max(0, life.heart - 1);
      put('calmed', id ?? 'self');
      return 'ใจสงบลง';
    case 'reveal':
      put('secret', id ?? 'self');
      return 'ความลับหนึ่งข้อปรากฏ';
    default:
      put('changed', `${mix.core}:${id ?? 'self'}`);
      return 'กลายเป็นอีกสิ่ง';
  }
}

// ---------- the beat and the death ----------

/** Each beat: the omens come due. */
export function conjureBeat(ctx: Ctx): void {
  const cv = viewConj(ctx.state);
  if (!cv.pending.length) return;
  const e = conjOf(ctx.state);
  for (const p of [...e.pending]) {
    p.left -= 1;
    if (p.left > 0) continue;
    e.pending = e.pending.filter((x) => x !== p);
    day(ctx, p);
  }
}

function day(ctx: Ctx, p: PendingConjure): void {
  const r = plan(ctx, p.args, []);
  if (!r.ok) return;
  happen(ctx, { ...r.plan, mr: undefined, name: p.name }, p.paid);
}

/** The omens that are still pending happen when the character dies: the god has paid. */
export function conjureFlush(ctx: Ctx): void {
  const e = conjOf(ctx.state);
  for (const p of e.pending) p.left = 1;
  conjureBeat(ctx);
}
