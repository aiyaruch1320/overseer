// The seals (หมุดผนึก, 04-miracles.md iron rule 3 and §5.4): the countries where a legend dragon lives, and AL-01 (the key of the oath of a hundred
// tribes). A destroying miracle of the mid or large tier may fall on them, but the seal takes part of the blow: the effect on the country is one tier
// lower, the dragon is hurt, and within a year it answers (protects its place · roars through its sibling · wakes in pain). One seal may be struck
// by a mid miracle or above once in 100 world years, and any seal once in 25; a seal a dragon protects takes no miracle for 50 years.
// This file is the layer (`Intercept`) the miracles pass through, and the replies of the dragons that come due.
import type { Ctx } from '../../game';
import type { Miracle } from '../../data/types-god';
import { addMood, holdEvent, moodOf, strikeCap, tablesOf } from '../../world';
import { addMod, faithAt, setFlag } from '../acts/mods';
import { addIntercept, countryArg, type Handler, type Intercept, type Outcome } from '../acts/miracles';
import { continentOf, countriesOf, countryName, godOf, lifeCountry } from '../acts/geo';
import { chronicle, say } from '../acts/record';
import { ready, startCooldown, yearOf } from '../acts/state';
import { crackStep, type CrackStrike } from './crack';
import { ruinExt, viewRuin, type SealReply } from './state';
import { SEAL_MID } from './tuning';

export interface SealInfo {
  country: string;
  /** The living dragons whose place it is. */
  dragons: number[];
  /** AL-01: the key of the oath, which takes the blow for its dragon-less seal. */
  key: boolean;
}

const sealData = (ctx: Ctx) => godOf(ctx).miracles.seal;

/** The seal at a country, if it is one now: a living legend dragon lives there, or it is the country of the key. */
export function sealAt(ctx: Ctx, country: string): SealInfo | null {
  const s = sealData(ctx);
  const dragons = s.homes.filter((h) => h.countries.includes(country) && ctx.state.world.dragons[h.dragon]?.alive).map((h) => h.dragon);
  const key = country === s.keyCountry;
  return dragons.length || key ? { country, dragons, key } : null;
}

/** Every country that is a seal now. */
export function sealCountries(ctx: Ctx): string[] {
  const s = sealData(ctx);
  const set = new Set<string>([s.keyCountry]);
  for (const h of s.homes) if (ctx.state.world.dragons[h.dragon]?.alive) for (const c of h.countries) set.add(c);
  return [...set].sort();
}

/** The places of a dragon. */
export const homesOf = (ctx: Ctx, dragon: number): string[] => sealData(ctx).homes.find((h) => h.dragon === dragon)?.countries ?? [];

// ---------- which blow is a blow on a seal ----------

export type Hit = 'mid' | 'big';

/** The kind of blow a miracle is on a seal (a destroying miracle of the mid or large tier that names a country), or null. */
export function hitOf(m: Miracle, h: Handler): Hit | null {
  if (h.line !== 'destroy') return null;
  return m.tier === 'กลาง' ? 'mid' : m.tier === 'ใหญ่' ? 'big' : null;
}

/** The countries a command names: `countries`, `country`, or the country of the character when the miracle is one of a country. */
export function targetsOf(ctx: Ctx, m: Miracle, args: Record<string, unknown>): string[] {
  if (Array.isArray(args.countries)) return (args.countries as unknown[]).map(String);
  if (args.country !== undefined) return [String(args.country)];
  if (args.npc !== undefined || args.dragon !== undefined || args.continent !== undefined || args.event !== undefined) return [];
  const c = m.target.includes('ประเทศ') ? countryArg(ctx, args) ?? lifeCountry(ctx) : undefined;
  return c ? [c] : [];
}

const names = (ctx: Ctx, s: SealInfo): string => (s.dragons.length ? s.dragons.map((d) => tablesOf(ctx).dragons[d].name).join(' และ ') : 'กุญแจคำสัตย์ร้อยเผ่า');

// ---------- what the dragon answers ----------

/** The reply for a mood after the blow (the table of §5.4). */
export function replyFor(ctx: Ctx, mood: number): SealReply['kind'] {
  const row = sealData(ctx).reply.find((r) => mood >= r.moodMin && mood <= r.moodMax) ?? sealData(ctx).reply[sealData(ctx).reply.length - 1];
  return row.name === 'ปกป้อง' ? 'protect' : row.name === 'คำราม' ? 'growl' : 'awake';
}

const REPLY_TH: Record<SealReply['kind'], string> = {
  protect: 'มังกรแผ่ผนึกคลุมที่ของมัน ผู้คนวิ่งเข้าหา',
  growl: 'มังกรร้องความเจ็บผ่านพี่น้อง',
  awake: 'มังกรตื่นด้วยความเจ็บ',
};

/** What happens to the dragons' mood and the replies they will give (the blow is already paid): `delta` the mood lost, `capLoss` the highest mood lost for good. */
function hurt(ctx: Ctx, s: SealInfo, delta: number, capLoss: number): { dragon: number; before: number; after: number; reply: SealReply['kind'] }[] {
  const e = ruinExt(ctx.state);
  const out: { dragon: number; before: number; after: number; reply: SealReply['kind'] }[] = [];
  for (const d of s.dragons) {
    const before = moodOf(ctx, d);
    addMood(ctx, d, delta);
    if (capLoss) strikeCap(ctx, d, capLoss);
    const after = moodOf(ctx, d);
    const reply = replyFor(ctx, after);
    e.replies.push({ country: s.country, dragon: d, due: yearOf(ctx) + 1, mood: after, kind: reply });
    out.push({ dragon: d, before, after, reply });
  }
  return out;
}

/** The effect of a small miracle on the country (W −1 for two years, a flag for a year) that a mid blow on a seal has (§5.4 first row). */
export function sealedMid(ctx: Ctx, s: SealInfo): string {
  const c = s.country;
  const mid = sealData(ctx);
  addMod(ctx, { subject: 'W', country: c, add: SEAL_MID.w, years: SEAL_MID.wYears, src: 'seal' });
  setFlag(ctx, c, SEAL_MID.flag, SEAL_MID.flagYears);
  if (s.key) concordia(ctx);
  else {
    hurt(ctx, s, mid.hit[0].dragonMood, 0);
    worshippers(ctx, s);
  }
  return s.key ? 'กุญแจคำสัตย์รับแรงไว้ ความเชื่อมั่นทองกลางสั่น' : `${names(ctx, s)}เจ็บตามผนึก`;
}

/** The key of the oath takes the blow in place of a dragon: confidence of gold C −20 · the council breaks (LE-05 ×2 in era 4) or a delegate is killed (PO-08 ×2) for ten years. */
function concordia(ctx: Ctx): void {
  const k = sealData(ctx).concordia;
  const c = sealData(ctx).keyCountry;
  addMod(ctx, { subject: 'C', country: c, add: k.c, years: k.years, src: 'seal.key' });
  const until = yearOf(ctx) + k.years;
  holdEvent(ctx, ctx.state.world.era === 4 ? 'LE-05' : 'PO-08', k.le05Mul, until);
}

/** The worshippers of the dragon everywhere trust the god less (−5 direct faith, §5.4 first row). */
function worshippers(ctx: Ctx, s: SealInfo): void {
  const t = tablesOf(ctx);
  const down = sealData(ctx).midWorshippers;
  for (const d of s.dragons) {
    const words = sealData(ctx).homes.find((h) => h.dragon === d)?.faiths ?? [];
    const nos = t.data.faiths.filter((f) => words.some((w) => w.length > 2 && f.name.includes(w))).map((f) => f.no);
    if (!nos.length) continue;
    for (const [c, list] of Object.entries(t.data.mainFaiths)) if (list.some((n) => nos.includes(n))) faithAt(ctx, c, down);
  }
}

/** A dragon's place is struck with the large tier: the cracked city (crack.ts) and the dragon's pain. */
export function sealedBig(ctx: Ctx, s: SealInfo, strike: CrackStrike): string {
  const c = sealData(ctx).crack;
  const hits = s.key ? [] : hurt(ctx, s, c.mood, c.capLoss);
  if (s.key) concordia(ctx);
  return crackStep(ctx, s, strike, hits.map((x) => x.dragon));
}

/** The blow of the wrath on the seals of a continent: the effect of the mid tier on each, and −15 on every dragon of the continent (§5.4 third row). */
export function wrathOnSeals(ctx: Ctx, continent: string): string[] {
  const e = viewRuin(ctx.state);
  const out: string[] = [];
  const mood = godOf(ctx).miracles.grand.wrath.moodAll;
  const seen = new Set<number>();
  for (const c of countriesOf(ctx, continent)) {
    const s = sealAt(ctx, c);
    if (!s || (e.protect[c] ?? 0) > yearOf(ctx)) continue;
    addMod(ctx, { subject: 'W', country: c, add: SEAL_MID.w, years: SEAL_MID.wYears, src: 'seal' });
    setFlag(ctx, c, SEAL_MID.flag, SEAL_MID.flagYears);
    if (s.key) concordia(ctx);
    for (const d of s.dragons) {
      if (seen.has(d)) continue;
      seen.add(d);
      hurt(ctx, { ...s, dragons: [d] }, mood, 0);
    }
    startSealClocks(ctx, c);
    out.push(c);
  }
  // a dragon of the continent whose place is not struck feels it too
  for (const h of sealData(ctx).homes) {
    if (seen.has(h.dragon) || !ctx.state.world.dragons[h.dragon]?.alive || !h.countries.some((c) => continentOf(c) === continent)) continue;
    seen.add(h.dragon);
    addMood(ctx, h.dragon, mood);
  }
  return out;
}

/** A seal was struck: it waits 100 years, and any seal 25. */
export function startSealClocks(ctx: Ctx, country: string): void {
  const s = sealData(ctx);
  startCooldown(ctx, 'seal.' + country, s.anchorCdYears);
  startCooldown(ctx, 'seal.any', s.anyAnchorCdYears);
}

// ---------- the layer ----------

const layer: Intercept = {
  check(ctx, m, h, args) {
    const e = viewRuin(ctx.state);
    const y = yearOf(ctx);
    const list = targetsOf(ctx, m, args);
    for (const c of list) {
      const until = e.protect[c] ?? 0;
      if (until > y) return `ผนึกของมังกรปกคลุม${countryName(ctx, c)}อยู่ ปาฏิหาริย์ใดตกที่นั่นไม่ได้อีก ${Math.ceil(until - y)} ปีโลก`;
    }
    const hit = hitOf(m, h);
    if (!hit) return null;
    for (const c of list) {
      if (!sealAt(ctx, c)) continue;
      if (!ready(ctx, 'seal.' + c)) return `หมุดผนึกที่${countryName(ctx, c)}เพิ่งถูกโจมตี ต้องรออีก ${Math.ceil((ctx.state.god.cooldowns['seal.' + c] ?? 0) - y)} ปีโลก`;
      if (!ready(ctx, 'seal.any')) return `หมุดผนึกทุกแห่งห่างกันอย่างน้อย ${sealData(ctx).anyAnchorCdYears} ปีโลก ต้องรออีก ${Math.ceil((ctx.state.god.cooldowns['seal.any'] ?? 0) - y)} ปีโลก`;
    }
    return null;
  },

  run(ctx, m, h, args): Outcome | null {
    const hit = hitOf(m, h);
    const c = hit ? targetsOf(ctx, m, args)[0] : undefined;
    const s = c ? sealAt(ctx, c) : null;
    if (!hit || !c || !s) return null;
    if (hit === 'mid') {
      const result = sealedMid(ctx, s);
      return { target: c, result, country: c, reaction: 'destroySmall' };
    }
    const result = sealedBig(ctx, s, { id: m.id, name: m.name });
    return { target: c, result, country: c, reaction: 'destroyMid' };
  },

  preview(ctx, m, h, args) {
    const hit = hitOf(m, h);
    const c = hit ? targetsOf(ctx, m, args)[0] : undefined;
    const s = c ? sealAt(ctx, c) : null;
    if (!hit || !c || !s) return null;
    const d = sealData(ctx);
    const delta = hit === 'mid' ? d.hit[0].dragonMood : d.crack.mood;
    const dragons = s.dragons.map((i) => {
      const before = moodOf(ctx, i);
      const after = before + delta;
      return { id: i, name: tablesOf(ctx).dragons[i].name, mood: Math.round(before), after: Math.round(after), reply: replyFor(ctx, after) };
    });
    const notes = [
      `${countryName(ctx, c)}เป็นหมุดผนึกของ${names(ctx, s)} ผนึกรับแรงไว้ส่วนหนึ่ง ผลต่อประเทศลดลงหนึ่งระดับ${hit === 'big' ? ' (ไม่เป็นซาก เป็นเมืองร้าว)' : ''}`,
      ...dragons.map((x) => `อารมณ์ของ${x.name} ${x.mood} → ${x.after} และภายในหนึ่งปีจะ${x.reply === 'protect' ? 'ปกป้อง' : x.reply === 'growl' ? 'คำราม' : 'ตื่นด้วยความเจ็บ'}`),
    ];
    if (s.key) notes.push('กุญแจคำสัตย์รับแทนมังกร: ความเชื่อมั่นทองกลาง C −20 และสภาเก้าทวีปสั่น');
    return {
      sealed: true,
      seal: { country: c, level: hit, dragons, key: s.key },
      notes,
      ...(hit === 'big' ? { back: Math.round((m.cost.dread ?? 0) / 3) } : {}),
    };
  },

  spent(ctx, m, h, args) {
    if (!hitOf(m, h)) return;
    for (const c of targetsOf(ctx, m, args)) if (sealAt(ctx, c)) startSealClocks(ctx, c);
  },

  after(ctx, m, h, args, out) {
    // a mid blow or above in a continent with a living legend dragon hurts it a little (§6 last paragraph); the dragon of a struck seal already took the blow
    if (!hitOf(m, h) || !out.country) return;
    if (sealAt(ctx, out.country)) return;
    const k = continentOf(out.country);
    for (const home of sealData(ctx).homes) if (home.countries.some((c) => continentOf(c) === k) && ctx.state.world.dragons[home.dragon]?.alive) addMood(ctx, home.dragon, -2);
    void args;
  },
};

addIntercept(layer);

// ---------- the dragons answer ----------

/** Replies that have come due: protects its place, roars through its closest sibling, or wakes in pain. */
export function sealStep(ctx: Ctx): void {
  const e = ruinExt(ctx.state);
  if (!e.replies.length) return;
  const y = yearOf(ctx);
  const t = tablesOf(ctx);
  const d = sealData(ctx);
  const due = e.replies.filter((r) => r.due <= y);
  if (!due.length) return;
  e.replies = e.replies.filter((r) => r.due > y);
  for (const r of due) {
    const dragon = t.dragons[r.dragon];
    const k = continentOf(r.country);
    if (r.kind === 'protect') {
      e.protect[r.country] = y + d.protectYears;
      for (const c of countriesOf(ctx, k)) faithAt(ctx, c, -5); // direct faith −5; the seal faith (channel A) +5 is the world's next decade
      ctx.state.world.vars['F.A'] = (ctx.state.world.vars['F.A'] ?? 0) + 5;
    } else if (r.kind === 'growl') {
      const near = dragon.pair;
      if (near !== null && near !== undefined) addMood(ctx, near, -5);
    } else if (dragon.awakeEvent) holdEvent(ctx, dragon.awakeEvent, 3, y + 10);
    say(ctx, { kind: 'seal', id: 'reply', data: { dragon: dragon.name, country: r.country, reply: r.kind, text: REPLY_TH[r.kind] }, level: 1 });
    chronicle(ctx, { kind: 'seal.reply', id: dragon.name, target: r.country, result: r.kind });
  }
}
