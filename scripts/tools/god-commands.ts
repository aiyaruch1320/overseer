// The commands of the god in text (docs/guide/code-plan.md §8.0 and §6.4), shared by `npm run play` and the debug page.
// A player (a person or a simulated-player subagent) types `chest`, `pick 2`, `dream 1`, `whisper ระวัง`, `answer 1 ให้`,
// `miracle MR-04 <place>`, `decree <event> <mult>`, `conjure <words>`, `vow 1`. Each one goes through `command()` of the core
// (src/core/command): first the preview (the core checks the right to act and answers the expected result without rolling),
// then, after `yes`, the real run (docs/systems/god/06-implementation.md §3).
//
// What the player reads is Thai (docs/appearance/20-god-ui.md); the only code is the `MR-xx` the player types.
// The arguments sent to the actions (the contract with the god system, one place to change):
//   chest.open {} · chest.pick {slot: N} · chest.reroll {} · chest.skip {} · dream.send {path: N} · whisper {hint: คำใบ้ที่พิมพ์}
//   prayer.answer {id: N, mode: ให้|แปลก|ปฏิเสธ|ลงโทษ} · miracle {id: 'MR-xx', target?: ข้อความที่พิมพ์} · decree {event, mult}
//   conjure {text} · vow.pick {pick: N}
// Browser safe: no node imports.
import { command, hasAction } from '../../src/core/command';
import type { Game } from '../../src/core/game';
import { scrub } from '../../src/core/text';
import type { GameData } from '../../src/core/game';
import type { GodAction } from '../../src/core/types';
import type { LogEntry } from '../../src/core/types';
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
  'chest.reroll': 'reroll',
  'chest.skip': 'skip',
  'dream.send': 'dream N',
  whisper: 'whisper <คำใบ้>',
  'prayer.answer': 'answer <ใบ> <ให้|แปลก|ปฏิเสธ|ลงโทษ>',
  miracle: 'miracle MR-xx [เป้าหมาย]',
  decree: 'decree <เหตุการณ์> <ตัวคูณ>',
  conjure: 'conjure <ถ้อยคำ>',
  'vow.pick': 'vow N',
};

const ORDER = Object.keys(TITLE) as GodAction[];

/** Arguments used only to ask `options` whether an action can be taken at all. */
const PROBE: Partial<Record<GodAction, Record<string, unknown>>> = {
  'chest.pick': { slot: 1 },
  'dream.send': { path: 1 },
  'vow.pick': { pick: 1 },
};

const WORDS: Record<string, GodAction | 'power' | 'options' | 'yes' | 'no'> = {
  chest: 'chest.open',
  pick: 'chest.pick',
  reroll: 'chest.reroll',
  skip: 'chest.skip',
  dream: 'dream.send',
  whisper: 'whisper',
  answer: 'prayer.answer',
  miracle: 'miracle',
  decree: 'decree',
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
    '  power — แสงศรัทธา ความหวาดกลัว ราคา และเพดานที่เหลือ',
    '  options — สิ่งที่ทำได้ตอนนี้',
    '  yes / no — ยืนยัน / ยกเลิกคำสั่งที่รออยู่',
  ];
}

// ---------- reading a preview ----------

const LABEL: Record<string, string> = {
  cost: 'ราคา',
  price: 'ราคา',
  light: 'แสงศรัทธา',
  faith: 'แสงศรัทธา',
  dread: 'ความหวาดกลัว',
  chance: 'โอกาส',
  p: 'โอกาส',
  odds: 'โอกาส',
  expected: 'ผลที่คาด',
  expect: 'ผลที่คาด',
  effect: 'ผลที่คาด',
  effects: 'ผลที่คาด',
  result: 'ผล',
  risk: 'ความเสี่ยง',
  risks: 'ความเสี่ยง',
  cooldown: 'ระยะรอ',
  wait: 'ระยะรอ',
  title: 'ชื่อ',
  name: 'ชื่อ',
  label: 'ชื่อ',
  text: 'ข้อความ',
  summary: 'สรุป',
  cards: 'การ์ด',
  slots: 'การ์ด',
  paths: 'ทาง',
  hint: 'คำใบ้',
  target: 'เป้าหมาย',
  tier: 'ระดับ',
  level: 'ระดับ',
  belief: 'ศรัทธาเทพ',
  closes: 'เหตุการณ์ที่จะปิด',
  opens: 'เหตุการณ์ที่จะเปิด',
  npcs: 'NPC ที่เสี่ยง',
  why: 'เหตุที่ขึ้น',
  reason: 'เหตุที่ขึ้น',
  left: 'เหลือ',
  remaining: 'เหลือ',
  cap: 'เพดาน',
  mult: 'ตัวคูณ',
  event: 'เหตุการณ์',
  mode: 'แบบ',
  note: 'หมายเหตุ',
  rerolls: 'ทอยใหม่ไปแล้ว',
  obey: 'โอกาสที่เขาทำตาม',
  mood: 'ใจของเขา',
  source: 'ที่มา',
  from: 'ที่มา',
  window: 'หน้าต่าง',
  trigger: 'เหตุ',
  count: 'จำนวน',
};

const PERCENT = new Set(['chance', 'p', 'odds', 'obey']);

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
      const label = LABEL[k];
      const t = fmtValue(data, k, x);
      if (label && t) parts.push(`${label} ${t}`);
    }
    return parts.length ? parts.join(' ') : undefined;
  }
  return undefined;
}

/** The preview as lines for the player; keys the tool has no words for go to a `(ดีบัก)` line only when `dev` is on. */
export function previewLines(data: GameData, preview: Record<string, unknown> | undefined, dev = false): string[] {
  if (!preview) return [];
  const out: string[] = [];
  const unknown: string[] = [];
  for (const [k, v] of Object.entries(preview)) {
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

/** Why the game called the player: the data of the `attention` call, or the old rule (an entry of level 3) in words. */
export function callLines(data: GameData, e: LogEntry, dev = false): string[] {
  if (e.sys !== 'attention') return [`เกมเรียกเพราะ: เรื่อง [${tagOf(e)}] ถึงจุดที่ต้องการผู้เล่น (บันทึกระดับ 3)`];
  const { reason, why, ...others } = e.data;
  const said = [reason, why].find((x): x is string => typeof x === 'string' && !!scrub(data, x).trim());
  const more = previewLines(data, others, dev);
  const parts = [said ? scrub(data, said).trim() : '', ...more].filter(Boolean);
  return [`เกมเรียกเพราะ: ${parts.join(' · ') || 'ถึงจังหวะที่ผู้เล่นควรดู'}`];
}

function costText(data: GameData, preview: Record<string, unknown> | undefined): string | undefined {
  if (!preview) return undefined;
  return fmtValue(data, 'cost', preview.cost ?? preview.price);
}

// ---------- counters shown by `power` ----------

const TOKEN: Record<string, string> = {
  chest: 'หีบ',
  chests: 'หีบ',
  reroll: 'ทอยใหม่',
  rerolls: 'ทอยใหม่',
  dream: 'ฝัน',
  dreams: 'ฝัน',
  whisper: 'กระซิบ',
  whispers: 'กระซิบ',
  prayer: 'คำอธิษฐาน',
  prayers: 'คำอธิษฐาน',
  miracle: 'ปาฏิหาริย์',
  miracles: 'ปาฏิหาริย์',
  weapon: 'อาวุธประทาน',
  gift: 'ของประทาน',
  great: 'ปาฏิหาริย์มหา',
  revive: 'ปลุกชีพ',
  conjure: 'เสกตามใจ',
  decree: 'ลิขิต',
  year: 'ปีนี้',
  life: 'ตลอดชีวิต',
};

function counterLabel(key: string): string | undefined {
  const toks = key.split(/[.:_\-\s]+/).filter(Boolean);
  if (!toks.length || !toks.every((t) => TOKEN[t.toLowerCase()])) return undefined;
  return toks.map((t) => TOKEN[t.toLowerCase()]).join(' ');
}

// ---------- the console ----------

function argText(action: GodAction, args: Record<string, unknown>): string {
  switch (action) {
    case 'chest.pick':
      return ` ใบที่ ${String(args.slot)}`;
    case 'dream.send':
      return ` ทางที่ ${String(args.path)}`;
    case 'whisper':
      return ` "${String(args.hint)}"`;
    case 'prayer.answer':
      return ` ใบที่ ${String(args.id)} แบบ${String(args.mode)}`;
    case 'miracle':
      return ` ${String(args.id)}${args.target ? ` ที่ ${String(args.target)}` : ''}`;
    case 'decree':
      return ` ${String(args.event)} ×${String(args.mult)}`;
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

type Parsed = { action: GodAction; args: Record<string, unknown> } | { error: string };

/** Turns the words of a line into an action and its arguments, or says how to type it. */
export function parseGod(word: string, rest: string[]): Parsed | { meta: 'power' | 'options' | 'yes' | 'no' } {
  const kind = WORDS[word.toLowerCase()];
  if (kind === 'power' || kind === 'options' || kind === 'yes' || kind === 'no') return { meta: kind };
  const usage = (a: GodAction) => ({ error: `ใช้: ${USAGE[a]}` });
  switch (kind) {
    case 'chest.open':
    case 'chest.reroll':
    case 'chest.skip':
      return { action: kind, args: {} };
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
    case 'whisper':
      return rest.length ? { action: kind, args: { hint: rest.join(' ') } } : usage(kind);
    case 'conjure':
      return rest.length ? { action: kind, args: { text: rest.join(' ') } } : usage(kind);
    case 'prayer.answer': {
      if (rest.length < 2) return usage(kind);
      const n = int(rest[0]);
      return { action: kind, args: { id: n ?? rest[0], mode: rest.slice(1).join(' ') } };
    }
    case 'miracle': {
      const id = rest[0]?.toUpperCase();
      if (!id || !/^MR-\d{2}$/.test(id)) return usage(kind);
      const target = rest.slice(1).join(' ');
      return { action: kind, args: target ? { id, target } : { id } };
    }
    case 'decree': {
      if (rest.length < 2) return usage(kind);
      const mult = Number(rest[rest.length - 1]);
      if (!Number.isFinite(mult) || mult <= 0) return usage(kind);
      return { action: kind, args: { event: rest.slice(0, -1).join(' '), mult } };
    }
    default:
      return { error: 'คำสั่งไม่รู้จัก' };
  }
}

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
    const p = parseGod(word, rest);
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
    const out = [`-- ตัวอย่างผล: ${title} --`, ...previewLines(this.data, r.preview, this.dev)];
    if (!r.preview || !out.length) out.push('(ไม่มีรายละเอียดของผลที่คาด)');
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
    return out;
  }

  power(): string[] {
    const st = this.game.state;
    const g = st.god;
    const out = ['-- พลังของพระเจ้า --', `แสงศรัทธา ${round(g.light)} · ความหวาดกลัว ${round(g.dread)}`];
    if (st.life) out.push(`ศรัทธาเทพของ${st.life.name} ${st.life.godFaith} · ภาระใจ ${st.life.heart}`);
    const costs: string[] = [];
    for (const a of ORDER) {
      if (!hasAction(a)) continue;
      const r = this.ask(a, PROBE[a] ?? {});
      const c = r.ok ? costText(this.data, r.preview) : undefined;
      if (c) costs.push(`${TITLE[a]} ${c}`);
    }
    out.push(costs.length ? `ราคาตอนนี้: ${costs.join(' · ')}` : 'ราคาตอนนี้: (ยังไม่มีพลังที่บอกราคาได้)');
    const used: string[] = [];
    const hidden: string[] = [];
    for (const [k, v] of Object.entries(g.counters)) {
      if (!v) continue;
      const label = counterLabel(k);
      if (label) used.push(`${label} ${v}`);
      else hidden.push(`${k}=${v}`);
    }
    for (const [k, v] of Object.entries(g.cooldowns)) {
      if (!v) continue;
      if (/^MR-\d{2}$/.test(k)) used.push(`ระยะรอ ${k} ${v}`);
      else hidden.push(`${k}=${v}`);
    }
    out.push(used.length ? `ใช้ไปแล้ว: ${used.join(' · ')}` : 'ใช้ไปแล้ว: ยังไม่มี');
    if (this.dev && hidden.length) out.push(`(ดีบัก) ${hidden.join(' ')}`);
    if (!ORDER.some((a) => hasAction(a))) out.push('ยังไม่มีพลังใดลงทะเบียน (ยังไม่มีระบบพระเจ้า)');
    return out;
  }

  options(): string[] {
    const out = ['-- สิ่งที่ทำได้ตอนนี้ --'];
    for (const a of ORDER) {
      const head = `  ${USAGE[a]} (${TITLE[a]})`;
      if (!hasAction(a)) {
        out.push(`${head} — ยังไม่มีพลังนี้`);
        continue;
      }
      const r = this.ask(a, PROBE[a] ?? {});
      if (r.ok) {
        const c = costText(this.data, r.preview);
        out.push(`${head} — ทำได้${c ? ` · ราคา ${c}` : ''}`);
      } else out.push(`${head} — ยังทำไม่ได้: ${r.reason}`);
    }
    return out;
  }

  /** The names of what can be done now, for the line after a call of the game. Empty when no power exists. */
  doableNow(): string[] {
    const names: string[] = [];
    for (const a of ORDER) {
      if (!hasAction(a)) continue;
      const r = this.ask(a, PROBE[a] ?? {});
      if (r.ok) names.push(USAGE[a].split(' ')[0]);
    }
    return names;
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
