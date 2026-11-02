// Whispers (god/03-dreams.md §6): nine short hints, 5 or 8 light, three a life year, the same hint once a year. The character obeys with
// the dream formula on a base of 0.50. An obeyed hint changes what the story weighs next; the story reads it through the functions at
// the bottom of this file (`choiceWhisperMul` before a way is chosen, `decisionMade` after it).
import type { Ctx } from '../../game';
import { apply } from '../../rules';
import type { Choice, Effect } from '../../types';
import { npcIndex } from '../../npc/data';
import { chronicle, say } from './record';
import { clamp, continentOf, countryName, godOf, hasCountry } from './geo';
import { aliveNpc, nameOf, slotOf } from './npcs';
import { addBelief } from '../belief';
import { pay, priceOf, whyNot } from '../power';
import { inWindow } from '../state';
import { actsOf, livingOf, viewActs, type ActiveWhisper } from './state';
import { WHISPER } from './tuning';

export type Hint = 'ระวัง' | 'กล้าเถิด' | 'จงไป' | 'จงอยู่' | 'จุดอ่อนของศัตรู' | 'คนนั้นโกหก' | 'ช่วย' | 'สางเรื่อง' | 'ชี้ทายาท';

export const hintsOf = (ctx: Ctx): string[] => godOf(ctx).dreams.whispers.map((w) => w.hint);

const CONTINENTS = ['AZ', 'MH', 'KD', 'NR', 'AL', 'MK', 'SH', 'SV', 'NB'];
/** Hints that name something: `target` is a place, an NPC or an heir. */
const NEEDS_TARGET: Record<string, 'place' | 'npc' | 'heir'> = { จงไป: 'place', คนนั้นโกหก: 'npc', ช่วย: 'npc', ชี้ทายาท: 'heir' };

/** The hints sent in this life year, for a check (changes nothing). */
function usedNow(ctx: Ctx): string[] {
  const l = livingOf(ctx);
  const w = viewActs(ctx.state).whisper;
  return l && w.age === l.hAge ? w.used : [];
}

/** What the whisper count of this life year is (a new life year starts it again). */
function yearOf(ctx: Ctx) {
  const l = livingOf(ctx);
  const w = actsOf(ctx.state).whisper;
  if (l && w.age !== l.hAge) {
    w.age = l.hAge;
    w.used = [];
  }
  return w;
}

/** The price now: the table price with the multipliers of 01-power.md §2, nothing the first time a year when the character holds a wise weapon (`wj_sage_e` `wc_al14`). */
export function whisperPrice(ctx: Ctx, hint: string): number {
  return priceOf(ctx, 'whisper', { hint })?.faith ?? 0;
}

/** The chance that the character heeds the whisper, with the parts that decide it (03-dreams.md §3 on a base of 0.50). */
export function obeyChance(ctx: Ctx, hint: string): { p: number; level: 'เต็มใจ' | 'ลังเล' | 'ขัดขืน' } {
  const l = livingOf(ctx);
  if (!l) return { p: 0, level: 'ขัดขืน' };
  const a = viewActs(ctx.state);
  let p = WHISPER.obeyBase + l.godFaith / WHISPER.beliefDiv + (l.stats.int - 10) * WHISPER.intUnit;
  if (l.skills.includes('u_oracle')) p += WHISPER.oracle;
  if (l.blessings.includes('nb_god_whisper')) p += WHISPER.godWhisper;
  if (a.whisper.sent[hint] !== undefined && l.hAge - a.whisper.sent[hint] <= WHISPER.repeatYears) p += WHISPER.repeat;
  const punished = Math.max(a.punishedAt ?? -99, typeof ctx.state.god.ext.punishedAt === 'number' ? ctx.state.god.ext.punishedAt : -99);
  if (l.hAge - punished <= WHISPER.punishedYears) p += WHISPER.punished;
  p = clamp(p, WHISPER.clamp[0], WHISPER.clamp[1]);
  return { p, level: p >= WHISPER.willing ? 'เต็มใจ' : p >= WHISPER.hesitant ? 'ลังเล' : 'ขัดขืน' };
}

export function checkWhisper(ctx: Ctx, args: Record<string, unknown>): string | null {
  const l = livingOf(ctx);
  if (!l) return 'ไม่มีตัวละครที่มีชีวิต';
  const hint = String(args.hint ?? '');
  if (!hintsOf(ctx).includes(hint)) return `ไม่มีคำใบ้ "${hint}"`;
  const used = usedNow(ctx);
  if (used.length >= godOf(ctx).caps.whisperPerYear) return 'กระซิบครบสามครั้งในปีชีวิตนี้แล้ว';
  if (used.includes(hint)) return 'คำใบ้เดียวกันซ้ำไม่ได้ภายในปีเดียว';
  const need = NEEDS_TARGET[hint];
  const target = args.target === undefined ? undefined : String(args.target);
  if (need && !target) return `คำใบ้ "${hint}" ต้องชี้เป้า (target)`;
  if (need === 'place' && !(hasCountry(ctx, target!) || CONTINENTS.includes(target!))) return 'ที่ที่ชี้ไม่มีในโลก';
  if (need === 'npc' && !(npcIndex(ctx).rows.has(target!) && aliveNpc(ctx, target!))) return 'NPC ที่ชี้ไม่มีชีวิตอยู่';
  if (hint === 'สางเรื่อง' && ctx.state.lineage.open.length === 0) return 'สายตระกูลไม่มีเรื่องค้าง';
  const why = whyNot(ctx, { faith: whisperPrice(ctx, hint) });
  return why;
}

export function previewWhisper(ctx: Ctx, args: Record<string, unknown>): Record<string, unknown> {
  const hint = String(args.hint);
  const w = godOf(ctx).dreams.whispers.find((x) => x.hint === hint)!;
  const o = obeyChance(ctx, hint);
  return { hint, cost: { faith: whisperPrice(ctx, hint) }, effect: w.effect, level: o.level, window: inWindow(ctx), left: godOf(ctx).caps.whisperPerYear - usedNow(ctx).length - 1 };
}

export function runWhisper(ctx: Ctx, args: Record<string, unknown>): void {
  const l = livingOf(ctx)!;
  const a = actsOf(ctx.state);
  const hint = String(args.hint);
  const target = args.target === undefined ? undefined : String(args.target);
  const price = priceOf(ctx, 'whisper', { hint })!;
  pay(ctx, price, `whisper:${hint}`);
  yearOf(ctx).used.push(hint);
  a.whisper.sent[hint] = l.hAge;
  const o = obeyChance(ctx, hint);
  const rng = ctx.rng('god.whisper');
  const obeyed = rng.chance(o.p);
  if (obeyed) {
    addBelief(ctx, WHISPER.beliefObey, 'whisper.obey');
    take(ctx, hint, target);
  } else addBelief(ctx, l.godFaith >= 0 && rng.chance(0.5) ? 1 : WHISPER.beliefRefuse, 'whisper.refuse');
  say(ctx, { kind: 'whisper', id: hint, data: { hint, price: price.faith ?? 0, level: o.level, obeyed, ...(target ? { target } : {}) }, level: 1 });
  chronicle(ctx, { kind: 'whisper', id: hint, target, result: `${o.level} ${obeyed ? 'ทำตาม' : 'ไม่ทำตาม'}` });
}

// ---------- what an obeyed hint does ----------

function take(ctx: Ctx, hint: string, target: string | undefined): void {
  const l = livingOf(ctx)!;
  const a = actsOf(ctx.state);
  const act = (w: Omit<ActiveWhisper, 'hint' | 'at'>): void => void a.whisper.active.push({ hint, at: l.hAge, ...w });
  switch (hint) {
    case 'ระวัง':
    case 'กล้าเถิด':
      return act({ left: WHISPER.decisions });
    case 'จงไป':
      return act({ target, until: l.hAge + WHISPER.goYears });
    case 'จงอยู่':
      return act({ until: l.hAge + WHISPER.stayYears });
    case 'จุดอ่อนของศัตรู':
      return act({ left: 1 });
    case 'คนนั้นโกหก':
      return void apply(ctx, [{ k: 'trust', toward: target!, delta: WHISPER.liarTrust }], { sys: 'god', id: 'whisper', stream: 'god.whisper' });
    case 'ช่วย': {
      // the way of the NPC's story tagged [ช่วย] is weighed ×2
      const row = npcIndex(ctx).rows.get(target!);
      const effects: Effect[] = (row?.paths ?? []).filter((p) => p.tags.includes('help')).map((p) => ({ k: 'npcPath', npc: target!, path: p.key, op: 'weight', n: WHISPER.helpMul, unit: 'mul' }));
      apply(ctx, effects, { sys: 'god', id: 'whisper', stream: 'god.whisper' });
      return;
    }
    case 'สางเรื่อง':
      return act({ target: ctx.state.lineage.open[0], until: l.hAge + WHISPER.resolveYears });
    case 'ชี้ทายาท':
      return act({ target, until: 999 });
  }
}

// ---------- what the other systems read ----------

export const activeWhispers = (ctx: Ctx): ActiveWhisper[] => {
  const l = livingOf(ctx);
  const list = viewActs(ctx.state).whisper.active;
  return l ? list.filter((w) => (w.left === undefined || w.left > 0) && (w.until === undefined || w.until >= l.hAge)) : [];
};

const RISKY = new Set(['battle', 'battleFor', 'death', 'wound', 'check']);
function hasRisk(list: readonly Effect[] | undefined): boolean {
  for (const e of list ?? []) {
    if (RISKY.has(e.k)) return true;
    if ((e.k === 'if' || e.k === 'only' || e.k === 'chance') && hasRisk(e.then)) return true;
    if (e.k === 'pick' && e.of.some((b) => hasRisk(b.effects))) return true;
    if (e.k === 'outcome' && hasRisk(e.effects)) return true;
  }
  return false;
}
/** A way is risky when it fights, risks a wound or death, or asks for a roll. */
export const isRisky = (c: Choice): boolean => hasRisk(c.effects);

/**
 * The factor the story multiplies a way's weight by before it chooses (ระวัง: the safe ways ×2 · กล้าเถิด: the risky ways ×2 ·
 * ชี้ทายาท is for the heir choice). The weights stay as they are when every way is of the same kind.
 */
export function choiceWhisperMul(ctx: Ctx, choice: Choice, all: readonly Choice[]): number {
  const act = activeWhispers(ctx);
  const careful = act.some((w) => w.hint === 'ระวัง');
  const bold = act.some((w) => w.hint === 'กล้าเถิด');
  if (!careful && !bold) return 1;
  const risky = isRisky(choice);
  if (all.every((c) => isRisky(c) === risky)) return 1;
  let m = 1;
  if (careful && !risky) m *= WHISPER.safeMul;
  if (bold && risky) m *= WHISPER.riskyMul;
  return m;
}

/** The story calls this once after a node with a choice was played: ระวัง and กล้าเถิด count down. */
export function decisionMade(ctx: Ctx): void {
  const a = actsOf(ctx.state).whisper;
  for (const w of a.active) if ((w.hint === 'ระวัง' || w.hint === 'กล้าเถิด') && w.left) w.left -= 1;
  a.active = a.active.filter((w) => w.left === undefined || w.left > 0);
}

/** Travel to a place (country or continent code) is weighed ×1.5 while จงไป points at it. */
export function travelMul(ctx: Ctx, place: string): number {
  return activeWhispers(ctx).some((w) => w.hint === 'จงไป' && w.target && (w.target === place || w.target === continentOf(place))) ? WHISPER.goMul : 1;
}

/** Moving house is weighed ×0.5 while จงอยู่ holds. */
export const moveMul = (ctx: Ctx): number => (activeWhispers(ctx).some((w) => w.hint === 'จงอยู่') ? WHISPER.stayMul : 1);

/** The factor on the stance that hits the enemy's weak point in the next fight (×3); `battleDone` spends the hint. */
export const weakStanceMul = (ctx: Ctx): number => (activeWhispers(ctx).some((w) => w.hint === 'จุดอ่อนของศัตรู') ? WHISPER.weakMul : 1);
export function battleDone(ctx: Ctx): void {
  const a = actsOf(ctx.state).whisper;
  for (const w of a.active) if (w.hint === 'จุดอ่อนของศัตรู' && w.left) w.left -= 1;
  a.active = a.active.filter((w) => w.left === undefined || w.left > 0);
}

/** Flat bonuses of a hint: `perceive` (ระวัง: the perception roll in a fight +2) and `forge` (กล้าเถิด: forging +2). */
export function whisperBonus(ctx: Ctx, what: 'perceive' | 'forge'): number {
  const act = activeWhispers(ctx);
  if (what === 'perceive') return act.some((w) => w.hint === 'ระวัง') ? 2 : 0;
  return act.some((w) => w.hint === 'กล้าเถิด') ? 2 : 0;
}

/** The heir the god pointed at (×3 in the choice of the heir) and the thread to clear (สางเรื่อง), for the lineage system. */
export const pointedHeir = (ctx: Ctx): string | undefined => activeWhispers(ctx).find((w) => w.hint === 'ชี้ทายาท')?.target;
export const pointedThread = (ctx: Ctx): string | undefined => activeWhispers(ctx).find((w) => w.hint === 'สางเรื่อง')?.target;

/** A line of text about a whisper target for the card (place or NPC name). */
export const targetName = (ctx: Ctx, t: string): string => (slotOf(ctx, t) ? nameOf(ctx, t) : hasCountry(ctx, t) ? countryName(ctx, t) : t);
