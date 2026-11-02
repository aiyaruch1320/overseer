// The commands of the god in text (docs/guide/code-plan.md §8.0 and §6.4), shared by `npm run play` and the debug page.
// A player (a person or a simulated-player subagent) types `chest`, `pick 2`, `dream 1`, `whisper ระวัง`, `answer 1 ให้`,
// `miracle MR-04 <ประเทศ>`, `decree <เหตุการณ์> <ตัวคูณ>`, `cancel N`. Each one goes through `command()` of the core
// (src/core/command): first the preview (the core checks the right to act and answers the expected result without rolling),
// then, after `yes`, the real run (docs/systems/god/06-implementation.md §3).
//
// What the player reads is Thai (docs/appearance/20-god-ui.md); the only codes are the `MR-xx` of a miracle that the player types.
// The arguments sent to the actions are the names the actions read (src/core/god/actions.ts and src/core/god/acts/):
//   chest.open {} · chest.pick {slot} · chest.reroll {lock?} · chest.skip {} · dream.send {path} (1, 2 or 3 of the ways offered)
//   whisper {hint, target?} · prayer.answer {id, answer, option?} · miracle {id, country | countries | continent | npc | dragon | event+mul}
//   miracle {cancel} (take back an omen) · decree {event, mul} · conjure {text} · vow.pick {pick} (the last two have no power behind them yet)
// Browser safe: no node imports.
import { command, hasAction } from '../../src/core/command';
import type { Ctx, Game, GameData } from '../../src/core/game';
import { actsOf, cardsOf, fateTargets, grantPrice, implementedMiracles, kindOf, nameOfKind, strangeOptions } from '../../src/core/god/acts';
import { chestLimit, currentChest, inWindow, offerCards } from '../../src/core/god';
import { callReason, fxPhrases, labels, plainName, scrub, sentence } from '../../src/core/text';
import { CHEST_KIND_TH, TIER_TH, WHY_TH } from '../../src/core/text/tuning';
import type { GodAction, LogEntry } from '../../src/core/types';
import { tagOf, timeline } from './report';
import { toolNotes } from './session';

export interface PendingGod {
  action: GodAction;
  args: Record<string, unknown>;
  title: string;
}

export interface GodConsoleOpts {
  game: Game;
  data: GameData;
  /** Run at once after the preview (`--yes`). */
  autoYes?: boolean;
  /** Show what the tool could not put in words (keys of the preview it does not know). */
  dev?: boolean;
  pending?: PendingGod | null;
}

const TITLE: Record<GodAction, string> = {
  'chest.open': 'เปิดหีบประทาน',
  'chest.pick': 'เลือกการ์ดในหีบ',
  'chest.reroll': 'ทอยหีบใหม่',
  'chest.skip': 'ข้ามหีบ',
  'dream.send': 'ส่งฝัน',
  whisper: 'กระซิบ',
  'prayer.answer': 'ตอบคำอธิษฐาน',
  miracle: 'ปาฏิหาริย์',
  decree: 'ลิขิต',
  conjure: 'เสกตามใจ',
  'vow.pick': 'เลือกคำปฏิญาณ',
};

/** What each action looks like to type, for `options` and `help`. */
const USAGE: Record<GodAction, string> = {
  'chest.open': 'chest',
  'chest.pick': 'pick N',
  'chest.reroll': 'reroll [ล็อก N]',
  'chest.skip': 'skip',
  'dream.send': 'dream N',
  whisper: 'whisper <คำใบ้> [เป้า]',
  'prayer.answer': 'answer <ใบ> <ให้|แปลก N|ปฏิเสธ|ลงโทษ|นิ่ง>',
  miracle: 'miracle MR-xx [เป้าหมาย]',
  decree: 'decree <เหตุการณ์> <ตัวคูณ>',
  conjure: 'conjure <ถ้อยคำ>',
  'vow.pick': 'vow N',
};

const ORDER = Object.keys(TITLE) as GodAction[];

type Meta = 'power' | 'options' | 'yes' | 'no';
const WORDS: Record<string, GodAction | Meta | 'cancel'> = {
  chest: 'chest.open',
  pick: 'chest.pick',
  reroll: 'chest.reroll',
  skip: 'chest.skip',
  dream: 'dream.send',
  whisper: 'whisper',
  answer: 'prayer.answer',
  miracle: 'miracle',
  decree: 'decree',
  cancel: 'cancel',
  conjure: 'conjure',
  vow: 'vow.pick',
  power: 'power',
  options: 'options',
  yes: 'yes',
  y: 'yes',
  ยืนยัน: 'yes',
  no: 'no',
  ไม่: 'no',
  ยกเลิก: 'no',
};

/** True when the first word of a line is one of the commands of the god (so `play` knows to hand the line to the console). */
export function isGodWord(word: string | undefined): boolean {
  return !!word && Object.prototype.hasOwnProperty.call(WORDS, word.toLowerCase());
}

export function godHelp(): string[] {
  return [
    'คำสั่งพระเจ้า (ทุกคำสั่งที่เปลี่ยนโลกจะแสดงตัวอย่างผลก่อน แล้วพิมพ์ yes เพื่อทำจริง หรือ no เพื่อยกเลิก; ใส่ --yes เพื่อทำเลย):',
    ...ORDER.map((a) => `  ${USAGE[a]} — ${TITLE[a]}`),
    '  cancel N — ยกเลิกลางของปาฏิหาริย์ใบที่ N (ได้พลังคืนครึ่งหนึ่ง)',
    '  power — แสงศรัทธา ความหวาดกลัว ราคา และเพดานที่เหลือ',
    '  options — สิ่งที่ทำได้ตอนนี้ และสิ่งที่รออยู่ (หีบ ความฝัน คำอธิษฐาน ลาง)',
    '  yes / no — ยืนยัน / ยกเลิกคำสั่งที่รออยู่',
    'เป้าหมายพิมพ์เป็นชื่อได้ (ประเทศ ทวีป NPC มังกร เหตุการณ์) หรือรหัสที่ npcs / options บอก',
  ];
}

// ---------- the words of a preview ----------

const LABEL: Record<string, string> = {
  cost: 'ราคา',
  price: 'ราคา',
  chance: 'โอกาส',
  p: 'โอกาส',
  odds: 'โอกาส',
  expected: 'ผลที่คาด',
  effect: 'ผลที่คาด',
  effects: 'ผลที่คาด',
  result: 'ผล',
  risk: 'ความเสี่ยง',
  cooldown: 'ระยะรอ',
  title: 'ชื่อ',
  name: 'ชื่อ',
  text: 'ข้อความ',
  summary: 'สรุป',
  targetName: 'ที่',
  closes: 'เหตุการณ์ที่จะปิด',
  opens: 'เหตุการณ์ที่จะเปิด',
  npcs: 'NPC ที่เสี่ยง',
  note: 'หมายเหตุ',
};

const PERCENT = new Set(['chance', 'p', 'odds']);
const LINE_NAME = { faith: 'แสงศรัทธา', dread: 'ความหวาดกลัว' } as const;

function fmtNum(key: string, n: number): string {
  if (PERCENT.has(key) && n >= 0 && n <= 1) return `${Math.round(n * 100)}%`;
  return String(Math.round(n * 100) / 100);
}

function fmtValue(data: GameData, key: string, v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return fmtNum(key, v);
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่';
  if (typeof v === 'string') {
    const t = scrub(data, v).trim();
    return t || undefined;
  }
  if (Array.isArray(v)) {
    if (!v.length) return 'ไม่มี';
    const parts = v.map((x) => fmtValue(data, key, x)).filter((x): x is string => !!x);
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (typeof v === 'object') {
    const parts: string[] = [];
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const label = LINE_NAME[k as 'faith'] ?? LABEL[k];
      const t = fmtValue(data, k, x);
      if (label && t) parts.push(`${label} ${t}`);
    }
    return parts.length ? parts.join(' ') : undefined;
  }
  return undefined;
}

/** A price `{faith, dread}` as `แสงศรัทธา 15` (nothing when free). */
function costWords(c: unknown): string | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const o = c as { faith?: number; dread?: number };
  const parts: string[] = [];
  if (o.faith) parts.push(`แสงศรัทธา ${o.faith}`);
  if (o.dread) parts.push(`ความหวาดกลัว ${o.dread}`);
  return parts.length ? parts.join(' + ') : undefined;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** The preview of one action as lines for the player. The keys the tool has no words for go to a `(ดีบัก)` line only when `dev` is on. */
export function previewLines(data: GameData, preview: Record<string, unknown> | undefined, dev = false, action?: GodAction): string[] {
  if (!preview) return [];
  const p = preview;
  const nm = (id: unknown) => plainName(data, id);
  switch (action) {
    case 'chest.open':
      return [
        `หีบที่เปิดได้ปีนี้: เหลือ ${num(p.left)} จาก ${num(p.limit)}${p.window ? ' (หน้าต่างพระเจ้า ราคาในหีบลด ×0.7)' : ''}`,
        'ยังไม่รู้ว่าในหีบมีอะไร จนกว่าจะเปิด (ไม่เสียพลังจนกว่าจะเลือกใบ)',
      ];
    case 'chest.pick': {
      const out = [`ใบที่ ${num(p.slot)}: ${str(p.name) || nm(p.id)} (${CHEST_KIND_TH[str(p.kind)] ?? 'ของ'} ระดับ${TIER_TH[str(p.tier)] ?? str(p.tier)})`, `ราคา: ${LINE_NAME[str(p.pay) as 'faith'] ?? 'พลัง'} ${num(p.price)}`];
      const b = num(p.belief);
      if (b) out.push(`ศรัทธาเทพของเขา: ${b > 0 ? '+' : ''}${b}`);
      const why = (Array.isArray(p.why) ? p.why : []).map((w) => WHY_TH[str(w)]).filter(Boolean);
      if (why.length) out.push(`เหตุที่ขึ้น: ${why.join(' · ')}`);
      return out;
    }
    case 'chest.reroll':
      return [`ทอยใหม่ครั้งที่ ${num(p.rerolls) + 1}: ราคา แสงศรัทธา ${num(p.price)}${num(p.lock) ? ` (ล็อกใบที่ ${num(p.lock)} ไว้)` : ''}`, 'ใบที่ไม่ล็อกจะเปลี่ยนทั้งหมด'];
    case 'chest.skip':
      return ['พับหีบเก็บ ไม่เลือกสิ่งใด ไม่เสียพลัง'];
    case 'dream.send': {
      const out = [`ทาง: ${sentence(data, str(p.label)) || 'ทางที่เกมเสนอ'}`, `ภาพในฝัน: ${str(p.symbol)}`, `ใจของเขา: ${str(p.level)}${Array.isArray(p.reasons) && p.reasons.length ? ` (${p.reasons.map(str).join(' · ')})` : ''}`];
      out.push(p.free ? 'ราคา: ฟรีครั้งนี้ (อาวุธของผู้รู้)' : `ราคา: แสงศรัทธา ${num(p.faith)}`);
      return out;
    }
    case 'whisper': {
      const out = [`คำใบ้ “${str(p.hint)}”: ${scrub(data, str(p.effect))}`, `ใจของเขา: ${str(p.level)}`];
      const c = costWords(p.cost);
      out.push(c ? `ราคา: ${c}${p.window ? ' (หน้าต่างพระเจ้า ลดราคา)' : ''}` : 'ราคา: ฟรีครั้งนี้');
      out.push(`กระซิบได้อีก ${num(p.left)} ครั้งในปีนี้`);
      return out;
    }
    case 'prayer.answer': {
      const out = [`คำอธิษฐานใบที่ ${num(p.prayer)}: ${str(p.name)}`];
      const ans = str(p.answer);
      if (ans === 'give' || ans === 'strange') {
        out.push(`ราคา: ${costWords(p.cost) ?? 'ไม่มี'}`);
        const fx = fxPhrases(data, p.effect);
        if (ans === 'give') out.push(`ผลที่คาด: ${fx.length ? fx.join(' · ') : 'เขาได้สิ่งที่ขอ'}`);
        else if (Array.isArray(p.options)) out.push(`ของแปลกที่ให้เลือก: ${(p.options as { name?: string }[]).map((o, i) => `${i + 1} ${str(o.name)}`).join(' · ')}`);
        out.push(`ศรัทธาเทพของเขา ${num(p.belief) >= 0 ? '+' : ''}${num(p.belief)}${num(p.light) ? ` · ท่านได้แสงศรัทธาคืน ${num(p.light)}` : ''}`);
      } else if (ans === 'punish') {
        const fx = fxPhrases(data, p.effect);
        out.push(`ผลที่คาด: ผู้ขอถูกลงโทษ${fx.length ? ` (${fx.join(' · ')})` : ''}`, `ท่านได้ความหวาดกลัว +${num(p.dread)} · ศรัทธาเทพของเขา ${num(p.belief)}`);
      } else if (ans === 'deny') out.push('ผลที่คาด: ไม่มีผลต่อโลก', `ศรัทธาเทพของเขา ${num(p.belief)}`);
      else out.push('นิ่งเฉย: คำอธิษฐานยังรออยู่จนหมดเวลา (แล้วศรัทธาเทพลด 2)');
      return out;
    }
    case 'miracle':
    case 'decree': {
      if (p.cancel !== undefined) {
        const r = p.refund as { faith?: number; dread?: number } | undefined;
        return [`ยกเลิกลางใบที่ ${num(p.cancel)}`, `ได้พลังคืน: ${costWords(r) ?? 'ไม่มี'}`];
      }
      const out = [`${str(p.name)} (ระดับ${str(p.tier)})`];
      const where = str(p.targetName) || (typeof p.target === 'string' ? nm(p.target.replace(/^[a-z]+:/, '')) : '');
      if (where) out.push(`ที่: ${where}`);
      out.push(`ราคา: ${costWords(p.cost) ?? 'ไม่เสียพลัง'}`);
      if (num(p.omen)) out.push(`ลาง: อีก ${num(p.omen)} ฤดูก่อนเกิดเหตุ (ยกเลิกได้ ได้คืนครึ่งหนึ่ง)`);
      if (num(p.wait)) out.push(`ระยะรอหลังใช้: ${num(p.wait)} ปีโลก`);
      if (p.mul !== undefined) out.push(`ตัวคูณ: ×${num(p.mul)} นาน ${num(p.years)} ปีโลก${num(p.weight) ? ` (น้ำหนักตอนนี้ ${fmtNum('x', num(p.weight))})` : ''}`);
      const ch = p.chance as { now?: number; after?: number; die?: number; hurt?: number } | undefined;
      if (ch?.now !== undefined) out.push(`โอกาสเกิดในรอบถัดไป: ${Math.round(num(ch.now) * 100)}% → ${Math.round(num(ch.after) * 100)}%`);
      if (ch?.die !== undefined) out.push(`โอกาส: ตาย ${Math.round(num(ch.die) * 100)}% · บาดเจ็บหนัก ${Math.round(num(ch.hurt) * 100)}%`);
      if (typeof p.left === 'string') out.push(`ผลที่คาด: ${scrub(data, p.left)}`);
      else if (p.left && typeof p.left === 'object') {
        const l = p.left as { mid?: number; big?: number; grand?: number };
        out.push(`เหลือในชีวิตนี้: ระดับกลาง ${num(l.mid)} · ใหญ่ ${num(l.big)} · มหา ${num(l.grand)}`);
      }
      if (Array.isArray(p.flags) && p.flags.length) out.push(`สิ่งที่ประเทศนั้นเป็นอยู่: ${p.flags.map((f) => scrub(data, str(f))).filter(Boolean).join(' · ')}`);
      if (p.mood !== undefined) out.push(`อารมณ์ของมังกร ${Math.round(num(p.mood))} → ${Math.round(num(p.after))}`);
      if (typeof p.name === 'string' && p.mood !== undefined) out[0] = `${str(p.name)} (ระดับ${str(p.tier)})`;
      return out;
    }
    default:
  }
  // a power the tool has no phrasing for: the generic labels
  const out: string[] = [];
  const unknown: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (k === 'lines' && Array.isArray(v)) {
      for (const l of v) if (typeof l === 'string' && scrub(data, l).trim()) out.push(scrub(data, l).trim());
      continue;
    }
    const label = LABEL[k];
    const t = label ? fmtValue(data, k, v) : undefined;
    if (label && t) out.push(`${label}: ${t}`);
    else if (!label) unknown.push(`${k}=${JSON.stringify(v)}`);
  }
  if (dev && unknown.length) out.push(`(ดีบัก) ${unknown.join(' ')}`);
  return out;
}

/** Why the game called the player: the data of the `attention` call in words, or the old rule (an entry of level 3). */
export function callLines(data: GameData, e: LogEntry, dev = false): string[] {
  if (e.sys !== 'attention') return [`เกมเรียกเพราะ: เรื่อง [${tagOf(e)}] ถึงจุดที่ต้องการผู้เล่น (บันทึกระดับ 3)`];
  const mode = e.data.call === 'stop' ? 'เกมหยุดรอท่าน' : 'มีเรื่องรอท่าน (เวลายังเดินอยู่)';
  const tail = dev ? ` (ดีบัก: ${Object.entries(e.data).map(([k, v]) => `${k}=${String(v)}`).join(' ')})` : '';
  return [`เกมเรียกเพราะ: ${callReason(data, e)} · ${mode}${tail}`];
}

function costText(preview: Record<string, unknown> | undefined): string | undefined {
  if (!preview) return undefined;
  return costWords(preview.cost) ?? (typeof preview.price === 'number' ? `แสงศรัทธา ${preview.price}` : typeof preview.faith === 'number' && preview.faith ? `แสงศรัทธา ${preview.faith}` : undefined);
}

// ---------- counters shown by `power` ----------

function argText(action: GodAction, args: Record<string, unknown>): string {
  switch (action) {
    case 'chest.pick':
      return ` ใบที่ ${String(args.slot)}`;
    case 'dream.send':
      return ` ทางที่ ${String(args.path)}`;
    case 'whisper':
      return ` “${String(args.hint)}”`;
    case 'prayer.answer':
      return ` ใบที่ ${String(args.id)}`;
    case 'miracle':
      return args.cancel !== undefined ? ` ยกเลิกลางใบที่ ${String(args.cancel)}` : args.id ? ` ${String(args.id)}` : '';
    case 'decree':
      return ` ×${String(args.mul)}`;
    case 'conjure':
      return ` "${String(args.text)}"`;
    case 'vow.pick':
      return ` ข้อที่ ${String(args.pick)}`;
    default:
      return '';
  }
}

function int(w: string | undefined): number | undefined {
  if (w === undefined || !/^\d+$/.test(w)) return undefined;
  return Number(w);
}

// ---------- targets by name ----------

/** The way to turn what a player typed into the id the core wants. Each returns undefined when nothing fits. */
export interface TargetRef {
  country(text: string): string | undefined;
  continent(text: string): string | undefined;
  npc(text: string): string | undefined;
  dragon(text: string): number | undefined;
  event(text: string): string | undefined;
}

const ID = { country: /^[A-Z]{2}-\d{2}$/, continent: /^[A-Z]{2}$/, npc: /^[A-Z]{2}\d{2}-\d$/, event: /^[A-Z]{2,4}-\d{1,3}$/ };

/** Resolvers that take an id as it is and know no names (what `parseGod` uses when it gets nothing better). */
export const ID_REF: TargetRef = {
  country: (t) => (ID.country.test(t) ? t : undefined),
  continent: (t) => (ID.continent.test(t) ? t : undefined),
  npc: (t) => (ID.npc.test(t) ? t : undefined),
  dragon: (t) => (/^\d+$/.test(t) ? Number(t) : undefined),
  event: (t) => (ID.event.test(t) ? t : undefined),
};

/** Resolvers that read names from the data and the state of a game. */
export function refOf(game: Game, data: GameData): TargetRef {
  const L = labels(data);
  const inverse = (m: Map<string, string>) => {
    const o = new Map<string, string>();
    for (const [id, n] of m) if (!o.has(n)) o.set(n, id);
    return o;
  };
  const byName = (m: Map<string, string>, t: string) => m.get(t) ?? [...m].find(([, n]) => n.includes(t))?.[0];
  const countries = inverse(L.kind.country);
  const npcs = inverse(L.npc);
  const continents = new Map<string, string>(((data.continents?.items as { continents?: { id: string; name: string }[] } | undefined)?.continents ?? []).map((c) => [c.name, c.id]));
  const ctx = game.ctx;
  return {
    country: (t) => ID_REF.country(t) ?? byName(countries, t),
    continent: (t) => ID_REF.continent(t) ?? continents.get(t),
    npc: (t) => ID_REF.npc(t) ?? npcs.get(t),
    dragon: (t) => {
      const i = game.state.world.dragons.findIndex((d) => d.id === t || d.id.includes(t));
      return i >= 0 ? i : ID_REF.dragon(t);
    },
    event: (t) => fateTargets(ctx).find((x) => x.id === t || x.name === t)?.id ?? ID_REF.event(t),
  };
}

type Parsed = { action: GodAction; args: Record<string, unknown> } | { error: string };

/** What kind of target each miracle names (04-miracles.md §3); a miracle that is not here takes no target. */
const MIRACLE_TARGET: Record<string, 'country' | 'countries' | 'continent' | 'npc' | 'dragon'> = {
  'MR-01': 'country', 'MR-02': 'country', 'MR-03': 'country', 'MR-04': 'country', 'MR-05': 'countries', 'MR-06': 'npc', 'MR-07': 'country', 'MR-08': 'country',
  'MR-09': 'continent', 'MR-10': 'country', 'MR-11': 'country', 'MR-12': 'country', 'MR-13': 'country', 'MR-14': 'country', 'MR-15': 'country', 'MR-16': 'country',
  'MR-17': 'country', 'MR-18': 'country', 'MR-19': 'country', 'MR-20': 'country', 'MR-22': 'continent', 'MR-23': 'dragon', 'MR-24': 'dragon',
};

const NEEDS: Record<string, 'place' | 'npc'> = { จงไป: 'place', คนนั้นโกหก: 'npc', ช่วย: 'npc', ชี้ทายาท: 'npc' };

/** Turns the words of a line into an action and its arguments, or says how to type it. */
export function parseGod(word: string, rest: string[], ref: TargetRef = ID_REF): Parsed | { meta: Meta } {
  const kind = WORDS[word.toLowerCase()];
  if (kind === 'power' || kind === 'options' || kind === 'yes' || kind === 'no') return { meta: kind };
  const usage = (a: GodAction) => ({ error: `ใช้: ${USAGE[a]}` });
  const unknown = (what: string, t: string) => ({ error: `ไม่รู้จัก${what} "${t}" (พิมพ์ชื่อให้ตรง หรือใช้รหัสที่ options บอก)` });
  switch (kind) {
    case 'chest.open':
    case 'chest.skip':
      return { action: kind, args: {} };
    case 'chest.reroll': {
      const n = int(rest.find((x) => /^\d+$/.test(x)));
      return { action: kind, args: n === undefined ? {} : { lock: n } };
    }
    case 'chest.pick': {
      const n = int(rest[0]);
      return n === undefined ? usage(kind) : { action: kind, args: { slot: n } };
    }
    case 'dream.send': {
      const n = int(rest[0]);
      return n === undefined ? usage(kind) : { action: kind, args: { path: n } };
    }
    case 'vow.pick': {
      const n = int(rest[0]);
      return n === undefined ? usage(kind) : { action: kind, args: { pick: n } };
    }
    case 'whisper': {
      if (!rest.length) return usage(kind);
      const hint = rest[0];
      const text = rest.slice(1).join(' ');
      const need = NEEDS[hint];
      if (!text) return { action: kind, args: { hint } };
      if (need === 'place') {
        const id = ref.country(text) ?? ref.continent(text);
        return id ? { action: kind, args: { hint, target: id } } : unknown('ที่', text);
      }
      if (need === 'npc') {
        const id = ref.npc(text);
        return id ? { action: kind, args: { hint, target: id } } : unknown(' NPC', text);
      }
      return { action: kind, args: { hint } };
    }
    case 'conjure':
      return rest.length ? { action: kind, args: { text: rest.join(' ') } } : usage(kind);
    case 'prayer.answer': {
      if (rest.length < 2) return usage(kind);
      const n = int(rest[0]);
      if (n === undefined) return usage(kind);
      const answer = rest[1];
      const pick = int(rest[2]);
      return { action: kind, args: { id: n, answer, ...(pick !== undefined ? { option: pick - 1 } : {}) } };
    }
    case 'miracle': {
      const id = rest[0]?.toUpperCase();
      if (!id || !/^MR-\d{2}$/.test(id)) return usage(kind);
      const text = rest.slice(1).join(' ');
      if (id === 'MR-25') {
        const mul = Number(rest[rest.length - 1]);
        const ev = ref.event(rest.slice(1, -1).join(' '));
        if (!ev || !Number.isFinite(mul) || mul <= 0) return { error: 'ใช้: decree <เหตุการณ์> <ตัวคูณ> (ลิขิตเลือกเหตุการณ์ที่มีลางจาก options)' };
        return { action: 'decree', args: { event: ev, mul } };
      }
      if (!text) return { action: kind, args: { id } };
      switch (MIRACLE_TARGET[id]) {
        case 'country': {
          const c = ref.country(text);
          return c ? { action: kind, args: { id, country: c } } : unknown('ประเทศ', text);
        }
        case 'countries': {
          const list = text.split(/\s*(?:,|และ)\s*/).map((t) => ref.country(t));
          return list.every(Boolean) ? { action: kind, args: { id, countries: list } } : unknown('ประเทศ', text);
        }
        case 'continent': {
          const c = ref.continent(text);
          return c ? { action: kind, args: { id, continent: c } } : unknown('ทวีป', text);
        }
        case 'npc': {
          const n = ref.npc(text);
          return n ? { action: kind, args: { id, npc: n } } : unknown(' NPC', text);
        }
        case 'dragon': {
          const d = ref.dragon(text);
          return d !== undefined ? { action: kind, args: { id, dragon: d } } : unknown('มังกร', text);
        }
        default:
          return { action: kind, args: { id } };
      }
    }
    case 'decree': {
      if (rest.length < 2) return usage(kind);
      const mul = Number(rest[rest.length - 1]);
      if (!Number.isFinite(mul) || mul <= 0) return usage(kind);
      const text = rest.slice(0, -1).join(' ');
      const ev = ref.event(text);
      return ev ? { action: kind, args: { event: ev, mul } } : unknown('เหตุการณ์', text);
    }
    case 'cancel': {
      const n = int(rest[0]);
      return n === undefined ? { error: 'ใช้: cancel N (ลางใบที่ N)' } : { action: 'miracle', args: { cancel: n } };
    }
    default:
      return { error: 'คำสั่งไม่รู้จัก' };
  }
}

// ---------- what waits for the god ----------

/** How many events with an omen the list shows (the rest are told as a count): the world has dozens. */
const FATE_SHOWN = 8;

const lineName = (pay: string) => LINE_NAME[pay as 'faith'] ?? 'พลัง';

/** Chest, dream, prayers and omens that are waiting, as lines. Reads the state, changes nothing. */
export function waitingLines(game: Game, data: GameData): string[] {
  const ctx: Ctx = game.ctx;
  const st = game.state;
  const out: string[] = [];
  const life = st.life && !st.life.dead ? st.life : null;
  if (!life) return out;
  const nm = (id: unknown) => plainName(data, id);
  const cards = cardsOf(ctx);
  for (const c of cards) {
    const price = grantPrice(ctx, kindOf(ctx, c.kind)!);
    const left = Math.max(0, c.exp - (life.hAge * 4 + st.clock.quarter));
    const by = c.npc ? ` (ผู้ขอคือ ${nm(c.npc)})` : '';
    out.push(`คำอธิษฐานใบที่ ${c.n}: ${nameOfKind(ctx, c.kind)}${by} · เหลือเวลาราว ${(left / 4).toFixed(1)} ปี${c.silent ? ' · ท่านนิ่งอยู่' : ''}`);
    out.push(`    answer ${c.n} ให้ (แสงศรัทธา ${price}) · answer ${c.n} แปลก N (${strangeOptions(ctx, c).map((o, i) => `${i + 1} ${o.name}`).join(' · ') || 'ไม่มีของให้เลือก'}) · answer ${c.n} ปฏิเสธ · answer ${c.n} ลงโทษ · answer ${c.n} นิ่ง`);
  }
  const ch = currentChest(ctx);
  if (ch) {
    out.push(`หีบประทานที่เปิดอยู่ (pick N เลือก · reroll ทอยใหม่ · skip ข้าม):`);
    for (const s of ch.slots) {
      if (!s) continue;
      const why = s.why.map((w) => WHY_TH[w]).filter(Boolean).join(' · ');
      out.push(`  ใบที่ ${s.slot}: ${CHEST_KIND_TH[s.kind] ?? 'ของ'} ${s.name} (ระดับ${TIER_TH[s.tier] ?? s.tier}) · ${lineName(s.pay)} ${s.price} · ศรัทธาเทพของเขา ${s.belief > 0 ? '+' : ''}${s.belief}${why ? ` · ${why}` : ''}`);
    }
  }
  const offers = offerCards(ctx);
  if (offers.length) {
    out.push('ทางที่ฝันถึงได้ตอนนี้ (dream N):');
    offers.forEach((o, i) => out.push(`  ทางที่ ${i + 1}: ${sentence(data, o.label) || 'ทางที่เกมเสนอ'} · ภาพ${o.symbol} · ใจของเขา ${o.level}${o.reasons.length ? ` (${o.reasons.join(' · ')})` : ''} · ราคา ${o.free ? 'ฟรี' : `แสงศรัทธา ${o.price}`}`));
  }
  const pend = actsOf(st).pending;
  for (const p of pend) out.push(`ลางใบที่ ${p.n}: ${ctx.data.god ? plainName(data, p.id) || p.id : p.id} (cancel ${p.n} เพื่อยกเลิก)`);
  const fate = fateTargets(ctx);
  if (fate.length) out.push(`เหตุการณ์ของโลกที่มีลาง ลิขิตได้ (decree <ชื่อ> <×0.2–0.9 ชะลอ | ×1.1–3 เร่ง>): ${fate.slice(0, FATE_SHOWN).map((t) => t.name).join(' · ')}${fate.length > FATE_SHOWN ? ` · … และอีก ${fate.length - FATE_SHOWN} เรื่อง` : ''}`);
  return out;
}

// ---------- the console ----------

export class GodConsole {
  pending: PendingGod | null;
  autoYes: boolean;
  dev: boolean;
  private readonly game: Game;
  private readonly data: GameData;

  constructor(o: GodConsoleOpts) {
    this.game = o.game;
    this.data = o.data;
    this.autoYes = !!o.autoYes;
    this.dev = !!o.dev;
    this.pending = o.pending ?? null;
  }

  /** Forget a command waiting for `yes` (the clock moved on, so the preview is old). Returns a line when there was one. */
  drop(): string[] {
    if (!this.pending) return [];
    const t = this.pending.title;
    this.pending = null;
    return [`(ยกเลิก${t}ที่รอยืนยัน เพราะเวลาเดินต่อ)`];
  }

  /** Handles one line; undefined when the first word is not a command of the god. */
  handle(text: string): string[] | undefined {
    const [word, ...rest] = text.split(/\s+/).filter(Boolean);
    if (!isGodWord(word)) return undefined;
    const p = parseGod(word, rest, refOf(this.game, this.data));
    if ('error' in p) return [p.error];
    if ('meta' in p) {
      switch (p.meta) {
        case 'power':
          return this.power();
        case 'options':
          return this.options();
        case 'no': {
          if (!this.pending) return ['ไม่มีคำสั่งที่รอยืนยัน'];
          const t = this.pending.title;
          this.pending = null;
          return [`ยกเลิก${t}แล้ว`];
        }
        case 'yes': {
          if (!this.pending) return ['ไม่มีคำสั่งที่รอยืนยัน (พิมพ์คำสั่งพระเจ้าก่อน เช่น chest)'];
          const pend = this.pending;
          this.pending = null;
          return this.run(pend);
        }
      }
    }
    return this.preview(p.action, p.args);
  }

  private preview(action: GodAction, args: Record<string, unknown>): string[] {
    const title = `${TITLE[action]}${argText(action, args)}`;
    this.pending = null;
    if (!hasAction(action)) return [`${title}: ยังไม่มีพลังนี้`];
    const r = this.ask(action, args);
    if (!r.ok) return [`${title}: ทำไม่ได้ — ${r.reason}`];
    const out = [`-- ตัวอย่างผล: ${title} --`, ...previewLines(this.data, r.preview, this.dev, action)];
    if (!r.preview || out.length === 1) out.push('(ไม่มีรายละเอียดของผลที่คาด)');
    const pend: PendingGod = { action, args, title };
    if (this.autoYes) return [...out, ...this.run(pend)];
    this.pending = pend;
    out.push('พิมพ์ yes เพื่อทำจริง หรือ no เพื่อยกเลิก');
    return out;
  }

  /** Asks the core without confirming: it checks and answers the preview, and changes nothing. */
  private ask(action: GodAction, args: Record<string, unknown>): { ok: true; preview?: Record<string, unknown> } | { ok: false; reason: string } {
    try {
      const r = command(this.game.ctx, { type: 'god', action, args, confirm: false });
      return r.ok ? { ok: true, preview: r.preview } : { ok: false, reason: scrub(this.data, r.reason).trim() || 'ไม่ได้ตอนนี้' };
    } catch (err) {
      return { ok: false, reason: this.dev ? `ผิดพลาด: ${String((err as Error)?.message)}` : 'ใส่รายละเอียดไม่ครบหรือไม่ถูก (ดู help)' };
    }
  }

  private run(p: PendingGod): string[] {
    if (!hasAction(p.action)) return [`${p.title}: ยังไม่มีพลังนี้`];
    const st = this.game.state;
    const mark = st.logN;
    const before = { light: st.god.light, dread: st.god.dread };
    const r = command(this.game.ctx, { type: 'god', action: p.action, args: p.args, confirm: true });
    if (!r.ok) return [`${p.title}: ทำไม่ได้ — ${scrub(this.data, r.reason).trim() || 'ไม่ได้ตอนนี้'}`];
    const out = [`-- ทำแล้ว: ${p.title} --`];
    const ls = timeline(this.data, st.log, 1, { fromN: mark, notes: toolNotes(st) });
    out.push(...(ls.length ? ls : ['(ไม่มีบรรทัดบันทึกใหม่)']));
    const moved: string[] = [];
    if (st.god.light !== before.light) moved.push(`แสงศรัทธา ${round(before.light)} → ${round(st.god.light)}`);
    if (st.god.dread !== before.dread) moved.push(`ความหวาดกลัว ${round(before.dread)} → ${round(st.god.dread)}`);
    if (moved.length) out.push(moved.join(' · '));
    // a chest just opened is not yet a choice: the cards are what the player has to read
    if (p.action === 'chest.open' || p.action === 'chest.reroll') out.push(...waitingLines(this.game, this.data).filter((l) => l.startsWith('หีบ') || l.startsWith('  ใบที่')));
    return out;
  }

  power(): string[] {
    const st = this.game.state;
    const g = st.god;
    const ctx = this.game.ctx;
    const out = ['-- พลังของพระเจ้า --', `แสงศรัทธา ${round(g.light)} · ความหวาดกลัว ${round(g.dread)}`];
    if (st.life) out.push(`ศรัทธาเทพของ${st.life.name} ${st.life.godFaith} · ภาระใจ ${st.life.heart}`);
    if (st.life && !st.life.dead && ctx.data.god) {
      const caps = (ctx.data.god.items as { caps: { chestPerYear: number; dreamPerYear: number; whisperPerYear: number } }).caps;
      const c = g.counters;
      out.push(`ปีนี้: หีบ ${c['y.chest'] ?? 0}/${chestLimit(ctx)} · ฝัน ${c['y.dream'] ?? 0}/${caps.dreamPerYear}${inWindow(ctx) ? ' · อยู่ในหน้าต่างพระเจ้า (ราคาลด ×0.7)' : ''}`);
      out.push(`ชีวิตนี้: ประทานแล้ว ${c['l.pick'] ?? 0} · ส่งฝัน ${c['l.dream'] ?? 0} (ทำตาม ${c['l.dream.obeyed'] ?? 0}) · ใช้พลังไปแล้ว แสงศรัทธา ${c['l.spent.faith'] ?? 0} ความหวาดกลัว ${c['l.spent.dread'] ?? 0}`);
    }
    const cd = Object.entries(g.cooldowns).filter(([k, v]) => /^MR-\d{2}$/.test(k) && v > st.clock.worldYear);
    if (cd.length) out.push(`ปาฏิหาริย์ที่ยังรอ: ${cd.map(([k, v]) => `${k} อีก ${Math.ceil(v - st.clock.worldYear)} ปีโลก`).join(' · ')}`);
    const ms = this.miracleList();
    if (ms.length) out.push(`ปาฏิหาริย์ที่เปิดใช้: ${ms.join(' · ')}`);
    return out;
  }

  /** The miracles that exist in this build, with their price: `MR-01 ฝนต้องฤดู (แสงศรัทธา 15)`. */
  private miracleList(): string[] {
    const ctx = this.game.ctx;
    const list = (ctx.data.god?.items as { miracles?: { list: { id: string; name: string; cost: { faith?: number; dread?: number } }[] } } | undefined)?.miracles?.list ?? [];
    const impl = new Set(implementedMiracles());
    return list.filter((m) => impl.has(m.id) && m.id !== 'MR-25').map((m) => `${m.id} ${m.name} (${costWords(m.cost) ?? 'ทุกแสงศรัทธาที่มี'})`);
  }

  options(): string[] {
    const ctx = this.game.ctx;
    const st = this.game.state;
    const out = ['-- สิ่งที่ทำได้ตอนนี้ --'];
    const cards = cardsOf(ctx);
    const probes: Partial<Record<GodAction, { args: Record<string, unknown>; missing?: string }>> = {
      'chest.pick': { args: { slot: 1 } },
      'dream.send': { args: { path: 1 }, missing: offerCards(ctx).length ? undefined : 'ตอนนี้ไม่มีทางแยกให้ฝันถึง' },
      whisper: { args: { hint: 'ระวัง' } },
      'prayer.answer': { args: cards.length ? { id: cards[0].n, answer: 'ให้' } : {}, missing: cards.length ? undefined : 'ไม่มีคำอธิษฐานที่รออยู่' },
      miracle: { args: { id: 'MR-21' } },
      decree: { args: { event: fateTargets(ctx)[0]?.id ?? '', mul: 0.5 }, missing: fateTargets(ctx).length ? undefined : 'ยังไม่มีเหตุการณ์ที่มีลางให้ลิขิต' },
    };
    for (const a of ORDER) {
      const head = `  ${USAGE[a]} (${TITLE[a]})`;
      if (!hasAction(a)) {
        out.push(`${head} — ยังไม่มีพลังนี้`);
        continue;
      }
      const probe = probes[a];
      if (probe?.missing) {
        out.push(`${head} — ยังทำไม่ได้: ${probe.missing}`);
        continue;
      }
      if (a === 'chest.pick' && currentChest(ctx)) {
        out.push(`${head} — ทำได้ (ดูใบในหีบด้านล่าง)`);
        continue;
      }
      if (a === 'miracle') {
        out.push(`${head} — ทำได้ตามเงื่อนไขของแต่ละแบบ (รายการและราคาอยู่ใน power)`);
        continue;
      }
      const r = this.ask(a, probe?.args ?? {});
      if (r.ok) {
        const c = a === 'chest.open' || a === 'chest.reroll' ? costText(r.preview) : costText(r.preview);
        out.push(`${head} — ทำได้${c ? ` · ราคา ${c}` : ''}`);
      } else out.push(`${head} — ยังทำไม่ได้: ${r.reason}`);
    }
    const w = waitingLines(this.game, this.data);
    if (w.length) out.push('', '-- ที่รออยู่ --', ...w);
    if (st.life && !st.life.dead) {
      const hints = ((ctx.data.god?.items as { dreams?: { whispers: { hint: string }[] } } | undefined)?.dreams?.whispers ?? []).map((x) => x.hint);
      if (hints.length) out.push('', `คำใบ้กระซิบ: ${hints.map((h) => `${h}${NEEDS[h] === 'place' ? ' <ที่>' : NEEDS[h] === 'npc' ? ' <NPC>' : ''}`).join(' · ')}`);
    }
    return out;
  }

  /** The names of what can be done now, for the line after a call of the game. Empty when no power exists. */
  doableNow(): string[] {
    const ctx = this.game.ctx;
    const names: string[] = [];
    const cards = cardsOf(ctx);
    const test: [GodAction, string, Record<string, unknown>, boolean][] = [
      ['chest.open', 'chest', {}, true],
      ['chest.pick', 'pick', { slot: 1 }, !!currentChest(ctx)],
      ['dream.send', 'dream', { path: 1 }, offerCards(ctx).length > 0],
      ['whisper', 'whisper', { hint: 'ระวัง' }, true],
      ['prayer.answer', 'answer', cards.length ? { id: cards[0].n, answer: 'ให้' } : {}, cards.length > 0],
      ['decree', 'decree', {}, fateTargets(ctx).length > 0],
    ];
    for (const [a, name, args, want] of test) {
      if (!want || !hasAction(a)) continue;
      if (a === 'decree' || a === 'chest.pick' || this.ask(a, args).ok) names.push(name);
    }
    if (hasAction('miracle')) names.push('miracle');
    return names;
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

